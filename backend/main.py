import os
import json
import asyncio
import time
import uuid
from collections import deque
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import dashscope
from dashscope.audio.asr import Recognition, RecognitionCallback, RecognitionResult
import openai

# --- 加载环境变量 ---
# 请确保在项目根目录下的 .env 文件中正确配置了以下变量：
# - DASHSCOPE_API_KEY: 阿里灵积平台密钥
# - GEMINI_API_KEY: OpenAI 兼容接口密钥
# - GEMINI_BASE_URL: API 基础地址
# - VOLC_APP_KEY/VOLC_ACCESS_KEY: 火山引擎密钥
# - PUBLIC_BASE_URL: 后端服务的公网访问地址
from dotenv import load_dotenv
load_dotenv()

# --- SDK 配置 ---
# 配置阿里 DashScope (用于实时语音识别)
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")

# 配置 OpenAI 客户端 (用于 Gemini LLM 对话)
client = openai.OpenAI(
    api_key=os.getenv("GEMINI_API_KEY"),
    base_url=os.getenv("GEMINI_BASE_URL")
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

VOLC_SUBMIT_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit"
VOLC_QUERY_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/query"
VOLC_RESOURCE_ID = os.getenv("VOLC_RESOURCE_ID", "volc.bigasr.auc")
VOLC_APP_KEY = os.getenv("VOLC_APP_KEY")
VOLC_ACCESS_KEY = os.getenv("VOLC_ACCESS_KEY")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL")

TASK_LOGID: dict[str, str] = {}

def _volc_request(url: str, headers: dict, body: dict | None) -> tuple[dict, dict]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = Request(url, data=data, headers=headers, method="POST")
    try:
        with urlopen(req, timeout=60) as resp:
            resp_body = resp.read() or b"{}"
            try:
                parsed = json.loads(resp_body.decode("utf-8"))
            except Exception:
                parsed = {"raw": resp_body.decode("utf-8", errors="ignore")}
            return parsed, dict(resp.headers)
    except HTTPError as e:
        raw = e.read() if hasattr(e, "read") else b""
        raise HTTPException(status_code=502, detail={"error": "volc_http_error", "status": e.code, "body": raw.decode("utf-8", errors="ignore")})
    except URLError as e:
        raise HTTPException(status_code=502, detail={"error": "volc_url_error", "reason": str(e.reason)})

def _require_volc_creds() -> None:
    if not VOLC_APP_KEY or not VOLC_ACCESS_KEY:
        raise HTTPException(status_code=500, detail="Missing VOLC_APP_KEY or VOLC_ACCESS_KEY env vars")
    if not PUBLIC_BASE_URL:
        raise HTTPException(status_code=500, detail="Missing PUBLIC_BASE_URL env var (publicly reachable base URL for uploaded files)")

def _ms_to_mmss(ms: int | None) -> str | None:
    if ms is None:
        return None
    seconds = max(0, int(ms // 1000))
    m = seconds // 60
    s = seconds % 60
    return f"{m:02d}:{s:02d}"

def _extract_speaker(utt: dict) -> str | None:
    additions = utt.get("additions") if isinstance(utt, dict) else None
    if isinstance(additions, dict):
        speaker = additions.get("speaker") or additions.get("speaker_id")
        if speaker is not None:
            return str(speaker)
    for key in ("speaker", "speaker_id", "speakerId"):
        if key in utt and utt[key] is not None:
            return str(utt[key])
    return None

def _extract_segments_from_auc_result(payload: dict) -> tuple[str, list[dict]]:
    result = payload.get("result")
    if isinstance(result, list) and result:
        result = result[0]
    if not isinstance(result, dict):
        return "", []
    full_text = result.get("text") or ""
    utterances = result.get("utterances") or []
    segments: list[dict] = []
    if isinstance(utterances, list):
        for idx, utt in enumerate(utterances):
            if not isinstance(utt, dict):
                continue
            text = (utt.get("text") or "").strip()
            if not text:
                continue
            segments.append({
                "id": f"utt-{idx}-{uuid.uuid4().hex[:8]}",
                "type": "user",
                "content": text,
                "startTime": _ms_to_mmss(utt.get("start_time")),
                "endTime": _ms_to_mmss(utt.get("end_time")),
                "speaker": _extract_speaker(utt),
            })
    return str(full_text), segments

class AucQueryRequest(BaseModel):
    task_id: str

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        response = client.chat.completions.create(
            model="gemini-3-flash-preview",
            messages=[
                {"role": "user", "content": request.message}
            ]
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        print(f"Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/asr/auc/submit")
async def auc_submit(file: UploadFile = File(...)):
    _require_volc_creds()
    filename = file.filename or "audio"
    ext = os.path.splitext(filename)[1].lower().lstrip(".") or "wav"
    if ext not in {"raw", "wav", "mp3", "ogg"}:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {ext}. Use wav/mp3/ogg/raw.")
    local_name = f"{uuid.uuid4().hex}.{ext}"
    local_path = os.path.join(UPLOAD_DIR, local_name)
    content = await file.read()
    with open(local_path, "wb") as f:
        f.write(content)
    audio_url = f"{PUBLIC_BASE_URL.rstrip('/')}/uploads/{local_name}"

    task_id = str(uuid.uuid4())
    headers = {
        "Content-Type": "application/json",
        "X-Api-App-Key": VOLC_APP_KEY,
        "X-Api-Access-Key": VOLC_ACCESS_KEY,
        "X-Api-Resource-Id": VOLC_RESOURCE_ID,
        "X-Api-Request-Id": task_id,
        "X-Api-Sequence": "-1",
    }

    hotwords = ["FastAPI", "uvicorn", "WebSocket", "TypeScript", "React", "Vite", "ASR", "API", "JSON", "HTTP", "CORS"]
    body = {
        "user": {"uid": "demo"},
        "audio": {"url": audio_url, "format": ext},
        "request": {
            "model_name": "bigmodel",
            "model_version": "400",
            "enable_itn": True,
            "enable_punc": True,
            "enable_ddc": False,
            "show_utterances": True,
            "enable_speaker_info": True,
            "corpus": {
                "context": json.dumps({"hotwords": [{"word": w} for w in hotwords]}, ensure_ascii=False)
            }
        }
    }

    payload, resp_headers = _volc_request(VOLC_SUBMIT_URL, headers, body)
    logid = resp_headers.get("X-Tt-Logid") or resp_headers.get("x-tt-logid") or ""
    TASK_LOGID[task_id] = logid
    status_code = resp_headers.get("X-Api-Status-Code") or resp_headers.get("x-api-status-code")
    message = resp_headers.get("X-Api-Message") or resp_headers.get("x-api-message")
    return {"task_id": task_id, "logid": logid, "status_code": status_code, "message": message, "audio_url": audio_url, "payload": payload}

@app.post("/api/asr/auc/query")
async def auc_query(request: AucQueryRequest):
    _require_volc_creds()
    task_id = request.task_id
    headers = {
        "Content-Type": "application/json",
        "X-Api-App-Key": VOLC_APP_KEY,
        "X-Api-Access-Key": VOLC_ACCESS_KEY,
        "X-Api-Resource-Id": VOLC_RESOURCE_ID,
        "X-Api-Request-Id": task_id,
    }
    logid = TASK_LOGID.get(task_id)
    if logid:
        headers["X-Tt-Logid"] = logid
    payload, resp_headers = _volc_request(VOLC_QUERY_URL, headers, {})
    status_code = resp_headers.get("X-Api-Status-Code") or resp_headers.get("x-api-status-code")
    message = resp_headers.get("X-Api-Message") or resp_headers.get("x-api-message")
    full_text, segments = _extract_segments_from_auc_result(payload)
    return {"task_id": task_id, "logid": resp_headers.get("X-Tt-Logid") or resp_headers.get("x-tt-logid") or logid, "status_code": status_code, "message": message, "text": full_text, "segments": segments, "raw": payload}

class ASRCallback(RecognitionCallback):
    def __init__(self, websocket: WebSocket, loop: asyncio.AbstractEventLoop):
        self.websocket = websocket
        self.loop = loop
        self.last_text_time = time.time()
        self.context_buffer = deque() # Stores (timestamp, text)
        self.suggestion_generated = False
        self.generating = False
        self.is_paused = False # New flag to track pause state

    def on_open(self) -> None:
        print("ASR Session opened")
        self.last_text_time = time.time()

    def on_close(self) -> None:
        print("ASR Session closed")

    def on_event(self, result: RecognitionResult) -> None:
        # Send the result back to the client via WebSocket
        try:
            sentence = result.get_sentence()
            # DEBUG LOGGING for Speaker Diarization
            print(f"[DEBUG] Raw sentence data: {sentence}")
            if hasattr(sentence, '__dict__'):
                print(f"[DEBUG] Sentence attrs: {sentence.__dict__}")
            
            # Robustly extract text
            text = ""
            if isinstance(sentence, dict):
                text = sentence.get('text', str(sentence))
            elif hasattr(sentence, 'text'):
                text = sentence.text
            else:
                text = str(sentence)
            
            # Update activity time if text is meaningful
            if text and text.strip():
                self.last_text_time = time.time()
                # If user speaks again, we reset the suggestion flag so we can generate again next silence
                self.suggestion_generated = False

            # Robustly extract is_final
            is_final = False
            try:
                # Based on previous error: "missing 1 required positional argument: 'sentence'"
                # It seems is_sentence_end method requires the sentence object.
                if hasattr(result, 'is_sentence_end'):
                    is_final = result.is_sentence_end(sentence)
            except Exception as e:
                print(f"Error checking is_final: {e}")
                # Fallback: check if 'is_sentence_end' is in sentence dict if it is a dict
                if isinstance(sentence, dict):
                     is_final = sentence.get('is_sentence_end', False)

            # Extract speaker if available
            speaker = None
            try:
                if isinstance(sentence, dict):
                    speaker = sentence.get('speaker_id') or sentence.get('speaker')
                elif hasattr(sentence, 'speaker_id'):
                    speaker = sentence.speaker_id
                elif hasattr(sentence, 'speaker'):
                    speaker = sentence.speaker
            except Exception:
                pass

            if is_final and text.strip():
                # Add to context buffer
                self.context_buffer.append((time.time(), text))
                # Prune older than 3 minutes (180 seconds)
                now = time.time()
                while self.context_buffer and now - self.context_buffer[0][0] > 180:
                    self.context_buffer.popleft()

            payload = {
                "type": "transcript", # Explicit type
                "text": text,
                "is_final": is_final,
                "speaker": speaker
            }
            # Schedule the coroutine in the main event loop
            asyncio.run_coroutine_threadsafe(
                self.websocket.send_text(json.dumps(payload)),
                self.loop
            )
        except Exception as e:
            print(f"Error in on_event: {e}")

    def on_complete(self) -> None:
        print("ASR Session completed")

    def on_error(self, result: RecognitionResult) -> None:
        print(f"ASR Error: {result.message}")
        asyncio.run_coroutine_threadsafe(
            self.websocket.send_text(json.dumps({"type": "error", "error": result.message})),
            self.loop
        )

async def generate_suggestion(callback: ASRCallback):
    callback.generating = True
    try:
        # 1. Send "Thinking" status
        await callback.websocket.send_json({"type": "status", "content": "thinking"})
        
        # 2. Get context
        context_text = " ".join([text for _, text in callback.context_buffer])
        if not context_text:
             # If no context, maybe don't generate? Or generate a generic starter?
             # User requirement: "Based on following dialogue context..."
             # If empty, let's skip or provide generic.
             context_text = "（对话刚开始）"

        # 3. Call LLM
        prompt = f"基于以下对话上下文，生成一个能自然延续话题的开放式问题：[{context_text}]。要求问题：1) 包含前文提到的关键信息 2) 字数限制在20字内 3) 避免是非问句"
        
        # Retry logic (3 times / 5s interval)
        for attempt in range(3):
            try:
                # Use async client if possible? OpenAI python client is sync by default unless AsyncOpenAI used.
                # But here we initialized sync client. 
                # Ideally should use AsyncOpenAI.
                # Since we are in async function, sync call will block the loop.
                # Let's switch to AsyncOpenAI or run in executor.
                # For simplicity and speed, let's just wrap in run_in_executor or use AsyncOpenAI.
                # I'll use AsyncOpenAI to be proper.
                
                async_client = openai.AsyncOpenAI(
                    api_key=os.getenv("GEMINI_API_KEY"),
                    base_url=os.getenv("GEMINI_BASE_URL", "https://aihubmix.com/v1")
                )

                stream = await async_client.chat.completions.create(
                    model="gemini-3-flash-preview",
                    messages=[{"role": "user", "content": prompt}],
                    stream=True
                )
                
                # Stream response
                full_suggestion = ""
                async for chunk in stream:
                    content = chunk.choices[0].delta.content
                    if content:
                        full_suggestion += content
                        # Simulate typing speed (3-5 chars/sec) -> ~200-300ms delay per char
                        # But LLM returns tokens (often words or chars).
                        # Let's just send it. The UI can animate or we delay here.
                        # User requirement: "Word-by-word streaming rendering (3-5 Chinese characters per second)"
                        # To strictly enforce 3-5 chars/sec, we need a buffer and a timer.
                        # Let's try simple delay first.
                        await callback.websocket.send_json({"type": "suggestion_delta", "content": content})
                        await asyncio.sleep(0.1) 
                
                await callback.websocket.send_json({"type": "suggestion_end"})
                callback.suggestion_generated = True
                break # Success
            except Exception as e:
                print(f"Gen Error (Attempt {attempt+1}): {e}")
                if attempt < 2:
                    await asyncio.sleep(5)
                else:
                    await callback.websocket.send_json({"type": "error", "content": "无法生成提问"})

    except Exception as e:
        print(f"Suggestion Fatal Error: {e}")
    finally:
        callback.generating = False

async def monitor_silence(callback: ASRCallback):
    print("Silence monitor started")
    try:
        while True:
            await asyncio.sleep(0.5)
            # Check if websocket is closed?
            # Accessing callback.websocket might throw if closed? 
            # Or use a flag in callback.
            
            now = time.time()
            # Logic: If > 3.5s silence AND not already generated AND not currently generating AND not paused
            if (now - callback.last_text_time > 3.5) and (not callback.suggestion_generated) and (not callback.generating) and (not callback.is_paused):
                print(f"Silence detected ({now - callback.last_text_time:.1f}s), triggering suggestion...")
                asyncio.create_task(generate_suggestion(callback))
                
    except asyncio.CancelledError:
        print("Silence monitor cancelled")
    except Exception as e:
        print(f"Silence monitor error: {e}")

@app.websocket("/ws/asr")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_running_loop()
    
    callback = ASRCallback(websocket, loop)
    monitor_task = asyncio.create_task(monitor_silence(callback))
    
    # Initialize Recognition
    # format='pcm' expects raw PCM data (S16LE usually)
    # sample_rate=16000 is standard for ASR
    recognition = Recognition(
        model='fun-asr-realtime',
        format='pcm',
        sample_rate=16000,
        callback=callback,
        enable_speaker_diarization=True # Attempt to enable speaker diarization
    )
    
    try:
        recognition.start()
        print("ASR started")
        
        while True:
            message = await websocket.receive()
            if "bytes" in message:
                data = message["bytes"]
                # Send audio data to DashScope
                if not callback.is_paused:
                    recognition.send_audio_frame(data)
            elif "text" in message:
                try:
                    text_data = json.loads(message["text"])
                    if text_data.get("type") == "pause":
                        callback.is_paused = True
                        print("Recording paused")
                    elif text_data.get("type") == "resume":
                        callback.is_paused = False
                        callback.last_text_time = time.time() # Reset timer on resume
                        print("Recording resumed")
                except json.JSONDecodeError:
                    pass
            else:
                break
                
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket Error: {e}")
    finally:
        recognition.stop()
        monitor_task.cancel()
        print("ASR stopped")


@app.get("/")
def read_root():
    return {"status": "ok", "service": "Meeting Tensor ASR Backend"}

import os
import json
import asyncio
import time
import uuid
import base64
import threading
import hashlib
import shutil
import subprocess
import ssl
from collections import deque
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import openai
from loguru import logger
import oss2
import requests
import websocket # websocket-client for Qwen Realtime
import dashscope
from dashscope.audio.asr import Transcription

# --- 加载环境变量 ---
from dotenv import load_dotenv
# Explicitly load .env.local from project root
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.local")
load_dotenv(dotenv_path=env_path)
# Also load .env if it exists (for compatibility)
load_dotenv()

# Check API Key
if not os.getenv("DASHSCOPE_API_KEY"):
    logger.error("DASHSCOPE_API_KEY is missing!")
else:
    key = os.getenv("DASHSCOPE_API_KEY")
    logger.info(f"DASHSCOPE_API_KEY loaded: {key[:6]}******")

# --- 日志配置 ---
LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
logger.add(os.path.join(LOG_DIR, "server_{time:YYYYMMDD_HHmm}.log"), rotation="1 day", retention="7 days", level="INFO")

# --- SDK 配置 ---
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
dashscope.api_key = DASHSCOPE_API_KEY

# 配置 OpenAI 客户端 (用于 Gemini LLM 对话)
client = openai.OpenAI(
    api_key=os.getenv("GEMINI_API_KEY"),
    base_url=os.getenv("GEMINI_BASE_URL")
)

# --- 阿里云 OSS 配置 ---
OSS_ACCESS_KEY_ID = os.getenv("ALIYUN_ACCESS_KEY_ID")
OSS_ACCESS_KEY_SECRET = os.getenv("ALIYUN_ACCESS_KEY_SECRET")
OSS_BUCKET_NAME = os.getenv("ALIYUN_OSS_BUCKET")
OSS_ENDPOINT = os.getenv("ALIYUN_OSS_ENDPOINT")

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

from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, relationship

# ... (Existing imports)

# --- Database Setup (SQLite + SQLAlchemy) ---
# Create a local SQLite database file
SQLALCHEMY_DATABASE_URL = "sqlite:///./meetings.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Database Models ---

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    date = Column(String)  # YYYY-MM-DD
    time = Column(String)  # HH:MM
    duration = Column(String) # 00:00
    file_url = Column(String) # OSS URL
    created_at = Column(DateTime, default=datetime.now)
    type = Column(String, default="product") # meeting type

    # Relationship to segments
    segments = relationship("Segment", back_populates="meeting", cascade="all, delete-orphan")

class Segment(Base):
    __tablename__ = "segments"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"))
    content = Column(Text)
    speaker = Column(String)
    start_time = Column(String)
    end_time = Column(String)
    emotion = Column(String, nullable=True)

    meeting = relationship("Meeting", back_populates="segments")

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ... (Existing code)
def get_oss_bucket():
    if not all([OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET_NAME, OSS_ENDPOINT]):
        logger.error("Missing Aliyun OSS configuration")
        raise HTTPException(status_code=500, detail="Missing Aliyun OSS configuration")
    
    auth = oss2.Auth(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET)
    return oss2.Bucket(auth, OSS_ENDPOINT, OSS_BUCKET_NAME)

def calculate_file_hash(content: bytes) -> str:
    return hashlib.md5(content).hexdigest()

def calculate_file_hash_from_file(file_path: str) -> str:
    h = hashlib.md5()
    with open(file_path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()

def ensure_mono_wav(input_path: str, base_hash: str) -> str:
    mono_path = os.path.join(UPLOAD_DIR, f"{base_hash}_mono.wav")
    if os.path.exists(mono_path):
        return mono_path
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        raise HTTPException(status_code=500, detail="ffmpeg 未安装，无法生成单声道音频用于发言人分离")
    subprocess.run(
        [ffmpeg_path, "-y", "-i", input_path, "-vn", "-ac", "1", "-ar", "16000", mono_path],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )
    return mono_path

def append_debug_line(text: str) -> None:
    if os.getenv("ASR_DEBUG") != "1":
        return
    debug_path = os.path.join(LOG_DIR, "debug_asr_urls.log")
    with open(debug_path, "a", encoding="utf-8") as f:
        f.write(text.rstrip("\n") + "\n")

def upload_to_oss(local_path: str, filename: str, file_hash: str) -> str:
    try:
        bucket = get_oss_bucket()
        # Use hash in object key for deduplication
        key = f"uploads/{file_hash}_{filename}"
        
        # Check if file exists in OSS
        if bucket.object_exists(key):
            logger.info(f"File exists in OSS, skipping upload: {key}")
        else:
            logger.info(f"Uploading {filename} to OSS as {key}")
            bucket.put_object_from_file(key, local_path)
        
        # Generate signed URL (valid for 12 hours to avoid expiration during long transcription)
        url = bucket.sign_url("GET", key, 43200).replace("http://", "https://")
        logger.info(f"Generated signed URL: {url.split('?')[0]}")
        return url
    except Exception as e:
        logger.error(f"OSS Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"OSS Upload failed: {str(e)}")

# --- FunASR (Paraformer) File Transcription ---

def transcribe_with_fun_asr(file_url: str):
    logger.info(f"Submitting FunASR (fun-asr) task for {file_url.split('?')[0]}")
    
    try:
        task_response = Transcription.async_call(
            model='fun-asr',
            file_urls=[file_url],
            diarization_enabled=True,
            timestamp_alignment_enabled=True,
            channel_id=[0],
        )
        
        if task_response.status_code != 200:
             logger.error(f"FunASR Submit Failed: {task_response.code} {task_response.message}")
             raise Exception(f"FunASR Submit Failed: {task_response.message}")

        task_id = task_response.output.task_id
        logger.info(f"FunASR Task Submitted: {task_id}")
        
        # Wait for result
        status_response = Transcription.wait(task=task_id)
        
        if status_response.status_code == 200:
            status = status_response.output.task_status
            if status == 'SUCCEEDED':
                logger.info(f"FunASR Task SUCCEEDED: {task_id}")
                return status_response.output
            else:
                logger.error(f"FunASR Task Failed: {status} - {status_response.output.message}")
                raise Exception(f"FunASR Task Failed: {status_response.output.message}")
        else:
             logger.error(f"FunASR Wait Failed: {status_response.code}")
             raise Exception(f"FunASR Wait Failed: {status_response.message}")

    except Exception as e:
        logger.error(f"FunASR Transcription Error: {e}")
        raise e

def _safe_url(url: str) -> str:
    return url.split("?")[0]

def _result_items_from_task_output(output: dict) -> list[dict]:
    if not isinstance(output, dict):
        return []

    results = output.get("results")
    if isinstance(results, list) and results:
        return [item for item in results if isinstance(item, dict)]

    result = output.get("result")
    if isinstance(result, list):
        return [item for item in result if isinstance(item, dict)]
    if isinstance(result, dict):
        return [result]
    if isinstance(result, str) and result:
        return [{"result_url": result}]
    return []

def _transcription_url_from_item(item: dict) -> str | None:
    if not isinstance(item, dict):
        return None
    url = item.get("transcription_url") or item.get("result_url") or item.get("url")
    if isinstance(url, str) and url:
        return url
    return None

def _extract_sentences_from_transcription_payload(payload: dict) -> list[dict]:
    if not isinstance(payload, dict):
        return []

    # Priority 1: transcripts structure (Qwen3 ASR standard)
    transcripts = payload.get("transcripts")
    if isinstance(transcripts, list):
        for t in transcripts:
            if not isinstance(t, dict): continue
            
            # Check for sentences (with speaker_id)
            sentences = t.get("sentences")
            if isinstance(sentences, list):
                return sentences
                
            # Fallback to other fields
            if isinstance(t.get("segments"), list): return t.get("segments")
            if isinstance(t.get("utterances"), list):
                # Map utterances to sentence-like structure
                return [{"text": u.get("text", ""), "begin_time": u.get("start_time"), "end_time": u.get("end_time"), "speaker_id": u.get("speaker_id")} 
                        for u in t["utterances"] if isinstance(u, dict)]

    # Priority 2: Direct sentences field
    if isinstance(payload.get("sentences"), list):
        return payload.get("sentences")

    # Priority 3: Nested output/result structures (Compatibility)
    output = payload.get("output")
    if isinstance(output, dict):
        if isinstance(output.get("sentences"), list): return output["sentences"]
        if isinstance(output.get("results"), list):
            for item in output["results"]:
                if isinstance(item, dict) and isinstance(item.get("sentences"), list):
                    return item["sentences"]

    # Priority 4: result.utterances (Paraformer style)
    result = payload.get("result")
    if isinstance(result, dict) and isinstance(result.get("utterances"), list):
        return [{"text": u.get("text", ""), "begin_time": u.get("start_time"), "end_time": u.get("end_time"), "speaker_id": u.get("speaker_id")} 
                for u in result["utterances"] if isinstance(u, dict)]

    return []

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Depends
from sqlalchemy.orm import Session

# ... (Existing imports)

# ... (Database Models and Setup)

# ... (OSS and Helper Functions)

@app.get("/api/meetings")
def get_meetings(db: Session = Depends(get_db)):
    meetings = db.query(Meeting).order_by(Meeting.created_at.desc()).all()
    # Transform to frontend format
    result = []
    for m in meetings:
        # Get last segment for duration calc if needed, or use stored duration
        result.append({
            "id": str(m.id),
            "title": m.title,
            "date": m.date,
            "time": m.time,
            "duration": m.duration,
            "type": m.type,
            "host": "未知发言人" # Could derive from first speaker
        })
    return result

@app.get("/api/meetings/{meeting_id}")
def get_meeting_detail(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    segments = []
    for idx, seg in enumerate(meeting.segments):
        segments.append({
            "id": f"seg-{seg.id}",
            "type": "user",
            "content": seg.content,
            "startTime": seg.start_time,
            "endTime": seg.end_time,
            "speaker": seg.speaker,
            "emotion": seg.emotion
        })
        
    return {
        "id": str(meeting.id),
        "title": meeting.title,
        "segments": segments,
        "file_url": meeting.file_url
    }

@app.post("/api/asr/file")
async def file_transcribe(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename or "audio.wav"
    # ... (Existing hash and upload logic)
    ext = os.path.splitext(filename)[1].lower().lstrip(".") or "wav"
    content = await file.read()
    file_hash = calculate_file_hash(content)
    local_name = f"{file_hash}.{ext}"
    local_path = os.path.join(UPLOAD_DIR, local_name)
    
    if os.path.exists(local_path):
        logger.info(f"File exists locally: {local_name}")
    else:
        with open(local_path, "wb") as f:
            f.write(content)
            
    try:
        mono_path = ensure_mono_wav(local_path, file_hash)
        mono_hash = calculate_file_hash_from_file(mono_path)
        mono_filename = f"{os.path.splitext(filename)[0]}_mono.wav"

        asr_url = upload_to_oss(mono_path, mono_filename, mono_hash)
        
        # 2. Submit FunASR Task and Wait for Result (Synchronous wait inside)
        output = transcribe_with_fun_asr(asr_url)
        task_id = output.task_id
        
        # 3. Parse Result
        # FunASR/Paraformer result parsing
        
        # Check for transcription_url (large file)
        transcription_url = None
        results = output.get("results")
        if results and len(results) > 0:
            first_res = results[0]
            transcription_url = first_res.get("transcription_url")
        
        transcription_payload = None
        if transcription_url:
            logger.info(f"Fetching transcription json: {_safe_url(transcription_url)}")
            append_debug_line(f"task_id={task_id}\ttranscription_url={_safe_url(transcription_url)}")
            r = requests.get(transcription_url, timeout=30); r.raise_for_status()
            transcription_payload = r.json()
        elif results:
            transcription_payload = {"results": results} # Wrap to match structure
        else:
             # Fallback
             transcription_payload = output
            
        sentences = _extract_sentences_from_transcription_payload(transcription_payload or {})

        if os.getenv("ASR_DEBUG") == "1":
            first_keys = list(sentences[0].keys()) if sentences and isinstance(sentences[0], dict) else []
            speaker_ids = []
            for s in sentences:
                if not isinstance(s, dict):
                    continue
                if "speaker_id" in s and s.get("speaker_id") is not None:
                    speaker_ids.append(s.get("speaker_id"))
            append_debug_line(f"task_id={task_id}\tsentences={len(sentences)}\tspeaker_id_count={len(speaker_ids)}\tunique_speakers={sorted(set(speaker_ids))[:20]}\tfirst_sentence_keys={first_keys}")
        
        if not sentences:
             logger.error(f"No sentences found. task_id={task_id} keys={list(output.keys())}")
             # Don't raise error immediately, allow empty meeting? No, better raise.
             # raise HTTPException(status_code=500, detail={"msg": "转写结果为空", "task_id": task_id})
        
        # 4. Save to Database
        now = datetime.now()
        duration_str = "00:00"
        if sentences:
            last_end = sentences[-1].get("end_time")
            duration_str = _ms_to_mmss(last_end) or "00:00"

        new_meeting = Meeting(
            title=os.path.splitext(filename)[0],
            date=now.strftime("%Y-%m-%d"),
            time=now.strftime("%H:%M"),
            duration=duration_str,
            file_url=asr_url,
            type="product" # Default type
        )
        db.add(new_meeting)
        db.commit()
        db.refresh(new_meeting)
        
        db_segments = []
        frontend_segments = []
        
        for idx, sent in enumerate(sentences):
            start = _ms_to_mmss(sent.get("begin_time"))
            end = _ms_to_mmss(sent.get("end_time"))
            
            # Extract speaker_id safely
            # Note: DashScope FunASR usually returns 'speaker_id' as integer (0, 1, etc.)
            spk_id = sent.get("speaker_id")
            if spk_id is None:
                spk_id = sent.get("speaker") # Fallback
            
            if spk_id is not None:
                speaker = f"Speaker {spk_id}"
            else:
                speaker = "unknown_speaker_default" # Will be shown as "未知发言人" in frontend
            
            # DB Object
            seg = Segment(
                meeting_id=new_meeting.id,
                content=sent.get("text", ""),
                speaker=speaker,
                start_time=start,
                end_time=end,
                emotion=sent.get("emotion_tag")
            )
            db_segments.append(seg)
            
            # Frontend Object
            frontend_segments.append({
                "id": f"seg-{idx}",
                "type": "user",
                "content": seg.content,
                "startTime": start,
                "endTime": end,
                "speaker": speaker,
                "emotion": seg.emotion
            })
            
        db.add_all(db_segments)
        db.commit()

        return {
            "task_id": task_id,
            "status": "succeeded",
            "meeting_id": str(new_meeting.id), # Return DB ID
            "segments": frontend_segments
        }
        
    except Exception as e:
        logger.error(f"File Transcription Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _ms_to_mmss(ms: int | None) -> str | None:
    if ms is None:
        return None
    seconds = max(0, int(ms // 1000))
    m = seconds // 60
    s = seconds % 60
    return f"{m:02d}:{s:02d}"

# --- Qwen3 Realtime ASR (WebSocket) ---

class QwenRealtimeClient:
    def __init__(self, frontend_ws: WebSocket, loop: asyncio.AbstractEventLoop):
        self.frontend_ws = frontend_ws
        self.loop = loop
        self.ws = None
        self.is_connected = False
        self.thread = None
        
        # Buffer for suggestions
        self.context_buffer = deque()
        self.last_text_time = time.time()
        self.suggestion_generated = False
        self.generating = False
        self.is_paused = False
        self.model = "qwen3-asr-flash-realtime"
        self._seen_types: set[str] = set()

    def connect(self):
        url = f"wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model={self.model}"
        headers = [
            f"Authorization: Bearer {DASHSCOPE_API_KEY}",
            "OpenAI-Beta: realtime=v1"
        ]
        logger.info(f"Connecting to Qwen Realtime API: {url}")
        self.ws = websocket.WebSocketApp(
            url,
            header=headers,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        self.thread = threading.Thread(
            target=self.ws.run_forever, 
            kwargs={"sslopt": {"cert_reqs": ssl.CERT_NONE}}
        )
        self.thread.start()

    def on_open(self, ws):
        logger.info("[QwenWS] Connected to Aliyun")
        self.is_connected = True
        
        # Init Session
        session_event = {
            "event_id": f"event_{int(time.time() * 1000)}",
            "type": "session.update",
            "session": {
                "modalities": ["text"],
                "input_audio_format": "pcm",
                "sample_rate": 16000,
                "input_audio_transcription": {
                    "language": "zh"
                },
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.2,
                    "silence_duration_ms": 800
                }
            }
        }
        ws.send(json.dumps(session_event))

    def on_message(self, ws, message):
        try:
            data = json.loads(message)
            event_type = data.get("type")
            if isinstance(event_type, str) and event_type and event_type not in self._seen_types:
                self._seen_types.add(event_type)
                logger.info(f"[QwenWS] Event type: {event_type}")
            
            # Handle transcription events
            # Note: Actual event names depend on Qwen Realtime protocol (similar to OpenAI Realtime)
            # Adjust these based on actual response structure
            if isinstance(event_type, str):
                if event_type in ("response.audio_transcript.delta", "response.audio_transcript.done"):
                    if event_type.endswith(".delta"):
                        text = data.get("delta", "")
                        if isinstance(text, str) and text:
                            self.current_sentence_partial += text
                            self._send_to_frontend(self.current_sentence_partial, is_final=False)
                    else:
                        text = data.get("transcript", "")
                        self.current_sentence_partial = ""
                        if isinstance(text, str) and text:
                            self._send_to_frontend(text, is_final=True)
                            self.context_buffer.append((time.time(), text))
                            self.last_text_time = time.time()
                            self.suggestion_generated = False
                elif "transcript" in event_type:
                    text = data.get("delta") if event_type.endswith(".delta") else (data.get("transcript") or data.get("text"))
                    if isinstance(text, str) and text:
                        is_final = bool(event_type.endswith(".done") or event_type.endswith(".completed"))
                        self._send_to_frontend(text, is_final=is_final)
                        if is_final:
                            self.context_buffer.append((time.time(), text))
                            self.last_text_time = time.time()
                            self.suggestion_generated = False
            
            # Fallback/Other event types handling...
            
        except Exception as e:
            logger.error(f"Message parse error: {e}")

    def on_error(self, ws, error):
        logger.error(f"[QwenWS] Error: {error}")
        self.is_connected = False

    def on_close(self, ws, *args):
        logger.info("[QwenWS] Closed")
        self.is_connected = False

    def send_audio(self, audio_bytes: bytes):
        if not self.is_connected: return
        
        # Encode audio to base64
        encoded = base64.b64encode(audio_bytes).decode("utf-8")
        event = {
            "event_id": f"event_{int(time.time() * 1000)}",
            "type": "input_audio_buffer.append",
            "audio": encoded
        }
        self.ws.send(json.dumps(event))

    def close(self):
        if self.ws:
            self.ws.close()
        self.is_connected = False

    def _send_to_frontend(self, text: str, is_final: bool):
        payload = {
            "type": "transcript",
            "text": text,
            "is_final": is_final,
            "speaker": None # Realtime might not give speaker ID instantly
        }
        asyncio.run_coroutine_threadsafe(
            self.frontend_ws.send_text(json.dumps(payload)),
            self.loop
        )

# --- 智能建议 (Suggestion) ---
async def generate_suggestion(client: QwenRealtimeClient):
    # Safe check for connection
    if not client.is_connected:
        return

    client.generating = True
    try:
        await client.frontend_ws.send_json({"type": "status", "content": "thinking"})
        context_text = " ".join([text for _, text in client.context_buffer]) or "（对话刚开始）"
        prompt = f"基于以下对话上下文，生成一个能自然延续话题的开放式问题：[{context_text}]。要求问题：1) 包含前文提到的关键信息 2) 字数限制在20字内 3) 避免是非问句"
        
        async_client = openai.AsyncOpenAI(
            api_key=os.getenv("GEMINI_API_KEY"),
            base_url=os.getenv("GEMINI_BASE_URL")
        )

        stream = await async_client.chat.completions.create(
            model="gemini-3-flash-preview",
            messages=[{"role": "user", "content": prompt}],
            stream=True
        )
        
        async for chunk in stream:
            # Check connection again during streaming
            if not client.is_connected: break
            
            content = chunk.choices[0].delta.content
            if content:
                await client.frontend_ws.send_json({"type": "suggestion_delta", "content": content})
                await asyncio.sleep(0.1)
        
        if client.is_connected:
            await client.frontend_ws.send_json({"type": "suggestion_end"})
            client.suggestion_generated = True

    except Exception as e:
        logger.error(f"Suggestion Error: {e}")
    finally:
        client.generating = False

async def monitor_silence(client: QwenRealtimeClient):
    logger.info("Silence monitor started")
    try:
        while True:
            await asyncio.sleep(0.5)
            # Check if frontend is still connected (implied by loop running)
            # But client.is_connected refers to Backend<->Aliyun
            # We care about Backend<->Frontend for sending suggestions
            
            now = time.time()
            if (now - client.last_text_time > 3.5) and (not client.suggestion_generated) and (not client.generating) and (not client.is_paused) and len(client.context_buffer) > 0:
                if client.is_connected: # Only trigger if session is active
                    logger.info("Silence detected, triggering suggestion...")
                    asyncio.create_task(generate_suggestion(client))
    except asyncio.CancelledError:
        logger.info("Silence monitor cancelled")

@app.websocket("/ws/asr")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("Frontend WebSocket connection attempt...")
    await websocket.accept()
    logger.info("Frontend WebSocket connected.")
    loop = asyncio.get_running_loop()
    
    # Init Qwen Client
    qwen_client = QwenRealtimeClient(websocket, loop)
    qwen_client.connect()
    
    # Start Monitor
    monitor_task = asyncio.create_task(monitor_silence(qwen_client))
    
    try:
        while True:
            message = await websocket.receive()
            if "bytes" in message:
                if not qwen_client.is_paused:
                    qwen_client.send_audio(message["bytes"])
            elif "text" in message:
                try:
                    text_data = json.loads(message["text"])
                    if text_data.get("type") == "pause":
                        qwen_client.is_paused = True
                    elif text_data.get("type") == "resume":
                        qwen_client.is_paused = False
                        qwen_client.last_text_time = time.time()
                except:
                    pass
            else:
                break
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket Handler Error: {e}")
    finally:
        qwen_client.close()
        monitor_task.cancel()

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Meeting Qwen3 ASR Backend"}

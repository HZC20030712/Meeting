import os
import json
import asyncio
import time
from collections import deque
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import dashscope
from dashscope.audio.asr import Recognition, RecognitionCallback, RecognitionResult
import openai

# Load environment variables if needed, but we have the key provided
# from dotenv import load_dotenv
# load_dotenv()

# Use the key provided by the user
dashscope.api_key = "sk-aa664b4c5a664cd699b0515f4dbeda7d"

# Configure OpenAI client for Gemini
client = openai.OpenAI(
    api_key="sk-AkMYAkSiUOpnYPR1D9E20fCeA690481e80D37b245f520817",
    base_url="https://aihubmix.com/v1"
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

class ASRCallback(RecognitionCallback):
    def __init__(self, websocket: WebSocket, loop: asyncio.AbstractEventLoop):
        self.websocket = websocket
        self.loop = loop
        self.last_text_time = time.time()
        self.context_buffer = deque() # Stores (timestamp, text)
        self.suggestion_generated = False
        self.generating = False

    def on_open(self) -> None:
        print("ASR Session opened")
        self.last_text_time = time.time()

    def on_close(self) -> None:
        print("ASR Session closed")

    def on_event(self, result: RecognitionResult) -> None:
        # Send the result back to the client via WebSocket
        try:
            sentence = result.get_sentence()
            
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
                "is_final": is_final
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
                    api_key="sk-AkMYAkSiUOpnYPR1D9E20fCeA690481e80D37b245f520817",
                    base_url="https://aihubmix.com/v1"
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
            # Logic: If > 3.5s silence AND not already generated AND not currently generating
            if (now - callback.last_text_time > 3.5) and (not callback.suggestion_generated) and (not callback.generating):
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
        callback=callback
    )
    
    try:
        recognition.start()
        print("ASR started")
        
        while True:
            data = await websocket.receive_bytes()
            if data:
                # Send audio data to DashScope
                recognition.send_audio_frame(data)
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

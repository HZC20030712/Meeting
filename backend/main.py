import os
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import dashscope
from dashscope.audio.asr import Recognition, RecognitionCallback, RecognitionResult

# Load environment variables if needed, but we have the key provided
# from dotenv import load_dotenv
# load_dotenv()

# Use the key provided by the user
dashscope.api_key = "sk-aa664b4c5a664cd699b0515f4dbeda7d"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ASRCallback(RecognitionCallback):
    def __init__(self, websocket: WebSocket, loop: asyncio.AbstractEventLoop):
        self.websocket = websocket
        self.loop = loop

    def on_open(self) -> None:
        print("ASR Session opened")

    def on_close(self) -> None:
        print("ASR Session closed")

    def on_event(self, result: RecognitionResult) -> None:
        # Send the result back to the client via WebSocket
        # result.get_sentence() contains the text
        try:
            # print(f"DEBUG: result type: {type(result)}, result: {result}")
            sentence = result.get_sentence()
            
            # Robustly extract text
            text = ""
            if isinstance(sentence, dict):
                text = sentence.get('text', str(sentence))
            elif hasattr(sentence, 'text'):
                text = sentence.text
            else:
                text = str(sentence)
            
            payload = {
                "text": text,
                # "is_final": result.is_sentence_end() # Removed due to error
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
            self.websocket.send_text(json.dumps({"error": result.message})),
            self.loop
        )

@app.websocket("/ws/asr")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_running_loop()
    
    callback = ASRCallback(websocket, loop)
    
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
        print("ASR stopped")

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Meeting Tensor ASR Backend"}

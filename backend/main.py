import os
import json
import asyncio
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

    def on_open(self) -> None:
        print("ASR Session opened")

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

            payload = {
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

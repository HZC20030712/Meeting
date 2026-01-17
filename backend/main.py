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
import wave
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
load_dotenv()

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
SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'meetings.db')}"

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
    analysis_result = Column(Text, nullable=True) # JSON string for analysis result
    chapters = Column(Text, nullable=True) # JSON string for smart chapters
    summary = Column(Text, nullable=True) # Full summary text
    keywords = Column(Text, nullable=True) # JSON list of keywords
    
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

from sqlalchemy import text

# 2. Check if 'chapters' column exists, if not add it
try:
    with engine.connect() as conn:
        conn.execute(text("SELECT chapters FROM meetings LIMIT 1"))
except Exception:
    logger.info("Adding 'chapters' column to meetings table")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE meetings ADD COLUMN chapters TEXT"))

# 3. Check if 'summary' column exists
try:
    with engine.connect() as conn:
        conn.execute(text("SELECT summary FROM meetings LIMIT 1"))
except Exception:
    logger.info("Adding 'summary' column to meetings table")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE meetings ADD COLUMN summary TEXT"))

# 4. Check if 'keywords' column exists
try:
    with engine.connect() as conn:
        conn.execute(text("SELECT keywords FROM meetings LIMIT 1"))
except Exception:
    logger.info("Adding 'keywords' column to meetings table")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE meetings ADD COLUMN keywords TEXT"))

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
    ordered_segments = (
        db.query(Segment)
        .filter(Segment.meeting_id == meeting_id)
        .order_by(Segment.id.asc())
        .all()
    )
    for seg in ordered_segments:
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
        "file_url": meeting.file_url,
        "analysis_result": json.loads(meeting.analysis_result) if meeting.analysis_result else None,
        "chapters": json.loads(meeting.chapters) if meeting.chapters else None,
        "summary": meeting.summary,
        "keywords": json.loads(meeting.keywords) if meeting.keywords else None
    }

class AnalysisRequest(BaseModel):
    speaker_map: dict[str, str] = {}
    ignored_speakers: list[str] = []
    preset_id: str
    custom_requirement: str = ""

@app.get("/api/presets")
def get_presets():
    try:
        preset_path = os.path.join(os.path.dirname(__file__), "presets.json")
        if not os.path.exists(preset_path):
             return []
        with open(preset_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load presets: {e}")
        return []

def load_prompt_file(filename: str) -> str:
    try:
        path = os.path.join(os.path.dirname(__file__), "prompts", filename)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        return ""
    except Exception as e:
        logger.error(f"Error loading prompt file {filename}: {e}")
        return ""

@app.post("/api/meetings/{meeting_id}/analysis")
async def analyze_meeting(meeting_id: int, request: AnalysisRequest, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # 1. Load Preset and Modular Prompts
    presets = get_presets()
    preset = next((p for p in presets if p["id"] == request.preset_id), None)
    if not preset:
        raise HTTPException(status_code=400, detail="Invalid preset_id")
    
    base_prompt = load_prompt_file("base.txt")
    skill_prompt = load_prompt_file(preset["skill_file"])
    
    # 2. Build Context
    transcript_text = ""
    for seg in meeting.segments:
        # Check ignore
        if seg.speaker in request.ignored_speakers:
            continue
            
        # Map Name
        display_name = request.speaker_map.get(seg.speaker, seg.speaker)
        
        # Format: [00:12] Speaker ID (Name): Content
        transcript_text += f"[{seg.start_time}] {seg.speaker} ({display_name}): {seg.content}\n"
    
    # 3. Build Final Prompt
    system_prompt = f"{base_prompt}\n\n---\n你的具体任务是：\n{skill_prompt}"
    if request.custom_requirement:
        system_prompt += f"\n\n---\n额外用户要求：\n{request.custom_requirement}"
        
    user_prompt = f"会议录音文本如下：\n{transcript_text}"
    
    # 4. Call Gemini (via OpenAI compatible client)
    try:
        # Using the existing 'client' which is configured for Gemini
        response = client.chat.completions.create(
            model="gemini-3-flash-preview", 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            # response_format={"type": "json_object"} # Ensure JSON output
        )
        
        content = response.choices[0].message.content
        # Clean markdown code blocks if present (Gemini sometimes adds them even if asked not to)
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
            
        # Validate JSON
        try:
            analysis_data = json.loads(content)
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from Gemini: {content}")
            raise HTTPException(status_code=500, detail="Analysis generation failed (Invalid JSON)")

        # 5. Save Result
        if request.preset_id == "chapters":
            meeting.chapters = json.dumps(analysis_data, ensure_ascii=False)
        elif request.preset_id == "full_summary":
            # Extract and save individual fields
            meeting.summary = analysis_data.get("abstract", "")
            meeting.keywords = json.dumps(analysis_data.get("keywords", []), ensure_ascii=False)
            
            # Save chapters separately
            chapters_data = {"chapters": analysis_data.get("chapters", [])}
            meeting.chapters = json.dumps(chapters_data, ensure_ascii=False)
            
            # Save speaker summaries and QA as analysis_result (or could be new columns)
            # For now, we wrap them in a specific structure compatible with frontend
            full_summary_result = {
                "mode": "full_summary",
                "speaker_summaries": analysis_data.get("speaker_summaries", []),
                "qa_pairs": analysis_data.get("qa_pairs", [])
            }
            meeting.analysis_result = json.dumps(full_summary_result, ensure_ascii=False)
            
        else:
            meeting.analysis_result = json.dumps(analysis_data, ensure_ascii=False)
        
        db.commit()
        
        return {"status": "success", "result": analysis_data}
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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

def process_realtime_recording(meeting_id: int, file_path: str):
    logger.info(f"Starting post-processing for meeting {meeting_id}, file: {file_path}")
    
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return

    db = SessionLocal()
    try:
        # 1. Standardize & Hash
        file_hash = calculate_file_hash_from_file(file_path)
        mono_path = ensure_mono_wav(file_path, file_hash)
        mono_hash = calculate_file_hash_from_file(mono_path)
        
        # 2. Upload to OSS
        filename = f"realtime_{meeting_id}.wav"
        oss_url = upload_to_oss(mono_path, filename, mono_hash)
        
        # Update Meeting URL immediately
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if meeting:
            meeting.file_url = oss_url
            db.commit()
            logger.info(f"Updated meeting {meeting_id} file_url: {oss_url}")
        else:
            logger.error(f"Meeting {meeting_id} not found during post-processing")
            return
        
        # 3. Offline Transcription (FunASR) with Diarization
        logger.info(f"Triggering offline transcription for meeting {meeting_id}")
        output = transcribe_with_fun_asr(oss_url)
        task_id = output.task_id
        
        # 4. Parse Result (Reuse logic)
        transcription_url = None
        results = output.get("results")
        if results and len(results) > 0:
            first_res = results[0]
            transcription_url = first_res.get("transcription_url")
        
        transcription_payload = None
        if transcription_url:
            logger.info(f"Fetching transcription json: {_safe_url(transcription_url)}")
            r = requests.get(transcription_url, timeout=30); r.raise_for_status()
            transcription_payload = r.json()
        elif results:
            transcription_payload = {"results": results}
        else:
             transcription_payload = output
            
        sentences = _extract_sentences_from_transcription_payload(transcription_payload or {})
        
        if not sentences:
             logger.warning(f"No sentences found in offline transcription for meeting {meeting_id}")
             return

        # 5. Replace Segments
        # Delete old realtime segments
        db.query(Segment).filter(Segment.meeting_id == meeting_id).delete()
        
        # Insert new segments
        new_segments = []
        for sent in sentences:
            start = _ms_to_mmss(sent.get("begin_time"))
            end = _ms_to_mmss(sent.get("end_time"))
            
            spk_id = sent.get("speaker_id")
            if spk_id is None: spk_id = sent.get("speaker")
            
            speaker = f"Speaker {spk_id}" if spk_id is not None else "未知发言人"
            
            seg = Segment(
                meeting_id=meeting_id,
                content=sent.get("text", ""),
                speaker=speaker,
                start_time=start,
                end_time=end,
                emotion=sent.get("emotion_tag")
            )
            new_segments.append(seg)
            
        db.add_all(new_segments)
        
        # Update duration again with precise time
        last_end = sentences[-1].get("end_time")
        duration_str = _ms_to_mmss(last_end) or "00:00"
        meeting.duration = duration_str
        
        db.commit()
        logger.info(f"Successfully re-processed meeting {meeting_id} with offline model ({len(new_segments)} segments)")
        
    except Exception as e:
        logger.error(f"Post-processing failed for meeting {meeting_id}: {e}")
        db.rollback()
    finally:
        db.close()
        # Optional: Clean up temp file? 
        # os.remove(file_path) 


# --- Qwen3 Realtime ASR (WebSocket) ---

class QwenRealtimeClient:
    def __init__(self, frontend_ws: WebSocket, loop: asyncio.AbstractEventLoop, meeting_id: int = None):
        self.frontend_ws = frontend_ws
        self.loop = loop
        self.ws = None
        self.is_connected = False
        self.thread = None
        self.meeting_id = meeting_id
        self.start_timestamp = time.time()

        self.audio_filename = f"temp_{self.meeting_id}.wav" if self.meeting_id else f"temp_unknown_{uuid.uuid4().hex}.wav"
        self.audio_path = os.path.join(UPLOAD_DIR, self.audio_filename)
        self.wave_file = None
        try:
            self.wave_file = wave.open(self.audio_path, 'wb')
            self.wave_file.setnchannels(1)
            self.wave_file.setsampwidth(2)
            self.wave_file.setframerate(16000)
            logger.info(f"Recording audio to {self.audio_path}")
        except Exception as e:
            logger.error(f"Failed to create audio file: {e}")

        self.context_buffer = deque()
        self.last_text_time = time.time()
        self.suggestion_generated = False
        self.generating = False
        self.is_paused = False

    def connect(self):
        url = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
        headers = [
            f"Authorization: Bearer {DASHSCOPE_API_KEY}",
            "OpenAI-Beta: realtime=v1"
        ]
        self.ws = websocket.WebSocketApp(
            url,
            header=headers,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        self.thread = threading.Thread(target=self.ws.run_forever)
        self.thread.start()

    def on_open(self, ws):
        logger.info("[QwenWS] Connected to Aliyun")
        self.is_connected = True
        
        # Init Session
        session_event = {
            "type": "session.update",
            "session": {
                "model": "qwen3-asr-flash-realtime",
                "input_audio_format": "pcm",
                "input_audio_rate": 16000,
                "response_format": "text",
                "enable_server_vad": True
            }
        }
        ws.send(json.dumps(session_event))

    def _save_segment_to_db(self, text: str):
        if not self.meeting_id or not text.strip():
            return
            
        try:
            # Calculate relative time
            now = time.time()
            elapsed_ms = (now - self.start_timestamp) * 1000
            # A rough estimate: assume this sentence ended now, and started 2s ago or just use same start/end
            # Better: use last_text_time as start, now as end
            start_ms = (self.last_text_time - self.start_timestamp) * 1000
            if start_ms < 0: start_ms = 0
            
            start_str = _ms_to_mmss(start_ms)
            end_str = _ms_to_mmss(elapsed_ms)
            
            db = SessionLocal()
            try:
                seg = Segment(
                    meeting_id=self.meeting_id,
                    content=text,
                    speaker="Speaker",
                    start_time=start_str,
                    end_time=end_str,
                    emotion=None
                )
                db.add(seg)
                
                meeting = db.query(Meeting).filter(Meeting.id == self.meeting_id).first()
                if meeting:
                    meeting.duration = end_str
                    
                db.commit()
            except Exception as e:
                logger.error(f"Failed to save segment to DB: {e}")
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in _save_segment_to_db wrapper: {e}")

    def on_message(self, ws, message):
        try:
            data = json.loads(message)
            # logger.debug(f"[QwenWS] Recv: {data}")
            
            # Handle transcription events
            if data.get("type") == "response.audio_transcript.delta":
                 text = data.get("delta", "")
                 self._send_to_frontend(text, is_final=False)
            elif data.get("type") == "response.audio_transcript.done":
                 text = data.get("transcript", "")
                 self._send_to_frontend(text, is_final=True)
                 if text.strip():
                     self.context_buffer.append((time.time(), text))
                     
                     # Save to DB
                     self._save_segment_to_db(text)
                     
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
        
        if self.wave_file:
            try:
                self.wave_file.writeframes(audio_bytes)
            except Exception as e:
                logger.error(f"Error writing to wave file: {e}")

        # Encode audio to base64
        encoded = base64.b64encode(audio_bytes).decode("utf-8")
        event = {
            "type": "input_audio_buffer.append",
            "audio": encoded
        }
        self.ws.send(json.dumps(event))

    def close(self):
        if self.ws:
            self.ws.close()
        self.is_connected = False
        
        if self.wave_file:
            try:
                self.wave_file.close()
                logger.info(f"Audio recording saved: {self.audio_path}")
            except Exception as e:
                logger.error(f"Error closing wave file: {e}")
            self.wave_file = None

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
            if (now - client.last_text_time > 3.5) and (not client.suggestion_generated) and (not client.generating) and (not client.is_paused):
                if client.is_connected: # Only trigger if session is active
                    logger.info("Silence detected, triggering suggestion...")
                    asyncio.create_task(generate_suggestion(client))
    except asyncio.CancelledError:
        logger.info("Silence monitor cancelled")

@app.websocket("/ws/asr")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_running_loop()
    
    meeting_id = None
    db = None
    try:
        db = SessionLocal()
        now = datetime.now()
        new_meeting = Meeting(
            title=f"实时会议 {now.strftime('%Y-%m-%d %H:%M')}",
            date=now.strftime("%Y-%m-%d"),
            time=now.strftime("%H:%M"),
            duration="00:00",
            type="realtime",
            file_url=""
        )
        db.add(new_meeting)
        db.commit()
        db.refresh(new_meeting)
        meeting_id = new_meeting.id
        logger.info(f"Created Realtime Meeting: {meeting_id}")
    except Exception as e:
        logger.error(f"Failed to create meeting record: {e}")
    finally:
        if db:
            db.close()
    
    # Init Qwen Client
    qwen_client = QwenRealtimeClient(websocket, loop, meeting_id=meeting_id)
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
        
        if qwen_client.meeting_id and os.path.exists(qwen_client.audio_path):
            logger.info(f"Scheduling post-processing for meeting {qwen_client.meeting_id}")
            loop.run_in_executor(None, process_realtime_recording, qwen_client.meeting_id, qwen_client.audio_path)

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Meeting Qwen3 ASR Backend"}

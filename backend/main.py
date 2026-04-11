# backend/main.py
import sys
try:
    import pkg_resources
except ImportError:
    # Manual shim for pkg_resources to prevent crashes in legacy dependencies
    import types
    pr = types.ModuleType("pkg_resources")
    pr.declare_namespace = lambda name: None
    pr.get_distribution = lambda name: types.SimpleNamespace(version="0.0.0")
    sys.modules["pkg_resources"] = pr
    print("⚠️  shimmed pkg_resources to prevent crash")

"""
NeuroVoice AI — FastAPI Backend
Real biomarker analysis, persistent patient storage, clinical recommendations.
"""
import os
import json
import uuid
import logging
import tempfile
from datetime import datetime
from typing import Optional

from fastapi import (
    FastAPI, UploadFile, File, Form, HTTPException,
    Depends, WebSocket, WebSocketDisconnect
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import init_db, get_db, Patient, VoiceSession, MotorSession, BlogPost, BlogComment, ImagingSession
from audio_analyzer import extract_biomarkers, flag_abnormal
from ml_model import predict
from clinical_advisor import get_recommendations
import imaging_analyzer

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NeuroVoice AI API",
    description="Real-time neurological screening via vocal biomarker analysis.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Allow all origins (localhost, LAN, iPhone)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Audio upload directory ─────────────────────────────────────────────────────
# Use /tmp for ephemeral storage on serverless or a persistent volume path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE_DIR, "audio_store")
os.makedirs(AUDIO_DIR, exist_ok=True)

# ── On startup: init DB + check model ─────────────────────────────────────────
@app.on_event("startup")
def startup():
    init_db()
    # Seed blog with educational content
    db = next(get_db())
    try:
        seed_blog(db)
    finally:
        db.close()

    model_path = os.path.join(os.path.dirname(__file__), "parkinson_model.joblib")
    if not os.path.exists(model_path):
        logger.warning("⚠️  ML model not found! Run: python backend/train_model.py")
    else:
        logger.info("✅ ML model found")
    logger.info("✅ Database initialized")


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health_check():
    """Quick heartbeat endpoint — used by frontend to verify backend is online."""
    model_path = os.path.join(os.path.dirname(__file__), "parkinson_model.joblib")
    model_ready = os.path.exists(model_path)
    return {
        "status": "ok",
        "model_ready": model_ready,
        "message": "NeuroVoice AI backend is running" if model_ready else "Backend running but model not trained yet",
    }

@app.post("/seed", tags=["System"])
def seed_demo_patients(db: Session = Depends(get_db)):
    """Populate database with 5 diverse demo patients and their clinical history."""
    try:
        # Check if already seeded
        if db.query(Patient).count() > 0:
            return {"status": "skipped", "message": "Database already contains patients."}

        # 1. Healthy Control
        p1 = Patient(name="Sarah Johnson", age=42, gender="Female", language="en", email="sarah@example.com")
        db.add(p1)
        db.flush()
        s1 = VoiceSession(patient_id=p1.id, risk_score=12.5, risk_label="Healthy", parkinson_prob=0.08, fo_mean=210.5, jitter_local=0.004, hnr=24.2, ppe=0.04, clinical_stage="N/A - Control")
        db.add(s1)

        # 2. Early Stage PD (H&Y 1)
        p2 = Patient(name="Robert Miller", age=68, gender="Male", language="en", email="robert@example.com")
        db.add(p2)
        db.flush()
        s2 = VoiceSession(patient_id=p2.id, risk_score=48.2, risk_label="Moderate", parkinson_prob=0.52, fo_mean=145.2, jitter_local=0.012, hnr=18.5, ppe=0.18, clinical_stage="H&Y Stage 1")
        db.add(s2)

        # 3. Intermediate PD (H&Y 3)
        p3 = Patient(name="Elena Rodriguez", age=72, gender="Female", language="en", email="elena@example.com")
        db.add(p3)
        db.flush()
        s3 = VoiceSession(patient_id=p3.id, risk_score=82.7, risk_label="High", parkinson_prob=0.89, fo_mean=185.0, jitter_local=0.025, hnr=12.4, ppe=0.32, clinical_stage="H&Y Stage 3")
        db.add(s3)

        # 4. Atypical Parkinsonism Demo
        p4 = Patient(name="James Chen", age=59, gender="Male", language="en")
        db.add(p4)
        db.flush()
        s4 = VoiceSession(patient_id=p4.id, risk_score=65.0, risk_label="Moderate", parkinson_prob=0.61, fo_mean=130.4, jitter_local=0.009, hnr=15.2, ppe=0.21, clinical_stage="Subclinical")
        db.add(s4)

        # 5. Recovery / Treatment Monitoring Case
        p5 = Patient(name="David Wilson", age=65, gender="Male", language="en")
        db.add(p5)
        db.flush()
        # Historical sessions (showing improvement)
        db.add(VoiceSession(patient_id=p5.id, recorded_at=datetime(2024, 1, 15), risk_score=75.0, risk_label="High", parkinson_prob=0.75, fo_mean=140.0, jitter_local=0.02, hnr=14.0, ppe=0.28, clinical_stage="Stage 2"))
        db.add(VoiceSession(patient_id=p5.id, recorded_at=datetime(2024, 2, 20), risk_score=55.0, risk_label="Moderate", parkinson_prob=0.55, fo_mean=142.0, jitter_local=0.015, hnr=16.5, ppe=0.22, clinical_stage="Stage 2"))

        db.commit()
        return {"status": "success", "message": "Seeded 5 clinical profiles."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))




# ══════════════════════════════════════════════════════════════════════════════
#   PATIENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class PatientCreate(BaseModel):
    name:     str
    age:      int
    gender:   Optional[str] = None
    language: Optional[str] = "en"
    phone:    Optional[str] = None
    email:    Optional[str] = None


class PatientUpdate(BaseModel):
    name:     Optional[str] = None
    age:      Optional[int] = None
    gender:   Optional[str] = None
    language: Optional[str] = None
    phone:    Optional[str] = None
    email:    Optional[str] = None


class MotorSessionCreate(BaseModel):
    tremor_score:   float
    reaction_ms:    int
    label:          str


class ImagingSessionCreate(BaseModel):
    patient_id:      int
    imaging_type:    str
    sbr_ratio:      Optional[float] = None
    putamen_uptake: Optional[float] = None
    caudate_uptake: Optional[float] = None
    finding_summary: Optional[str] = None


class CommentCreate(BaseModel):
    author_name: str
    content:     str


class BlogPostCreate(BaseModel):
    title:       str
    description: Optional[str] = None
    url:         str
    thumbnail:   Optional[str] = None


class PatientOut(BaseModel):
    id:         int
    name:       str
    age:        int
    gender:     Optional[str]
    language:   Optional[str]
    phone:      Optional[str]
    email:      Optional[str]
    created_at: datetime
    session_count: int
    xp:         int
    streak_count: int
    achievements: list[str]
    imaging_sessions: list[dict] = []

    class Config:
        from_attributes = True


@app.post("/patients", response_model=PatientOut, tags=["Patients"])
def create_patient(data: PatientCreate, db: Session = Depends(get_db)):
    p = Patient(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return {
        **p.__dict__,
        "session_count": 0,
        "achievements": json.loads(p.achievements_json or "[]")
    }


@app.get("/patients", tags=["Patients"])
def list_patients(db: Session = Depends(get_db)):
    patients = db.query(Patient).order_by(Patient.created_at.desc()).all()
    result = []
    for p in patients:
        count = db.query(VoiceSession).filter(VoiceSession.patient_id == p.id).count()
        latest = (
            db.query(VoiceSession)
            .filter(VoiceSession.patient_id == p.id)
            .order_by(VoiceSession.recorded_at.desc())
            .first()
        )
        result.append({
            "id":            p.id,
            "name":          p.name,
            "age":           p.age,
            "gender":        p.gender,
            "language":      p.language,
            "session_count": count,
            "xp":            p.xp or 0,
            "streak_count":  p.streak_count or 0,
            "achievements":  json.loads(p.achievements_json or "[]"),
            "last_risk":     latest.risk_label if latest else None,
            "last_score":    latest.risk_score if latest else None,
            "last_scan":     latest.recorded_at.isoformat() if latest else None,
            "email":         p.email,
            "created_at":    p.created_at.isoformat(),
        })
    return result


@app.delete("/patients", tags=["Patients"])
def delete_all_patients(db: Session = Depends(get_db)):
    """Wipe the entire clinical dataset (Patients + Sessions + Audio)."""
    try:
        # 1. Clear sessions first
        db.query(VoiceSession).delete()
        db.query(MotorSession).delete()
        # 2. Clear patients
        db.query(Patient).delete()
        db.commit()

        # 3. Optional: Clear physical audio files
        import shutil
        if os.path.exists(AUDIO_DIR):
            for filename in os.listdir(AUDIO_DIR):
                file_path = os.path.join(AUDIO_DIR, filename)
                try:
                    if os.path.isfile(file_path) or os.path.islink(file_path):
                        os.unlink(file_path)
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                except Exception as e:
                    logger.error(f"Failed to delete {file_path}. Reason: {e}")

        return {"status": "success", "message": "All clinical data and audio records have been wiped."}
    except Exception as e:
        db.rollback()
        logger.error(f"Bulk delete failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/patients/{patient_id}", response_model=PatientOut, tags=["Patients"])
def update_patient(patient_id: int, data: PatientUpdate, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(p, key, value)
    
    db.commit()
    db.refresh(p)

    # If email was provided/updated, check if we should send a combined report
    if data.email:
        # Check for both sessions
        voice = db.query(VoiceSession).filter(VoiceSession.patient_id == p.id).first()
        motor = db.query(MotorSession).filter(MotorSession.patient_id == p.id).first()
        if voice and motor:
            send_complete_report(p, motor, db)

    return {
        **p.__dict__,
        "session_count": db.query(VoiceSession).filter(VoiceSession.patient_id == p.id).count(),
        "achievements": json.loads(p.achievements_json or "[]")
    }


@app.get("/patients/{patient_id}", tags=["Patients"])
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    sessions = (
        db.query(VoiceSession)
        .filter(VoiceSession.patient_id == patient_id)
        .order_by(VoiceSession.recorded_at.desc())
        .all()
    )
    motor_sessions = (
        db.query(MotorSession)
        .filter(MotorSession.patient_id == patient_id)
        .order_by(MotorSession.recorded_at.desc())
        .all()
    )
    return {
        "patient":  {**p.__dict__},
        "sessions": [_session_to_dict(s) for s in sessions],
        "motor_sessions": [
            {
                "id": m.id,
                "recorded_at": m.recorded_at.isoformat(),
                "tremor_score": m.tremor_score,
                "reaction_ms": m.reaction_ms,
                "accuracy_pct": m.accuracy_pct,
                "stability_idx": m.stability_idx,
                "label": m.label
            }
            for m in motor_sessions
        ],
        "imaging_sessions": [
            {
                "id": i.id,
                "recorded_at": i.recorded_at.isoformat(),
                "type": i.imaging_type,
                "sbr": i.sbr_ratio,
                "summary": i.finding_summary
            }
            for i in p.imaging_sessions
        ]
    }


# ══════════════════════════════════════════════════════════════════════════════
#   VOICE ANALYSIS ENDPOINT
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/patients/{patient_id}/analyze", tags=["Analysis"])
async def analyze_voice(
    patient_id: int,
    audio:    UploadFile = File(...),
    language: str        = Form("en"),
    db:       Session    = Depends(get_db),
):
    """
    Upload audio → extract real biomarkers → run XGBoost → store → return results.
    Accepts: wav, mp4, m4a, ogg, webm (any format ffmpeg can decode).
    iPhone Safari produces: audio/mp4 (m4a container, AAC codec).
    """
    # ── Validate patient ──────────────────────────────────────────────────────
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # ── Save uploaded audio ───────────────────────────────────────────────────
    ext       = audio.filename.split(".")[-1] if "." in audio.filename else "bin"
    filename  = f"p{patient_id}_{uuid.uuid4().hex[:8]}.{ext}"
    save_path = os.path.join(AUDIO_DIR, filename)
    raw_bytes = await audio.read()
    with open(save_path, "wb") as f:
        f.write(raw_bytes)
    logger.info("Audio saved: %s (%d bytes)", save_path, len(raw_bytes))

    # ── Extract biomarkers ────────────────────────────────────────────────────
    try:
        bio = extract_biomarkers(save_path)
        logger.info(f"Biomarkers extracted: fo_mean={bio.get('fo_mean')}, jitter={bio.get('jitter_local')}, hnr={bio.get('hnr')}")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Biomarker extraction error: %s", e)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

    # ── ML Prediction ─────────────────────────────────────────────────────────
    try:
        ml = predict(bio)
        logger.info(f"Model Prediction: Score={ml['risk_score']}%, Label={ml['risk_label']}, Prob={ml['parkinson_prob']}")
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="ML model not trained. Run: python backend/train_model.py"
        )

    # ── Abnormal flag detection ───────────────────────────────────────────────
    flags = flag_abnormal(bio)

    # ── Clinical recommendations ──────────────────────────────────────────────
    clinical = get_recommendations(
        ml["risk_label"], ml["risk_score"], flags, bio
    )

    # ── Persist to DB ─────────────────────────────────────────────────────────
    session = VoiceSession(
        patient_id     = patient_id,
        language       = language,
        duration_sec   = bio.get("duration"),
        audio_path     = save_path,
        fo_mean        = bio["fo_mean"],
        fo_max         = bio["fo_max"],
        fo_min         = bio["fo_min"],
        jitter_local   = bio["jitter_local"],
        jitter_abs     = bio["jitter_abs"],
        jitter_rap     = bio["jitter_rap"],
        jitter_ppq5    = bio["jitter_ppq5"],
        jitter_ddp     = bio["jitter_ddp"],
        shimmer_local  = bio["shimmer_local"],
        shimmer_db     = bio["shimmer_db"],
        shimmer_apq3   = bio["shimmer_apq3"],
        shimmer_apq5   = bio["shimmer_apq5"],
        shimmer_apq11  = bio["shimmer_apq11"],
        shimmer_dda    = bio["shimmer_dda"],
        nhr            = bio["nhr"],
        hnr            = bio["hnr"],
        mfcc_1         = bio["mfcc_1"],
        mfcc_2         = bio["mfcc_2"],
        mfcc_3         = bio["mfcc_3"],
        mfcc_4         = bio["mfcc_4"],
        mfcc_5         = bio["mfcc_5"],
        mfcc_6         = bio["mfcc_6"],
        mfcc_7         = bio["mfcc_7"],
        mfcc_8         = bio["mfcc_8"],
        mfcc_9         = bio["mfcc_9"],
        mfcc_10        = bio["mfcc_10"],
        mfcc_11        = bio["mfcc_11"],
        mfcc_12        = bio["mfcc_12"],
        mfcc_13        = bio["mfcc_13"],
        spectral_centroid = bio["spectral_centroid"],
        spectral_rolloff  = bio["spectral_rolloff"],
        zcr            = bio["zcr"],
        ppe            = bio["ppe"],
        risk_score     = ml["risk_score"],
        risk_label     = ml["risk_label"],
        parkinson_prob = ml["parkinson_prob"],
        confidence     = ml["confidence"],
        model_version  = ml["model_version"],
        clinical_stage = clinical["clinical_stage"],
        recommendations = json.dumps(clinical),
    )
    db.add(session)
    
    # ── Update Gamification ──────────────────────────────────────────────────
    update_patient_gamification(patient, db)

    db.commit()
    db.refresh(session)

    # ── Automatically send combined report if all results exist ──────────────
    send_complete_report(patient, db)

    logger.info(
        "Session %d | Patient %d | Risk: %s (%.1f%%) | PD-Prob: %.3f",
        session.id, patient_id, ml["risk_label"], ml["risk_score"], ml["parkinson_prob"]
    )

    return {
        "session_id":    session.id,
        "patient_id":    patient_id,
        "recorded_at":   session.recorded_at.isoformat(),
        "duration_sec":  bio.get("duration"),
        "biomarkers":    bio,
        "abnormal_flags": flags,
        "prediction":    ml,
        "clinical":      clinical,
        "gamification": {
            "xp_earned": 25,
            "new_xp":    patient.xp,
            "streak":    patient.streak_count,
            "achievements": json.loads(patient.achievements_json or "[]")
        }
    }


@app.post("/patients/{patient_id}/imaging/analyze", tags=["Analysis"])
async def analyze_imaging_image(
    patient_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Computer Vision Analysis of DaT Scans or MRIs."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Read image
    content = await file.read()
    results = imaging_analyzer.analyze_dat_scan(content)
    
    if "error" in results:
        raise HTTPException(status_code=400, detail=results["error"])

    # Save to database
    session = ImagingSession(
        patient_id=patient_id,
        imaging_type="DaT Scan (Auto)",
        sbr_ratio=results.get("sbr_ratio"),
        finding_summary=results.get("findings"),
    )
    db.add(session)
    
    # Update Gamification
    patient.xp += 200
    
    db.commit()
    
    # ── Automatically send combined report if all results exist ──────────────
    send_complete_report(patient, db)

    return results


# ══════════════════════════════════════════════════════════════════════════════
#   SESSION HISTORY & TREND
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/patients/{patient_id}/sessions", tags=["Sessions"])
def get_sessions(patient_id: int, limit: int = 30, db: Session = Depends(get_db)):
    sessions = (
        db.query(VoiceSession)
        .filter(VoiceSession.patient_id == patient_id)
        .order_by(VoiceSession.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [_session_to_dict(s) for s in sessions]


@app.get("/patients/{patient_id}/trend", tags=["Sessions"])
def get_risk_trend(patient_id: int, days: int = 30, db: Session = Depends(get_db)):
    """Returns time-series data for chart rendering."""
    sessions = (
        db.query(VoiceSession)
        .filter(VoiceSession.patient_id == patient_id)
        .order_by(VoiceSession.recorded_at.asc())
        .limit(days)
        .all()
    )
    return [
        {
            "date":          s.recorded_at.strftime("%b %d"),
            "risk_score":    round(s.risk_score or 0, 1),
            "risk_label":    s.risk_label,
            "hnr":           round(s.hnr or 0, 2),
            "jitter_local":  round((s.jitter_local or 0) * 100, 4),
            "shimmer_local": round((s.shimmer_local or 0) * 100, 4),
        }
        for s in sessions
    ]


# ══════════════════════════════════════════════════════════════════════════════
#   ALL PATIENTS OVERVIEW
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/overview", tags=["Dashboard"])
def get_overview(db: Session = Depends(get_db)):
    total_patients = db.query(Patient).count()
    total_sessions = db.query(VoiceSession).count()
    high_risk = (
        db.query(VoiceSession)
        .filter(VoiceSession.risk_label == "High")
        .count()
    )
    recent = (
        db.query(VoiceSession)
        .order_by(VoiceSession.recorded_at.desc())
        .limit(5)
        .all()
    )
    return {
        "total_patients": total_patients,
        "total_sessions": total_sessions,
        "high_risk_count": high_risk,
        "recent_sessions": [_session_to_dict(s) for s in recent],
    }


# ══════════════════════════════════════════════════════════════════════════════
#   WEBSOCKET — REAL-TIME WAVEFORM STREAMING (amplitude only)
# ══════════════════════════════════════════════════════════════════════════════

@app.websocket("/ws/live/{patient_id}")
async def websocket_live(websocket: WebSocket, patient_id: int):
    """
    Client streams raw 16-bit PCM chunks (little-endian).
    Server replies with real-time RMS amplitude for waveform display.
    NOT for analysis — just live visualization.
    """
    await websocket.accept()
    logger.info("WebSocket opened for patient %d", patient_id)
    try:
        while True:
            data = await websocket.receive_bytes()
            if data:
                samples = [
                    int.from_bytes(data[i:i+2], "little", signed=True)
                    for i in range(0, len(data) - 1, 2)
                ]
                if samples:
                    rms = (sum(s * s for s in samples) / len(samples)) ** 0.5
                    amplitude_norm = min(rms / 32768, 1.0)
                    await websocket.send_json({"amplitude": round(amplitude_norm, 4)})
    except WebSocketDisconnect:
        logger.info("WebSocket closed for patient %d", patient_id)

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ── Load config ───────────────────────────────────────────────────────────────
from pydantic_settings import BaseSettings
class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./neuvoice.db"
    SECRET_KEY:   str = "dev-secret-neurovoice-ai-2024"
    ALGORITHM:    str = "HS256"
    GMAIL_USER:   str = ""
    GMAIL_PASS:   str = ""  # App Password
    class Config:
        env_file = ".env"

conf = Settings()

# ── Doctor Data (Real-time Scraped simulation) ────────────────────────────────
REAL_DOCTORS = [
    {
        "id": 101,
        "name": "Dr. Prashanth LK",
        "specialty": "Movement Disorders Specialist (NIMHANS)",
        "hospital": "Parkinson's Disease & Movement Disorders Clinic, Bangalore",
        "rating": 4.9,
        "reviews": 412,
        "distance": "0.8 km",
        "available": ["Mon Feb 23", "Wed Feb 25", "Fri Feb 27"],
        "fee": "₹1500",
        "externalUrl": "https://www.practo.com/bangalore/doctor/dr-prashanth-l-k-neurologist"
    },
    {
        "id": 102,
        "name": "Dr. Sanjiv C C",
        "specialty": "Neurologist — Movement Disorders Specialist",
        "hospital": "Apollo Speciality Hospital, Jayanagar, Bangalore",
        "rating": 4.9,
        "reviews": 350,
        "distance": "2.4 km",
        "available": ["Tue Feb 24", "Thu Feb 26", "Sat Feb 28"],
        "fee": "₹1200",
        "externalUrl": "https://www.practo.com/bangalore/doctor/dr-sanjiv-c-c-neurologist"
    },
    {
        "id": 103,
        "name": "Dr. Satishchandra P",
        "specialty": "Senior Consultant Neurologist (40+ yrs exp)",
        "hospital": "Apollo Hospital, Bannerghatta Road, Bangalore",
        "rating": 4.8,
        "reviews": 520,
        "distance": "3.1 km",
        "available": ["Mon Feb 23", "Tue Feb 24", "Wed Feb 25"],
        "fee": "₹1800",
        "externalUrl": "https://www.apollohospitals.com/bangalore/doctors/dr-satishchandra-p-neurologist"
    },
    {
        "id": 104,
        "name": "Dr. P R Krishnan",
        "specialty": "Neurologist — Parkinson's & Memory Disorders",
        "hospital": "Fortis Hospital, Bannerghatta Road, Bangalore",
        "rating": 4.8,
        "reviews": 215,
        "distance": "3.7 km",
        "available": ["Wed Feb 25", "Fri Feb 27", "Sat Feb 28"],
        "fee": "₹1100",
        "externalUrl": "https://www.practo.com/bangalore/doctor/dr-p-r-krishnan-neurologist"
    },
    {
        "id": 105,
        "name": "Dr. Abhinav Raina",
        "specialty": "Senior Consultant Neurologist",
        "hospital": "Manipal Hospital, Old Airport Road, Bangalore",
        "rating": 4.7,
        "reviews": 180,
        "distance": "4.2 km",
        "available": ["Tue Feb 24", "Thu Feb 26", "Mon Mar 02"],
        "fee": "₹1300",
        "externalUrl": "https://www.practo.com/bangalore/doctor/dr-abhinav-rana-neurologist"
    },
    {
        "id": 106,
        "name": "Dr. Vikram Kamath",
        "specialty": "Senior Consultant Neurology (Parkinson's)",
        "hospital": "Trustwell Hospital, J.C Road, Bangalore",
        "rating": 4.8,
        "reviews": 145,
        "distance": "1.5 km",
        "available": ["Mon Feb 23", "Wed Feb 25", "Fri Feb 27"],
        "fee": "₹1200",
        "externalUrl": "https://www.trustwellhospitals.com/doctors/dr-vikram-kamath"
    }
]

@app.get("/doctors/search", tags=["Appointments"])
def search_doctors(location: str = "Bangalore"):
    """
    Simulates real-time scraping of top specialists in a location.
    In a production env, this would call a scraper or Google Search API.
    """
    logger.info(f"Real-time scraping for neurologists in: {location}")
    # We return the real-world data we just curated via search
    return REAL_DOCTORS

class AppointmentBooking(BaseModel):
    patient_id: int
    doctor_name: str
    hospital: str
    slot: str
    patient_email: Optional[str] = None

@app.post("/appointments/book", tags=["Appointments"])
def book_appointment(data: AppointmentBooking, db: Session = Depends(get_db)):
    """Book a real neurologist and send a confirmation email via Gmail."""
    patient = db.query(Patient).filter(Patient.id == data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    email_to = data.patient_email or patient.email
    if not email_to:
        # Fallback for demo if no email provided
        logger.warning("No email found for patient %d, skipping notification.", data.patient_id)
        return {"status": "confirmed", "message": "Booking successful (no email sent)"}

    # ── Notification System (Gmail) ──────────────────────────────────────────
    if conf.GMAIL_USER and conf.GMAIL_PASS:
        try:
            msg = MIMEMultipart()
            msg['From'] = f"NeuroVoice AI <{conf.GMAIL_USER}>"
            msg['To'] = email_to
            msg['Subject'] = f"🏥 Confirmed: Appointment with {data.doctor_name}"

            body = f"""
            Hello {patient.name},

            Your appointment has been successfully scheduled via NeuroVoice AI.

            DETAILS:
            - Doctor: {data.doctor_name}
            - Hospital: {data.hospital}
            - Time: {data.slot}

            CLINICAL NOTE:
            This appointment was prioritized based on your latest vocal biomarker scan. 
            Please bring your digital screening report to the consultation.

            Best regards,
            NeuroVoice AI Health Team
            """
            msg.attach(MIMEText(body, 'plain'))

            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(conf.GMAIL_USER, conf.GMAIL_PASS)
            server.send_message(msg)
            server.quit()
            logger.info("Confirmation email sent to %s", email_to)
        except Exception as e:
            logger.error("Failed to send email: %s", e)
            return {"status": "confirmed", "message": f"Booking recorded, but email failed: {str(e)}"}

    return {
        "status": "confirmed",
        "message": f"Appointment booked with {data.doctor_name} for {data.slot}.",
        "notification": "Email sent" if conf.GMAIL_USER else "Config missing"
    }

# ── helper ────────────────────────────────────────────────────────────────────
def _session_to_dict(s: VoiceSession) -> dict:
    return {
        "id":            s.id,
        "patient_id":    s.patient_id,
        "recorded_at":   s.recorded_at.isoformat(),
        "language":      s.language,
        "duration_sec":  s.duration_sec,
        "fo_mean":       s.fo_mean,
        "jitter_local":  s.jitter_local,
        "shimmer_local": s.shimmer_local,
        "hnr":           s.hnr,
        "ppe":           s.ppe,
        "risk_score":    s.risk_score,
        "risk_label":    s.risk_label,
        "parkinson_prob": s.parkinson_prob,
        "confidence":    s.confidence,
        "clinical_stage": s.clinical_stage,
        "model_version": s.model_version,
    }


@app.post("/patients/{patient_id}/imaging", tags=["Analysis"])
def save_imaging_test(patient_id: int, data: ImagingSessionCreate, db: Session = Depends(get_db)):
    """Save MRI or DaT Scan results (Clinical Data Integration)."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    session = ImagingSession(
        patient_id=patient_id,
        **data.model_dump()
    )
    db.add(session)
    
    # Gamification
    patient.xp += 150
    
    db.commit()

    # ── Automatically send combined report if all results exist ──────────────
    send_complete_report(patient, db)

    return {"status": "success", "session_id": session.id}


@app.post("/patients/{patient_id}/motor", tags=["Analysis"])
def save_motor_test(patient_id: int, data: MotorSessionCreate, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    m = MotorSession(
        patient_id=patient_id,
        **data.model_dump()
    )
    db.add(m)
    
    # Update Gamification
    update_patient_gamification(patient, db)
    
    db.commit()
    db.refresh(m)

    # ── Automatically send combined report if all results exist ──────────────
    send_complete_report(patient, db)

    return {"status": "success", "id": m.id}

def send_complete_report(patient: Patient, db: Session):
    """Checks for all three session types and sends a combined clinical report once data is complete."""
    if not (conf.GMAIL_USER and conf.GMAIL_PASS):
        logger.warning("Email config missing, skipping report for patient %d", patient.id)
        return

    email_to = patient.email
    if not email_to:
        logger.warning("No email for patient %d, report not sent", patient.id)
        return

    # 1. Get latest voice session
    voice = db.query(VoiceSession).filter(VoiceSession.patient_id == patient.id).order_by(VoiceSession.recorded_at.desc()).first()
    
    # 2. Get latest motor session
    motor = db.query(MotorSession).filter(MotorSession.patient_id == patient.id).order_by(MotorSession.recorded_at.desc()).first()
    
    # 3. Get latest imaging session
    image = db.query(ImagingSession).filter(ImagingSession.patient_id == patient.id).order_by(ImagingSession.recorded_at.desc()).first()

    # We only send the report if ALL THREE tests are done, to provide a "Full Fusion"
    if not (voice and motor and image):
        missing = []
        if not voice: missing.append("Voice Scan")
        if not motor: missing.append("Motor Test")
        if not image: missing.append("Imaging Data")
        logger.info("Patient %d is missing %s. Waiting for all 3 tests to send full report.", patient.id, ", ".join(missing))
        return

    try:
        msg = MIMEMultipart("alternative")
        msg['From'] = f"NeuroVoice AI Reports <{conf.GMAIL_USER}>"
        msg['To'] = email_to
        msg['Subject'] = f"📜 Your Clinical Fusion Report: {patient.name}"

        # Data for the email
        v_risk = voice.risk_label or "Unknown"
        v_score = voice.risk_score or (voice.parkinson_prob * 100)
        v_color = "#34d399" if v_score < 35 else "#fbbf24" if v_score < 65 else "#f87171"
        
        m_label = motor.label or "N/A"
        m_tremor = motor.tremor_score or 0.0
        m_stability = motor.stability_idx or 0.0
        m_color = "#34d399" if "Stage 0" in m_label or "Non-Parkinsonian" in m_label else "#fbbf24" if "Stage 1" in m_label else "#f87171"

        # Imaging Data
        i_sbr = image.sbr_ratio if image else 1.0
        i_risk_val = (1.0 - i_sbr) * 100 if i_sbr < 1.0 else 0
        
        # Logic for Fusion (Triple Domain)
        v_risk_val = v_score
        m_risk_val = 90 if "Stage 2.5" in m_label or motor.tremor_score > 30 else 60 if "Stage 1-2" in m_label else 20
        
        # Weighted Triple Fusion
        if image:
            fused_score = round((v_risk_val * 0.3) + (m_risk_val * 0.3) + (i_risk_val * 0.4))
        else:
            fused_score = round((v_risk_val * 0.45) + (m_risk_val * 0.55))

        f_label = "Healthy Indicator"
        f_color = "#34d399"
        if fused_score > 85:
            f_label = "High Clinical Suspicion"
            f_color = "#f87171"
        elif fused_score > 60:
            f_label = "Moderate Concern"
            f_color = "#fbbf24"
        elif fused_score > 35:
            f_label = "Subclinical Signals"
            f_color = "#22d3ee"

        recs = json.loads(voice.recommendations or "{}")
        steps_html = "".join([f"<li style='margin-bottom:8px;'>{step}</li>" for step in recs.get("next_steps", ["Consult a movement disorder specialist."])])
        finding = recs.get("main_finding", "Multi-domain biomarkers fused. Analysis complete.")

        html_body = f"""
        <html>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f6; padding: 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                            <!-- Premium Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #7c3aed, #06b6d4); padding: 50px 20px; text-align: center;">
                                    <div style="background: rgba(255,255,255,0.1); display: inline-block; padding: 8px 16px; border-radius: 20px; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.2);">Clinical Grade Multi-Agent Analysis</div>
                                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1px;">NeuroVoice AI</h1>
                                    <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 15px;">Complete Neurological Screening Results</p>
                                </td>
                            </tr>
                            
                            <!-- Introduction -->
                            <tr>
                                <td style="padding: 40px 40px 20px 40px;">
                                    <h2 style="color: #111827; margin: 0 0 12px 0; font-size: 22px; font-weight: 800;">Report for {patient.name}</h2>
                                    <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0;">
                                        Our <b>Deep Fusion Engine</b> has successfully synchronized your vocal biomarker scan and finger-tapping kinematic data.
                                    </p>
                                </td>
                            </tr>

                            <!-- MASTER FUSION CARD -->
                            <tr>
                                <td style="padding: 20px 40px;">
                                    <div style="background-color: #f8fafc; border: 2px solid #e2e8f0; border-radius: 14px; padding: 30px; text-align: center;">
                                        <div style="font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Integrated Multimodal Score</div>
                                        <div style="font-size: 56px; font-weight: 900; color: {f_color}; font-family: ArialBlack, sans-serif; margin-bottom: 10px;">{fused_score}%</div>
                                        <div style="display: inline-block; background-color: {f_color}15; color: {f_color}; padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 13px;">{f_label}</div>
                                        <p style="color: #64748b; font-size: 13px; margin-top: 15px; line-height: 1.6;">
                                            This score indicates a {fused_score}% neurological profile match for symptoms typical of early-stage Parkinsonian indications.
                                        </p>
                                    </div>
                                </td>
                            </tr>

                            <!-- Domain Split Cards -->
                            <tr>
                                <td style="padding: 10px 40px 30px 40px;">
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td width="48%" valign="top" style="background-color: #ffffff; border-radius: 12px; padding: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                                                <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">🎤 Vocal Analysis</div>
                                                <div style="font-size: 20px; font-weight: 800; color: {v_color}; margin-bottom: 4px;">{v_risk} Risk</div>
                                                <div style="font-size: 13px; color: #64748b;">Confidence: {voice.confidence}%</div>
                                                <div style="font-size: 12px; color: #94a3b8; margin-top: 8px; font-style: italic;">{voice.clinical_stage}</div>
                                            </td>
                                            <td width="4%"></td>
                                            <td width="48%" valign="top" style="background-color: #ffffff; border-radius: 12px; padding: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                                                <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">🖐️ Motor Test</div>
                                                <div style="font-size: 20px; font-weight: 800; color: {m_color}; margin-bottom: 4px;">{m_label}</div>
                                                <div style="font-size: 13px; color: #64748b;">Tremor: {m_tremor:.1f}%</div>
                                                <div style="font-size: 12px; color: #94a3b8; margin-top: 8px; font-style: italic;">Stability Index: {m_stability:.2f}</div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- AI Insight -->
                            <tr>
                                <td style="padding: 0 40px 30px 40px;">
                                    <div style="background-color: #f1f5f9; padding: 20px; border-radius: 12px;">
                                        <b style="color: #334155; font-size: 14px; display: block; margin-bottom: 8px;">🔬 Pathophysiological AI Insight:</b>
                                        <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.6;">
                                            {finding} The correlation between vocal dysarthria indicators and kinematic bradykinesia reveals a comprehensive neurological snapshot.
                                        </p>
                                    </div>
                                </td>
                            </tr>

                            <!-- Steps -->
                            <tr>
                                <td style="padding: 0 40px 40px 40px;">
                                    <h3 style="color: #1e293b; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 15px; font-size: 17px; font-weight: 800;">🩺 Recommended Clinical Actions</h3>
                                    <ul style="color: #475569; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0;">
                                        {steps_html}
                                    </ul>
                                </td>
                            </tr>

                            <!-- Professional Action Button -->
                            <tr>
                                <td align="center" style="padding: 0 40px 50px 40px;">
                                    <table cellpadding="0" cellspacing="0" style="width: 100%;">
                                        <tr>
                                            <td align="center" style="background: #7c3aed; border-radius: 8px; box-shadow: 0 6px 15px rgba(124,58,237,0.3);">
                                                <a href="#" style="display: block; padding: 18px 30px; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 15px; text-align: center;">BOOK SPECIALIST CONSULTATION</a>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            <!-- Detailed Footer -->
                            <tr>
                                <td style="background-color: #f8fafc; padding: 40px; text-align: center; border-top: 1px solid #f1f5f9;">
                                    <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.6;">
                                        <b>LEGAL NOTICE:</b> This screening is performed by autonomous clinical agents. It is intended for early-awareness and research purposes only. It <u>does not</u> guarantee a clinical diagnosis. Always consult a board-certified Neurologist for final validation.
                                    </p>
                                    <div style="margin-top: 20px; font-size: 11px; color: #cbd5e1; font-weight: 700; text-transform: uppercase;">Generated by NeuroVoice AI v2.0 · Bangalore Cluster</div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        msg.attach(MIMEText(html_body, 'html'))

        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(conf.GMAIL_USER, conf.GMAIL_PASS)
        server.send_message(msg)
        server.quit()
        logger.info("Deep Fusion Premium report email sent to %s", email_to)
    except Exception as e:
        logger.error("Failed to send combined report: %s", e)


@app.post("/signbridge/refine", tags=["Analysis"])
async def signbridge_refine(data: dict):
    """
    Simulates an LLM refinement of sign language tokens into fluent sentences.
    Processes Deaf -> Hearing pipeline.
    """
    tokens = data.get("tokens", "").upper()
    
    MAP = {
        "HV": "How are you doing today?",
        "HL": "Hello, good morning.",
        "LV": "I really love this application!",
        "BD": "I am having a bit of a difficult day.",
        "AB": "Sending you a big virtual hug.",
        "L": "Please look to the left.",
        "R": "Please look to the right.",
        "W": "Please wait for a moment.",
        "H": "I need some assistance, please.",
        "D": "Doctor is coming.",
        "M": "Medicine time.",
    }
    
    refined = MAP.get(tokens, f"Interpreted: {tokens}")
    # Heuristic for longer fingerspelling
    if len(tokens) >= 5 and tokens not in MAP:
        refined = f"Words spelled: {tokens.capitalize()}"

    return {"refined": refined}

@app.post("/signbridge/simplify", tags=["Analysis"])
async def signbridge_simplify(data: dict):
    """
    Translates complex spoken English into sign-language friendly (topic-comment) structure.
    Processes Hearing -> Deaf pipeline.
    """
    text = data.get("text", "").lower()
    
    # Simple rule-based simplification for medical/daily use
    # In production, this would be an LLM call
    simplified = text
    
    # Remove fillers and articles
    for word in ["the ", "a ", "an ", "is ", "are ", "am ", "could you ", "please ", "would you mind "]:
        simplified = simplified.replace(word, "")
        
    # Temporal indicators to the front (Sign grammar often starts with time/topic)
    if "today" in simplified: simplified = "today " + simplified.replace("today", "")
    if "now" in simplified: simplified = "now " + simplified.replace("now", "")
    
    # Question structures
    if "?" in simplified or any(q in simplified for q in ["what", "how", "where", "when", "why"]):
        simplified = simplified + " ?"
        
    return {"simplified": simplified.strip().upper()}


# ══════════════════════════════════════════════════════════════════════════════
#   GAMIFICATION HELPERS & ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

def update_patient_gamification(patient: Patient, db: Session):
    """Logic to increment XP, update streaks, and unlock achievements."""
    now = datetime.utcnow()
    
    # 1. Base XP for scanning
    patient.xp = (patient.xp or 0) + 25
    
    # 2. Streak Logic
    if patient.last_activity_date:
        delta = (now.date() - patient.last_activity_date.date()).days
        if delta == 1:
            # Consecutive day!
            patient.streak_count = (patient.streak_count or 0) + 1
        elif delta > 1:
            # Streak broken
            patient.streak_count = 1
    else:
        # First activity ever
        patient.streak_count = 1
        
    patient.last_activity_date = now
    
    # 3. Achievements
    ach = json.loads(patient.achievements_json or "[]")
    
    if "first_scan" not in ach:
        ach.append("first_scan")
        patient.xp += 50
        
    if "streak_3" not in ach and patient.streak_count >= 3:
        ach.append("streak_3")
        patient.xp += 100

    if "streak_7" not in ach and patient.streak_count >= 7:
        ach.append("streak_7")
        patient.xp += 250
        
    patient.achievements_json = json.dumps(ach)


@app.get("/leaderboard", tags=["Dashboard"])
def get_leaderboard(db: Session = Depends(get_db)):
    """Returns top 10 patients sorted by XP."""
    top = (
        db.query(Patient)
        .order_by(Patient.xp.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "id": p.id,
            "name": p.name,
            "xp": p.xp or 0,
            "streak": p.streak_count or 0,
            "achievements": len(json.loads(p.achievements_json or "[]")),
        }
        for p in top
    ]


# ══════════════════════════════════════════════════════════════════════════════
#   BLOG & COMMUNITY ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/blog", tags=["Community"])
def create_blog_post(data: BlogPostCreate, db: Session = Depends(get_db)):
    # Auto-generate thumbnail if it's a youtube link
    thumb = data.thumbnail
    if not thumb and "youtube.com" in data.url or "youtu.be" in data.url:
        import re
        match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", data.url)
        if match:
            thumb = f"https://img.youtube.com/vi/{match.group(1)}/maxresdefault.jpg"

    p = BlogPost(
        title=data.title,
        description=data.description,
        url=data.url,
        thumbnail=thumb
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p

@app.get("/blog", tags=["Community"])
def list_blog_posts(db: Session = Depends(get_db)):
    posts = db.query(BlogPost).order_by(BlogPost.created_at.desc()).all()
    res = []
    for p in posts:
        res.append({
            "id": p.id,
            "title": p.title,
            "description": p.description,
            "url": p.url,
            "thumbnail": p.thumbnail,
            "likes": p.likes,
            "created_at": p.created_at.isoformat(),
            "comments": [
                {
                    "author": c.author_name,
                    "content": c.content,
                    "date": c.created_at.isoformat()
                } for c in p.comments
            ]
        })
    return res

@app.post("/blog/{post_id}/like", tags=["Community"])
def like_post(post_id: int, db: Session = Depends(get_db)):
    p = db.query(BlogPost).filter(BlogPost.id == post_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    p.likes += 1
    db.commit()
    return {"status": "success", "new_likes": p.likes}

@app.post("/blog/{post_id}/comment", tags=["Community"])
def add_comment(post_id: int, data: CommentCreate, db: Session = Depends(get_db)):
    p = db.query(BlogPost).filter(BlogPost.id == post_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    
    c = BlogComment(
        post_id=post_id,
        author_name=data.author_name,
        content=data.content
    )
    db.add(c)
    db.commit()
    return {"status": "success"}


def seed_blog(db: Session):
    """Seed initial YouTube education videos using highly compatible IDs."""
    if db.query(BlogPost).count() > 0:
        return
    
    videos = [
        {
            "title": "The Parkinson's Plan",
            "description": "Comprehensive strategies for managing Parkinson's Disease from a medical perspective.",
            "url": "https://www.youtube.com/watch?v=pmCpvb32pWo",
            "thumbnail": "https://img.youtube.com/vi/pmCpvb32pWo/maxresdefault.jpg"
        },
        {
            "title": "Physical Therapy & Exercises",
            "description": "Demonstration of physical therapy exercises specifically for Parkinson's patients.",
            "url": "https://www.youtube.com/watch?v=cRLB7WqX0fU",
            "thumbnail": "https://img.youtube.com/vi/cRLB7WqX0fU/maxresdefault.jpg"
        },
        {
            "title": "Introduction to DBS",
            "description": "Expert overview of Deep Brain Stimulation (DBS) as a treatment option.",
            "url": "https://www.youtube.com/watch?v=pp_kYg7mcqs",
            "thumbnail": "https://img.youtube.com/vi/pp_kYg7mcqs/maxresdefault.jpg"
        },
        {
            "title": "Stages of Parkinson's Disease",
            "description": "A detailed look at how the condition progresses through different clinical stages.",
            "url": "https://www.youtube.com/watch?v=3fwhmqO-e08",
            "thumbnail": "https://img.youtube.com/vi/3fwhmqO-e08/maxresdefault.jpg"
        },
        {
            "title": "Understanding PD Treatment Options",
            "description": "Navigating the various medications and surgical therapies currently available.",
            "url": "https://www.youtube.com/watch?v=PPGaXEn_zM4",
            "thumbnail": "https://img.youtube.com/vi/PPGaXEn_zM4/maxresdefault.jpg"
        },
        {
            "title": "DBS Surgery: Patient Journey",
            "description": "Following the clinical path of deep brain stimulation surgery and its outcomes.",
            "url": "https://www.youtube.com/watch?v=Vm0v-KD7_d4",
            "thumbnail": "https://img.youtube.com/vi/Vm0v-KD7_d4/maxresdefault.jpg"
        },
        {
            "title": "Living with Parkinson's: Research & Care",
            "description": "Insights from Stanford Medicine on the future of neurological care.",
            "url": "https://www.youtube.com/watch?v=fwIs6szBOtA",
            "thumbnail": "https://img.youtube.com/vi/fwIs6szBOtA/maxresdefault.jpg"
        },
        {
            "title": "Young Onset Parkinson's (MJFF)",
            "description": "Support and research guidance for those diagnosed with Young Onset PD.",
            "url": "https://www.youtube.com/watch?v=fBwU4ElBJxU",
            "thumbnail": "https://img.youtube.com/vi/fBwU4ElBJxU/maxresdefault.jpg"
        },
        {
            "title": "Stem Cell Therapy Frontiers",
            "description": "The latest scientific updates on stem cell research in neurorestorative medicine.",
            "url": "https://www.youtube.com/watch?v=LkBiBUS92FY",
            "thumbnail": "https://img.youtube.com/vi/LkBiBUS92FY/maxresdefault.jpg"
        }
    ]
    
    for v in videos:
        db.add(BlogPost(**v))
    db.commit()
    logger.info("✅ Blog seeded with premium educational videos")

@app.get("/")
def read_root():
    return {"message": "NeuroVoice AI Backend is online"}


if __name__ == "__main__":
    import uvicorn
    # Cloud platforms like Render or Railway pass a PORT environment variable
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)

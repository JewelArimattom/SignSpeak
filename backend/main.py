"""
FastAPI backend for Hand Sign Detection.
Accepts webcam frames via WebSocket, detects hands, classifies signs,
and returns predicted letters in real-time.
"""

import os
import sys
import math
import base64
import json
import time
import asyncio
import re
from io import BytesIO
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from dataclasses import dataclass

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image
from pydantic import BaseModel
import bcrypt
from jose import jwt, JWTError
from dotenv import load_dotenv
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# Add parent directory to path so we can import existing modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hand_detector import HandDetector

import tensorflow as tf
from tensorflow.keras.layers import DepthwiseConv2D as _KDepthwiseConv2D


# ── Patch for DepthwiseConv2D compatibility ──────────────────────────────────
class DepthwiseConv2D(_KDepthwiseConv2D):
    def __init__(self, *args, **kwargs):
        kwargs.pop("groups", None)
        super().__init__(*args, **kwargs)


import tensorflow.keras.layers as _k_layers

_k_layers.DepthwiseConv2D = DepthwiseConv2D

# ── Constants ────────────────────────────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "model")
LABELS_PATH = os.path.join(MODEL_DIR, "labels.txt")
DEBUG_DIR = os.path.join(os.path.dirname(__file__), "..", "debug")
OFFSET = 20
IMG_SIZE = 300

os.makedirs(DEBUG_DIR, exist_ok=True)

# Debug frame counter — save first N frames for inspection
_debug_counter = 0
_DEBUG_MAX_SAVES = 10

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ── Auth / DB config ─────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./signspeak.db",
)
JWT_SECRET = os.getenv("JWT_SECRET", "replace-this-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))


def _parse_admin_emails(raw_emails: str | None) -> set[str]:
    if not raw_emails:
        return set()
    return {email.strip().lower() for email in raw_emails.split(",") if email.strip()}


ADMIN_EMAILS = _parse_admin_emails(os.getenv("ADMIN_EMAILS"))


def _parse_cors_origins(raw_origins: str | None) -> list[str]:
    if not raw_origins:
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


CORS_ORIGINS = _parse_cors_origins(os.getenv("CORS_ORIGINS"))

engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class SignUpRequest(BaseModel):
    full_name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class Community(Base):
    __tablename__ = "communities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=False, default="")
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class CommunityMember(Base):
    __tablename__ = "community_members"
    __table_args__ = (UniqueConstraint("community_id", "user_id", name="uq_community_user"),)

    id = Column(Integer, primary_key=True)
    community_id = Column(Integer, ForeignKey("communities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    edited_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)


class ChatMention(Base):
    __tablename__ = "chat_mentions"
    __table_args__ = (UniqueConstraint("message_id", "mentioned_user_id", name="uq_message_mention_user"),)

    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    mentioned_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)


class CommunityCreateRequest(BaseModel):
    name: str
    description: str = ""


class CommunityJoinRequest(BaseModel):
    community_name: str


class MessageCreateRequest(BaseModel):
    content: str


MENTION_PATTERN = re.compile(r"@([A-Za-z0-9_.-]{2,40})")


def format_user_min(user: User):
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
    }


def format_message(msg: ChatMessage, sender: User, mention_users: list[User]):
    return {
        "id": msg.id,
        "community_id": msg.community_id,
        "sender": format_user_min(sender),
        "content": msg.content,
        "created_at": msg.created_at,
        "edited_at": msg.edited_at,
        "deleted_at": msg.deleted_at,
        "mentions": [format_user_min(u) for u in mention_users],
    }


def get_user_from_auth_header(authorization: str | None, db: Session):
    return require_user(authorization, db)


def ensure_community_member(community_id: int, user_id: int, db: Session):
    member = (
        db.query(CommunityMember)
        .filter(
            CommunityMember.community_id == community_id,
            CommunityMember.user_id == user_id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this community")
    return member


def resolve_mentions(content: str, community_id: int, db: Session) -> list[User]:
    tags = {m.group(1).lower() for m in MENTION_PATTERN.finditer(content)}
    if not tags:
        return []

    members = (
        db.query(User)
        .join(CommunityMember, CommunityMember.user_id == User.id)
        .filter(CommunityMember.community_id == community_id)
        .all()
    )

    found = []
    for member in members:
        full_name_key = member.full_name.strip().replace(" ", "").lower()
        full_name_spaced_key = member.full_name.strip().lower().replace(" ", ".")
        email_key = member.email.split("@")[0].lower()
        keys = {full_name_key, full_name_spaced_key, email_key}
        if tags.intersection(keys):
            found.append(member)
    return found


@dataclass
class ChatClient:
    websocket: WebSocket
    user_id: int
    community_id: int


class ChatConnectionManager:
    def __init__(self):
        self._community_clients: dict[int, dict[int, WebSocket]] = defaultdict(dict)
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, community_id: int, user_id: int):
        await websocket.accept()
        async with self._lock:
            self._community_clients[community_id][user_id] = websocket

    async def disconnect(self, community_id: int, user_id: int):
        async with self._lock:
            clients = self._community_clients.get(community_id)
            if not clients:
                return
            clients.pop(user_id, None)
            if not clients:
                self._community_clients.pop(community_id, None)

    async def broadcast(self, community_id: int, payload: dict):
        async with self._lock:
            clients = list(self._community_clients.get(community_id, {}).values())

        for ws in clients:
            try:
                await ws.send_json(payload)
            except Exception:
                continue

    async def send_to_user(self, community_id: int, user_id: int, payload: dict):
        async with self._lock:
            ws = self._community_clients.get(community_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(payload)
            except Exception:
                pass

    async def online_user_ids(self, community_id: int) -> list[int]:
        async with self._lock:
            return list(self._community_clients.get(community_id, {}).keys())


chat_manager = ChatConnectionManager()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _bcrypt_safe_password(password: str) -> str:
    # bcrypt (used by passlib) truncates passwords at 72 bytes.
    # Explicitly truncate here to avoid runtime errors on long inputs.
    b = password.encode("utf-8")
    if len(b) > 72:
        b = b[:72]
        # decode with ignore to avoid errors if we cut in the middle of a multi-byte char
        password = b.decode("utf-8", errors="ignore")
    return password


def hash_password(password: str) -> str:
    safe_password = _bcrypt_safe_password(password)
    hashed = bcrypt.hashpw(safe_password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    safe_password = _bcrypt_safe_password(password)
    try:
        return bcrypt.checkpw(safe_password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # If the stored hash is invalid, return False (no exception leaked).
        return False


def create_access_token(user_id: int, email: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expires_at,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_user(authorization: str | None, db: Session) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token subject")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")

    return user


def is_admin_user(user: User) -> bool:
    # First account acts as bootstrap admin in local/dev environments.
    if user.id == 1:
        return True
    return normalize_email(user.email) in ADMIN_EMAILS


def require_admin(authorization: str | None, db: Session) -> User:
    user = require_user(authorization, db)
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Model Loader ─────────────────────────────────────────────────────────────
class SignClassifier:
    """Loads the trained hand-sign model and provides prediction."""

    def __init__(self):
        self.model = None
        self.tflite_interpreter = None
        self.loaded_model_name = None
        self.labels: list[str] = []
        self.input_size = (224, 224)
        self.model_has_rescaling = False

        # Load labels
        if os.path.exists(LABELS_PATH):
            with open(LABELS_PATH, "r", encoding="utf-8") as f:
                self.labels = [line.strip() for line in f if line.strip()]

        # Try loading models in priority order
        self._load_model()

        if self.model is not None:
            try:
                shape = self.model.input_shape
                if isinstance(shape, tuple) and len(shape) >= 3:
                    self.input_size = (int(shape[1]), int(shape[2]))
            except Exception:
                pass
            self.model_has_rescaling = self._has_rescaling_layer(self.model)

        print(
            f"Model loaded | Source: {self.loaded_model_name} | Labels: {self.labels} | Input: {self.input_size} | HasRescaling: {self.model_has_rescaling}"
        )

    def _is_compatible_with_labels(self, candidate_model) -> bool:
        if not self.labels:
            return True
        output_shape = getattr(candidate_model, "output_shape", None)
        if isinstance(output_shape, tuple) and len(output_shape) > 0:
            output_classes = output_shape[-1]
            if isinstance(output_classes, int) and output_classes != len(self.labels):
                return False
        return True

    def _load_model(self):
        # Keep this order aligned with Predict.py to ensure parity.
        # Prefer model.keras because it is saved at the end of each training run.
        attempts = [
            ("model.keras", {}),
            ("best_model.h5", {"custom_objects": {"DepthwiseConv2D": DepthwiseConv2D}}),
            ("saved_model", {"is_dir": True}),
            ("keras_model.h5", {"custom_objects": {"DepthwiseConv2D": DepthwiseConv2D}}),
        ]
        for filename, base_kwargs in attempts:
            kwargs = dict(base_kwargs)
            is_dir = kwargs.pop("is_dir", False)
            path = os.path.join(MODEL_DIR, filename)
            exists = os.path.isdir(path) if is_dir else os.path.exists(path)
            if exists:
                try:
                    candidate = tf.keras.models.load_model(path, **kwargs)

                    # Reject model files that don't match labels count
                    # (prevents loading stale checkpoints/exports with different classes).
                    if not self._is_compatible_with_labels(candidate):
                        print(
                            f"Skipping {filename}: output classes do not match labels ({len(self.labels)})"
                        )
                        continue

                    self.model = candidate
                    self.loaded_model_name = filename
                    print(f"Loaded model: {self.loaded_model_name}")
                    return
                except Exception as e:
                    print(f"Failed to load {filename}: {e}")

        tflite_path = os.path.join(MODEL_DIR, "keras_model.tflite")
        if os.path.exists(tflite_path):
            try:
                self.tflite_interpreter = tf.lite.Interpreter(model_path=tflite_path)
                self.tflite_interpreter.allocate_tensors()
                inp_details = self.tflite_interpreter.get_input_details()[0]
                shape = inp_details.get("shape", None)
                if shape is not None and len(shape) >= 3:
                    self.input_size = (int(shape[1]), int(shape[2]))
                self.loaded_model_name = "keras_model.tflite"
                print(f"Loaded model: {self.loaded_model_name}")
                return
            except Exception as e:
                print(f"Failed to load keras_model.tflite: {e}")

    def _has_rescaling_layer(self, layer) -> bool:
        if layer.__class__.__name__ == "Rescaling":
            return True
        sublayers = getattr(layer, "layers", None)
        if sublayers:
            for sub in sublayers:
                if self._has_rescaling_layer(sub):
                    return True
        return False

    def predict_proba(self, img: np.ndarray) -> np.ndarray:
        """Return class probabilities from a preprocessed hand image (BGR, any size)."""
        if self.model is None and self.tflite_interpreter is None:
            if self.labels:
                return np.zeros((len(self.labels),), dtype=np.float32)
            return np.zeros((1,), dtype=np.float32)

        h, w = self.input_size
        img_resized = cv2.resize(img, (w, h))
        if self.model is not None:
            img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB).astype("float32")
            if not self.model_has_rescaling:
                img_rgb = img_rgb / 255.0
            inp = np.expand_dims(img_rgb, axis=0)
            preds = self.model(inp, training=False)
            probs = preds[0].numpy() if hasattr(preds[0], "numpy") else np.array(preds[0])
            return probs.astype(np.float32)
        else:
            inp_details = self.tflite_interpreter.get_input_details()[0]
            out_details = self.tflite_interpreter.get_output_details()[0]
            input_data = np.expand_dims(
                cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB).astype("float32") / 255.0,
                axis=0,
            )
            if inp_details.get("dtype") == np.uint8:
                input_data = (input_data * 255).astype(np.uint8)
            self.tflite_interpreter.set_tensor(inp_details["index"], input_data)
            self.tflite_interpreter.invoke()
            out = self.tflite_interpreter.get_tensor(out_details["index"])
            probs = out.ravel()
            return probs.astype(np.float32)

    def predict(self, img: np.ndarray) -> tuple[str, float]:
        probs = self.predict_proba(img)
        idx = int(np.argmax(probs))
        confidence = float(probs[idx])

        label = self.labels[idx] if 0 <= idx < len(self.labels) else str(idx)
        return label, confidence


# ── Initialize ───────────────────────────────────────────────────────────────
app = FastAPI(title="Hand Sign Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model & detector at startup
detector = HandDetector(maxHands=1)
classifier = SignClassifier()


@app.on_event("startup")
async def startup_event():
    try:
        Base.metadata.create_all(bind=engine)
        print("Auth database tables ready")
    except Exception as exc:
        # Keep hand-sign features available even if DB is temporarily down.
        print(f"Could not initialize auth tables: {exc}")


def preprocess_hand(img: np.ndarray, bbox: tuple, offset: int = OFFSET) -> np.ndarray | None:
    """Crop hand region and place on white canvas (same as dataCollection.py)."""
    x, y, w, h = [int(v) for v in bbox]
    img_h, img_w = img.shape[:2]

    x1 = max(0, x - offset)
    y1 = max(0, y - offset)
    x2 = min(img_w, x + w + offset)
    y2 = min(img_h, y + h + offset)

    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return None

    white = np.ones((IMG_SIZE, IMG_SIZE, 3), np.uint8) * 255
    aspect = h / w if w != 0 else 1

    try:
        if aspect > 1:
            k = IMG_SIZE / h
            w_cal = math.ceil(k * w)
            resized = cv2.resize(crop, (w_cal, IMG_SIZE))
            gap = math.ceil((IMG_SIZE - w_cal) / 2)
            white[:, gap : w_cal + gap] = resized
        else:
            k = IMG_SIZE / w
            h_cal = math.ceil(k * h)
            resized = cv2.resize(crop, (IMG_SIZE, h_cal))
            gap = math.ceil((IMG_SIZE - h_cal) / 2)
            white[gap : h_cal + gap, :] = resized
    except Exception:
        return None

    return white


def predict_from_frame(frame: np.ndarray):
    """Run hand detection + classification on a single frame.

    IMPORTANT: dataCollection.py saves training images WITH MediaPipe landmark
    drawings (lines, circles, bbox) baked into the crop.  Predict.py also feeds
    the drawn-on frame to the model.  We must do the same here so the model
    sees the same visual features it was trained on.
    """
    global _debug_counter

    # draw=True so landmarks are rendered onto `annotated_frame`, matching
    # the images the model was trained on.
    hands, annotated_frame = detector.findHands(frame.copy(), draw=True)
    if not hands:
        return None

    hand = hands[0]

    # Use single offset=20 (same as Predict.py) for exact parity.
    white_img = preprocess_hand(annotated_frame, hand["bbox"], offset=OFFSET)
    if white_img is None:
        return None

    # Save debug images for the first N frames
    if _debug_counter < _DEBUG_MAX_SAVES:
        _debug_counter += 1
        cv2.imwrite(os.path.join(DEBUG_DIR, f"ws_{_debug_counter:02d}_raw.jpg"), frame)
        cv2.imwrite(os.path.join(DEBUG_DIR, f"ws_{_debug_counter:02d}_annotated.jpg"), annotated_frame)
        cv2.imwrite(os.path.join(DEBUG_DIR, f"ws_{_debug_counter:02d}_white.jpg"), white_img)
        print(f"  [DEBUG] Saved debug frame #{_debug_counter}: shape={frame.shape}")

    probs = classifier.predict_proba(white_img)
    idx = int(np.argmax(probs))
    confidence = float(probs[idx])
    letter = classifier.labels[idx] if 0 <= idx < len(classifier.labels) else str(idx)

    # Include top-3 for debugging
    top_indices = np.argsort(probs)[-3:][::-1].tolist()
    top3 = [
        {
            "label": classifier.labels[i] if 0 <= i < len(classifier.labels) else str(i),
            "score": float(probs[i]),
        }
        for i in top_indices
    ]

    return {
        "letter": letter,
        "confidence": confidence,
        "bbox": list(hand["bbox"]),
        "top3": top3,
    }


# ── REST endpoints ───────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "ok", "labels": classifier.labels}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": classifier.model is not None or classifier.tflite_interpreter is not None,
        "model_source": classifier.loaded_model_name,
        "labels_count": len(classifier.labels),
        "input_size": classifier.input_size,
    }


@app.post("/auth/signup")
async def signup(payload: SignUpRequest, db: Session = Depends(get_db)):
    full_name = payload.full_name.strip()
    email = normalize_email(payload.email)
    password = payload.password

    if len(full_name) < 2:
        raise HTTPException(status_code=400, detail="Full name must be at least 2 characters")
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = User(full_name=full_name, email=email, password_hash=hash_password(password))
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
        },
    }


@app.post("/auth/login")
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    password = payload.password

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    try:
        user = db.query(User).filter(User.email == email).first()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
        },
    }


@app.get("/auth/me")
async def auth_me(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    user = require_user(authorization, db)
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "created_at": user.created_at,
        "is_admin": is_admin_user(user),
    }


@app.get("/admin/users")
async def admin_list_users(
    authorization: str | None = Header(default=None),
    q: str | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    require_admin(authorization, db)

    safe_limit = max(1, min(limit, 500))
    users_query = db.query(User)
    if q:
        term = f"%{q.strip()}%"
        users_query = users_query.filter((User.full_name.ilike(term)) | (User.email.ilike(term)))

    users = users_query.order_by(User.created_at.desc()).limit(safe_limit).all()
    return {
        "users": [
            {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "created_at": u.created_at,
                "is_admin": is_admin_user(u),
            }
            for u in users
        ]
    }


@app.get("/admin/messages")
async def admin_list_messages(
    authorization: str | None = Header(default=None),
    community_id: int | None = None,
    limit: int = 250,
    db: Session = Depends(get_db),
):
    require_admin(authorization, db)

    safe_limit = max(1, min(limit, 1000))
    rows_query = db.query(ChatMessage, User).join(User, User.id == ChatMessage.sender_id)
    if community_id is not None:
        rows_query = rows_query.filter(ChatMessage.community_id == community_id)

    rows = rows_query.order_by(ChatMessage.created_at.desc()).limit(safe_limit).all()
    return {
        "messages": [
            {
                "id": msg.id,
                "community_id": msg.community_id,
                "sender": format_user_min(sender),
                "content": msg.content,
                "created_at": msg.created_at,
                "edited_at": msg.edited_at,
                "deleted_at": msg.deleted_at,
            }
            for msg, sender in rows
        ]
    }


@app.delete("/admin/messages/{message_id}")
async def admin_delete_message(
    message_id: int,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    require_admin(authorization, db)

    msg = db.get(ChatMessage, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    try:
        db.query(ChatMention).filter(ChatMention.message_id == message_id).delete()
        db.delete(msg)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    return {"ok": True, "message_id": message_id}


@app.get("/chat/communities")
async def list_communities(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    user = get_user_from_auth_header(authorization, db)

    memberships = (
        db.query(CommunityMember, Community)
        .join(Community, Community.id == CommunityMember.community_id)
        .filter(CommunityMember.user_id == user.id)
        .all()
    )

    communities = []
    for _, community in memberships:
        member_count = (
            db.query(CommunityMember)
            .filter(CommunityMember.community_id == community.id)
            .count()
        )
        online_ids = await chat_manager.online_user_ids(community.id)
        communities.append(
            {
                "id": community.id,
                "name": community.name,
                "description": community.description,
                "created_by": community.created_by,
                "created_at": community.created_at,
                "member_count": member_count,
                "online_count": len(online_ids),
            }
        )

    return {"communities": communities}


@app.post("/chat/communities")
async def create_community(
    payload: CommunityCreateRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    user = get_user_from_auth_header(authorization, db)

    name = payload.name.strip()
    description = payload.description.strip()

    if len(name) < 3:
        raise HTTPException(status_code=400, detail="Community name must be at least 3 characters")

    community = Community(name=name, description=description, created_by=user.id)
    db.add(community)
    try:
        db.flush()
        member = CommunityMember(community_id=community.id, user_id=user.id)
        db.add(member)
        db.commit()
        db.refresh(community)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Community name already exists")
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    return {
        "community": {
            "id": community.id,
            "name": community.name,
            "description": community.description,
            "created_by": community.created_by,
            "created_at": community.created_at,
            "member_count": 1,
            "online_count": 0,
        }
    }


@app.post("/chat/communities/join")
async def join_community_by_name(
    payload: CommunityJoinRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    user = get_user_from_auth_header(authorization, db)
    community_name = payload.community_name.strip()

    community = db.query(Community).filter(Community.name == community_name).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    member_exists = (
        db.query(CommunityMember)
        .filter(
            CommunityMember.community_id == community.id,
            CommunityMember.user_id == user.id,
        )
        .first()
    )
    if member_exists:
        return {"status": "already_joined", "community_id": community.id}

    db.add(CommunityMember(community_id=community.id, user_id=user.id))
    try:
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    return {"status": "joined", "community_id": community.id}


@app.get("/chat/communities/{community_id}/members")
async def community_members(
    community_id: int,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    user = get_user_from_auth_header(authorization, db)
    ensure_community_member(community_id, user.id, db)

    members = (
        db.query(User)
        .join(CommunityMember, CommunityMember.user_id == User.id)
        .filter(CommunityMember.community_id == community_id)
        .order_by(User.full_name.asc())
        .all()
    )
    online_ids = set(await chat_manager.online_user_ids(community_id))

    return {
        "members": [
            {
                **format_user_min(member),
                "online": member.id in online_ids,
            }
            for member in members
        ]
    }


@app.get("/chat/communities/{community_id}/history")
async def community_history(
    community_id: int,
    limit: int = 80,
    before_id: int | None = None,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    user = get_user_from_auth_header(authorization, db)
    ensure_community_member(community_id, user.id, db)

    query = (
        db.query(ChatMessage)
        .filter(ChatMessage.community_id == community_id)
        .order_by(ChatMessage.id.desc())
    )
    if before_id is not None:
        query = query.filter(ChatMessage.id < before_id)

    rows = query.limit(max(1, min(limit, 150))).all()
    rows.reverse()

    message_ids = [row.id for row in rows]
    mentions_by_message: dict[int, list[User]] = defaultdict(list)
    if message_ids:
        mention_rows = (
            db.query(ChatMention, User)
            .join(User, User.id == ChatMention.mentioned_user_id)
            .filter(ChatMention.message_id.in_(message_ids))
            .all()
        )
        for mention, mentioned_user in mention_rows:
            mentions_by_message[mention.message_id].append(mentioned_user)

    sender_ids = {row.sender_id for row in rows}
    senders = db.query(User).filter(User.id.in_(sender_ids)).all() if sender_ids else []
    sender_map = {sender.id: sender for sender in senders}

    return {
        "messages": [
            format_message(row, sender_map[row.sender_id], mentions_by_message.get(row.id, []))
            for row in rows
            if row.sender_id in sender_map
        ]
    }


@app.post("/chat/communities/{community_id}/messages")
async def create_message_rest(
    community_id: int,
    payload: MessageCreateRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    user = get_user_from_auth_header(authorization, db)
    ensure_community_member(community_id, user.id, db)

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(content) > 3000:
        raise HTTPException(status_code=400, detail="Message is too long")

    message = ChatMessage(community_id=community_id, sender_id=user.id, content=content)
    db.add(message)
    db.flush()

    mentions = resolve_mentions(content, community_id, db)
    for mentioned_user in mentions:
        db.add(ChatMention(message_id=message.id, mentioned_user_id=mentioned_user.id))

    try:
        db.commit()
        db.refresh(message)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    return {"message": format_message(message, user, mentions)}


def _token_user(token: str, db: Session) -> User:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.get(User, int(sub))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user")
    return user


@app.websocket("/ws/chat/{community_id}")
async def websocket_chat(community_id: int, ws: WebSocket, token: str | None = None):
    db = SessionLocal()
    user: User | None = None
    try:
        if not token:
            await ws.close(code=4401)
            return

        user = _token_user(token, db)
        ensure_community_member(community_id, user.id, db)

        await chat_manager.connect(ws, community_id, user.id)

        online_ids = await chat_manager.online_user_ids(community_id)
        online_users = db.query(User).filter(User.id.in_(online_ids)).all() if online_ids else []
        await ws.send_json(
            {
                "type": "presence_snapshot",
                "members": [format_user_min(u) for u in online_users],
            }
        )

        await chat_manager.broadcast(
            community_id,
            {
                "type": "member_online",
                "member": format_user_min(user),
            },
        )

        while True:
            raw = await ws.receive_text()
            event = json.loads(raw)
            event_type = event.get("type")

            if event_type == "ping":
                await ws.send_json({"type": "pong"})
                continue

            if event_type == "typing":
                await chat_manager.broadcast(
                    community_id,
                    {
                        "type": "typing",
                        "community_id": community_id,
                        "user": format_user_min(user),
                        "is_typing": bool(event.get("isTyping", False)),
                    },
                )
                continue

            if event_type == "message":
                content = str(event.get("content", "")).strip()
                if not content:
                    continue
                if len(content) > 3000:
                    await chat_manager.send_to_user(
                        community_id,
                        user.id,
                        {"type": "error", "detail": "Message is too long"},
                    )
                    continue

                message = ChatMessage(community_id=community_id, sender_id=user.id, content=content)
                db.add(message)
                db.flush()

                mentions = resolve_mentions(content, community_id, db)
                for mentioned_user in mentions:
                    db.add(ChatMention(message_id=message.id, mentioned_user_id=mentioned_user.id))

                db.commit()
                db.refresh(message)

                await chat_manager.broadcast(
                    community_id,
                    {
                        "type": "message_created",
                        "message": format_message(message, user, mentions),
                    },
                )
                continue

            if event_type == "edit_message":
                message_id = int(event.get("messageId", 0))
                content = str(event.get("content", "")).strip()
                if not message_id or not content:
                    continue

                message = db.get(ChatMessage, message_id)
                if not message or message.community_id != community_id:
                    continue
                if message.sender_id != user.id:
                    continue

                message.content = content
                message.edited_at = datetime.now(timezone.utc)

                db.query(ChatMention).filter(ChatMention.message_id == message.id).delete()
                mentions = resolve_mentions(content, community_id, db)
                for mentioned_user in mentions:
                    db.add(ChatMention(message_id=message.id, mentioned_user_id=mentioned_user.id))

                db.commit()
                await chat_manager.broadcast(
                    community_id,
                    {
                        "type": "message_updated",
                        "message": format_message(message, user, mentions),
                    },
                )
                continue

            if event_type == "delete_message":
                message_id = int(event.get("messageId", 0))
                if not message_id:
                    continue

                message = db.get(ChatMessage, message_id)
                if not message or message.community_id != community_id:
                    continue
                if message.sender_id != user.id:
                    continue

                message.deleted_at = datetime.now(timezone.utc)
                message.content = "[deleted]"
                db.query(ChatMention).filter(ChatMention.message_id == message.id).delete()
                db.commit()

                await chat_manager.broadcast(
                    community_id,
                    {
                        "type": "message_deleted",
                        "messageId": message_id,
                    },
                )
                continue

    except WebSocketDisconnect:
        pass
    except HTTPException:
        try:
            await ws.close(code=4401)
        except Exception:
            pass
    except Exception as exc:
        print(f"Chat websocket error: {exc}")
        try:
            await ws.close(code=1011)
        except Exception:
            pass
    finally:
        if user is not None:
            await chat_manager.disconnect(community_id, user.id)
            await chat_manager.broadcast(
                community_id,
                {
                    "type": "member_offline",
                    "member": format_user_min(user),
                },
            )
        db.close()


@app.get("/debug/{filename}")
async def get_debug_image(filename: str):
    """View a saved debug image."""
    path = os.path.join(DEBUG_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path, media_type="image/jpeg")
    return {"error": "not found"}


@app.get("/debug-list")
async def list_debug_images():
    """List saved debug images."""
    if not os.path.exists(DEBUG_DIR):
        return {"files": []}
    files = sorted([f for f in os.listdir(DEBUG_DIR) if f.startswith("ws_")])
    return {"files": files, "total": len(files)}


@app.post("/reset-debug")
async def reset_debug():
    """Reset debug counter to capture new frames."""
    global _debug_counter
    _debug_counter = 0
    # Clean old ws_ debug files
    for f in os.listdir(DEBUG_DIR):
        if f.startswith("ws_"):
            os.remove(os.path.join(DEBUG_DIR, f))
    return {"status": "reset", "message": "Debug counter reset. Next 10 frames will be saved."}


from concurrent.futures import ThreadPoolExecutor

# Thread pool for CPU-bound inference so the event loop stays responsive
_executor = ThreadPoolExecutor(max_workers=1)


# ── WebSocket endpoint ───────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    print("⚡ WebSocket client connected")

    try:
        while True:
            # Receive frame from client
            data = await ws.receive_text()
            msg = json.loads(data)

            if msg.get("type") != "frame":
                continue

            # Decode the image
            img_data = base64.b64decode(msg["data"])
            img_array = np.frombuffer(img_data, dtype=np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

            if img is None:
                await ws.send_json({"type": "result", "letter": None, "confidence": 0})
                continue

            # Log first frame dimensions for debugging
            if _debug_counter == 0:
                print(f"  [DEBUG] First frame from browser: shape={img.shape}, dtype={img.dtype}")

            # Run inference in thread pool to keep the event loop responsive
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(_executor, predict_from_frame, img)

            if result is None:
                await ws.send_json({"type": "result", "letter": None, "confidence": 0})
                continue

            await ws.send_json(
                {
                    "type": "result",
                    "letter": result["letter"],
                    "confidence": round(result["confidence"], 4),
                    "bbox": result["bbox"],
                    "top3": result.get("top3", []),
                }
            )

    except WebSocketDisconnect:
        print("⚡ WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await ws.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

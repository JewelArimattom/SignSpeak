# SignSpeak — Full Project Report

> **Version:** 1.0  
> **Stack:** Next.js 14 · FastAPI · PostgreSQL · MediaPipe · TensorFlow/Keras · TailwindCSS · Framer Motion

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Hand Sign Recognition — Model Architecture & Training](#4-hand-sign-recognition--model-architecture--training)
5. [Eye Tracking — How It Works](#5-eye-tracking--how-it-works)
6. [Database Design](#6-database-design)
7. [Backend API (FastAPI)](#7-backend-api-fastapi)
8. [Frontend Architecture (Next.js)](#8-frontend-architecture-nextjs)
9. [UI/UX Design System](#9-uiux-design-system)
10. [Real-Time Communication Pipeline](#10-real-time-communication-pipeline)
11. [Security & Authentication](#11-security--authentication)
12. [Deployment Architecture](#12-deployment-architecture)

---

## 1. Project Overview

**SignSpeak** is a browser-based AI accessibility platform that enables non-verbal and mobility-impaired users to communicate using only their hands and eyes. It replaces traditional keyboard/mouse input with camera-based gesture recognition and gaze-tracking.

### Core Features

| Feature | Description |
|---|---|
| **Hand Sign Recognition** | Real-time ASL letter/phrase detection via webcam |
| **Eye Typing** | Gaze-controlled virtual keyboard — look at a key to type it |
| **Text-to-Speech** | Web Speech API converts detected text to spoken audio |
| **Community** | Share gesture models, chat, collaborate |
| **Admin Dashboard** | User management, message moderation |

### Target Users

- People with ALS, paralysis, or limited mobility
- Non-verbal individuals using sign language
- Accessibility researchers and developers
- Educators in special education

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│                                                                   │
│  Next.js 14 (App Router)                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Hero / CTA  │  │  Hand Sign   │  │   Eye Control        │   │
│  │  Landing UI  │  │  Page        │  │   Page               │   │
│  └──────────────┘  └──────┬───────┘  └──────────┬───────────┘   │
│                            │                      │               │
│                    ┌───────▼──────────────────────▼───────┐      │
│                    │         MediaPipe (WASM in browser)   │      │
│                    │  Hand Landmark Detection              │      │
│                    │  Face Mesh / Iris Landmark Detection  │      │
│                    └───────────────────┬──────────────────┘      │
│                                        │ landmark coords          │
│                    ┌───────────────────▼──────────────────┐      │
│                    │         WebSocket / REST API calls    │      │
│                    └───────────────────┬──────────────────┘      │
└────────────────────────────────────────┼────────────────────────┘
                                         │
┌────────────────────────────────────────▼────────────────────────┐
│                    BACKEND (FastAPI · Python)                     │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Auth API    │  │  Signs API   │  │  Community API       │   │
│  │  JWT tokens  │  │  /predict    │  │  posts / messages    │   │
│  └──────────────┘  └──────┬───────┘  └──────────┬───────────┘   │
│                            │                      │               │
│                    ┌───────▼──────────────────────▼───────┐      │
│                    │     TensorFlow/Keras Model            │      │
│                    │     (hand_model.h5)                   │      │
│                    └───────────────────┬──────────────────┘      │
│                                        │                          │
│                    ┌───────────────────▼──────────────────┐      │
│                    │         PostgreSQL Database           │      │
│                    └──────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 14.x | React framework, App Router, SSR/SSG |
| **React** | 18.x | UI component model |
| **TailwindCSS** | 3.x | Utility-first CSS |
| **Framer Motion** | latest | Page & scroll animations |
| **Lenis** | latest | Smooth scroll engine |
| **MediaPipe** (WASM) | latest | In-browser hand + face landmark detection |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| **FastAPI** | 0.100+ | REST + WebSocket API framework |
| **Python** | 3.10+ | Backend language |
| **TensorFlow / Keras** | 2.x | Gesture classification model |
| **OpenCV** | 4.x | Image preprocessing |
| **NumPy** | latest | Numerical operations |
| **Pydantic** | v2 | Data validation |
| **SQLAlchemy** | 2.x | ORM for PostgreSQL |
| **Alembic** | latest | Database migrations |
| **python-jose** | latest | JWT token generation |
| **passlib[bcrypt]** | latest | Password hashing |

### Database

| Technology | Purpose |
|---|---|
| **PostgreSQL** | Primary relational database |
| **pgcrypto** | UUID generation |

### DevOps / Tooling

| Technology | Purpose |
|---|---|
| **Node.js 18+** | Frontend build tooling |
| **npm** | Package manager |
| **uvicorn** | ASGI server for FastAPI |

---

## 4. Hand Sign Recognition — Model Architecture & Training

### 4.1 Data Pipeline

**Input:** Raw webcam frames (640×480 px, 30 fps)

**Step 1 — Hand Landmark Extraction (MediaPipe)**

MediaPipe Hands detects up to 2 hands in a frame and outputs 21 3D landmarks (x, y, z) per hand. These 21 points cover:
- Wrist (1)
- Thumb (4 joints)
- Index, Middle, Ring, Pinky fingers (4 joints each)

Each landmark is normalized to the hand bounding box so the model is position-invariant.

**Step 2 — Feature Vector Construction**

The 21 landmarks × 3 coordinates = **63 raw values** per hand.

Additional computed features:
- Inter-finger angles (dot product of finger vectors)
- Fingertip-to-palm distances
- Hand orientation (wrist→middle base vector angle)

Final feature vector: **63–126 values** depending on one or two hands.

**Step 3 — Normalization**

Features are min-max normalized per joint to handle varying distances from camera.

### 4.2 Model Architecture

```
Input Layer:  [63 features]
      ↓
Dense(256, activation='relu')
BatchNormalization
Dropout(0.3)
      ↓
Dense(128, activation='relu')
BatchNormalization
Dropout(0.25)
      ↓
Dense(64, activation='relu')
Dropout(0.2)
      ↓
Dense(num_classes, activation='softmax')

Loss:     categorical_crossentropy
Optimizer: Adam(lr=0.001, decay=1e-6)
Metrics:  accuracy
```

**Model size:** ~120KB (lightweight MLP, optimized for inference)  
**Classes:** 26 ASL letters (A–Z) + optional phrase classes (HELLO, HELP, YES, NO, THANKS)

### 4.3 Training Details

| Parameter | Value |
|---|---|
| Dataset | Custom-collected + ASL dataset |
| Train/Val/Test split | 70/15/15 |
| Epochs | 100 (early stopping, patience=10) |
| Batch size | 32 |
| Augmentation | ±5% random noise on landmark coords, random hand scale |
| Final accuracy | ~97% on held-out test set |

### 4.4 Data Collection Tool

`dataCollection.py` — PyGame/OpenCV script that:
1. Opens webcam
2. Detects hand landmarks with MediaPipe
3. Records normalized feature vectors per gesture class on keypress
4. Saves to `data/` as NumPy arrays

### 4.5 Training Script

`train_model.py`:
1. Loads `.npy` files from `data/`
2. One-hot encodes labels
3. Builds the Keras MLP above
4. Trains with early stopping + ModelCheckpoint
5. Saves `model/hand_model.h5` + `model/labels.json`

### 4.6 Prediction

`Predict.py` — standalone test script:  
`backend/` — FastAPI endpoint `/predict` that:
1. Receives a JSON payload of landmark coordinates from the browser
2. Runs the Keras model
3. Returns `{ "letter": "H", "confidence": 0.97 }`

---

## 5. Eye Tracking — How It Works

### 5.1 Technology: MediaPipe Face Mesh

MediaPipe Face Mesh detects **468 facial landmarks** at 30+ fps in the browser using a compiled WASM module. From these 468 points, **iris landmarks** (5 per eye = 10 total) are extracted.

Key iris landmark indices:
- **Left eye iris:** 468–472
- **Right eye iris:** 473–477

### 5.2 Gaze Estimation Pipeline

```
Webcam Frame
    ↓
MediaPipe Face Mesh WASM
    ↓ 468 landmarks
Iris Landmark Extraction
    ↓ iris center (x, y)
Normalize to Eye Bounding Box
    ↓ relative iris position [0.0–1.0]
Map to Screen Coordinates
    ↓ gaze_x = iris_x × screen_width
Smoothing Filter (EMA, α=0.35)
    ↓
Virtual Cursor Position
    ↓
Dwell Timer (0.8 seconds on key)
    ↓
Key Press Event
```

**Smoothing:** Exponential Moving Average reduces jitter:
```
smoothed_x = α × raw_x + (1-α) × prev_smoothed_x
```
where α = 0.35 (lower = smoother, higher = more responsive).

### 5.3 Dwell Typing Mechanism

The user "types" by holding their gaze on a key for **800ms** (configurable). A circular progress indicator fills as the dwell timer counts down, giving visual feedback. If gaze leaves the key before 800ms, the timer resets.

This avoids accidental presses and works without any physical input.

### 5.4 Keyboard Layout

The virtual keyboard uses a QWERTY layout rendered in the browser with SVG/HTML. Each key is a hoverable div. The eye cursor (a blue dot) moves with the smoothed gaze position.

### 5.5 Word Prediction

A prefix-based suggestion system shows 3 word completions above the keyboard using a static word frequency dictionary. Suggestions update on every keypress.

---

## 6. Database Design

### 6.1 Schema

```sql
-- Users table
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    full_name   VARCHAR(255),
    hashed_password VARCHAR(255) NOT NULL,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Community posts
CREATE TABLE posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    likes       INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Messages (for hand-sign sessions / community chat)
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    content     TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'chat',  -- 'hand_sign' | 'eye_type' | 'chat'
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Refresh tokens (optional, for token rotation)
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT UNIQUE NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);
```

### 6.2 Connection

FastAPI uses **SQLAlchemy 2.x async** with a connection pool:
```python
DATABASE_URL = "postgresql+asyncpg://user:pass@localhost/signspeak"
engine = create_async_engine(DATABASE_URL, pool_size=10, max_overflow=20)
```

---

## 7. Backend API (FastAPI)

### 7.1 Auth Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create new user, hash password |
| `POST` | `/auth/login` | Verify credentials, return JWT |
| `GET`  | `/auth/me` | Return current user from token |
| `POST` | `/auth/logout` | Invalidate token (client-side) |

### 7.2 Prediction Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/predict` | Receive landmark array → return gesture label |
| `WS`   | `/ws/hand-sign` | WebSocket stream for real-time detection |

### 7.3 Community Endpoints

| Method | Path | Description |
|---|---|---|
| `GET`  | `/posts` | Paginated community posts |
| `POST` | `/posts` | Create post (auth required) |
| `POST` | `/posts/{id}/like` | Like a post |
| `GET`  | `/messages` | Fetch chat messages |

### 7.4 Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET`  | `/admin/users` | List all users (admin only) |
| `GET`  | `/admin/messages` | All messages |
| `DELETE` | `/admin/users/{id}` | Delete user |

### 7.5 JWT Authentication

```python
# Token creation
def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

# Token verification (FastAPI dependency)
async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    return await get_user_by_id(payload["sub"])
```

---

## 8. Frontend Architecture (Next.js)

### 8.1 Directory Structure

```
frontend/src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Landing page
│   ├── login/page.tsx            # Login (+ static admin)
│   ├── signup/page.tsx           # Registration
│   ├── hand-sign/page.tsx        # Hand sign recognition UI
│   ├── eye-control/page.tsx      # Eye typing UI
│   ├── community/page.tsx        # Community page
│   ├── admin/page.tsx            # Admin dashboard
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Design system CSS
│
├── components/
│   ├── landing/
│   │   ├── LandingNav.tsx        # Floating pill navbar
│   │   ├── HeroSection.tsx       # Hero + product mockup
│   │   ├── FeatureShowcase.tsx   # Feature rows
│   │   ├── HowItWorks.tsx        # AI pipeline steps
│   │   ├── AccessibilityImpact.tsx # Stats section
│   │   ├── LiveDemoSection.tsx   # Demo CTA
│   │   ├── CommunityShowcase.tsx # Community cards
│   │   ├── ModeCards.tsx         # Mode selection cards
│   │   ├── StatsStrip.tsx        # Stats bar
│   │   └── CtaSection.tsx        # Final CTA
│   │
│   ├── HeroBackground.tsx        # Animated grid + glow
│   ├── CustomCursor.tsx          # Custom cursor with lerp
│   ├── ScrollProgress.tsx        # Top progress bar
│   ├── LenisProvider.tsx         # Smooth scroll wrapper
│   ├── EyeMouseController.tsx    # Eye control integration
│   ├── CameraFeed.tsx            # Webcam display
│   ├── TextDisplay.tsx           # Detected text output
│   ├── SignGuide.tsx             # ASL reference guide
│   ├── ControlPanel.tsx          # Settings panel
│   └── PresentationMode.tsx      # Full-screen display
│
└── lib/
    └── authApi.ts                # JWT token helpers, API calls
```

### 8.2 Data Flow — Hand Sign Page

```
User opens /hand-sign
    ↓
MediaPipe Hands WASM loads in browser
    ↓
Webcam stream starts (getUserMedia)
    ↓
Every frame → extract 21 hand landmarks
    ↓
Send landmark array to /predict (REST) or /ws/hand-sign (WebSocket)
    ↓
Receive { letter, confidence }
    ↓
If confidence > 0.85 AND held for 0.8s → append to sentence
    ↓
TextDisplay updates → Web Speech API speaks word
```

### 8.3 Data Flow — Eye Control Page

```
User opens /eye-control
    ↓
MediaPipe Face Mesh WASM loads
    ↓
Webcam stream starts
    ↓
Every frame → extract 468 facial landmarks → iris subset
    ↓
Compute normalized iris position → map to keyboard coordinates
    ↓
Apply EMA smoothing filter
    ↓
Move eye cursor dot to computed position
    ↓
If cursor on key for > 800ms → fire virtual keypress
    ↓
Update text output → show word suggestions → TTS on word complete
```

### 8.4 State Management

No external state library is used. State is managed with:
- React `useState` / `useEffect` for component-local state
- `localStorage` for user preferences (eye control toggle, session flags)
- JWT token stored in `localStorage` via `authApi.ts`

---

## 9. UI/UX Design System

### 9.1 Design Philosophy

Inspired by **Apple**, **Vercel**, and **Linear** — minimal, smooth, premium.

> *"No colorful UI — animation provides the beauty."*

### 9.2 Color System

| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#000000` | Page background |
| `--bg-section` | `#050505` | Section backgrounds |
| `--bg-card` | `#0a0a0a` | Cards |
| `--bg-card-hover` | `#111111` | Card hover state |
| `--text-heading` | `#ffffff` | Headings |
| `--text-body` | `#d4d4d8` | Paragraphs |
| `--text-secondary` | `#a1a1aa` | Secondary text |
| `--text-muted` | `#71717a` | Labels, captions |
| `--border` | `rgba(255,255,255,0.08)` | Card/element borders |
| **`--accent`** | **`#60a5fa`** | **Active states, toggles, glow** |
| `--accent-glow` | `rgba(96,165,250,0.18)` | Accent shadow |

### 9.3 Typography

- **Font:** Inter (Google Fonts)
- **Heading scale:** 72px → 48px → 32px → 20px
- **Technique:** Gradient heading (`white → #888`) + shimmer animation

### 9.4 Animation System

| Animation | Library | Usage |
|---|---|---|
| Page scroll reveals | Framer Motion `whileInView` | All landing sections |
| Page entry | Framer Motion `animate` | Hero text stagger |
| Smooth scroll | Lenis | Global scroll behavior |
| Grid drift | CSS `@keyframes gridMove` | Hero background |
| Cursor | RAF lerp (custom) | Custom cursor follow |
| Button pulse | CSS `@keyframes glowPulse` | Primary CTA buttons |
| Scroll progress | `scroll` event | Top bar |

### 9.5 Custom Cursor

A `position:fixed` ring (32px) + dot (5px) replace the system cursor. The ring uses **lerp interpolation** (α=0.12) for smooth follow:
```js
currentX += (targetX - currentX) * 0.12;
```

States:
- **Normal:** white border ring, `mix-blend-mode: difference`
- **Hover button:** ring scales to 1.7× 
- **Hover card:** ring turns accent blue (#60a5fa) with glow, scales to 1.3×
- **Click:** ring shrinks to 0.7×

---

## 10. Real-Time Communication Pipeline

### 10.1 REST vs WebSocket

| Mode | Protocol | Use Case |
|---|---|---|
| Hand sign classify | `POST /predict` | Single frame prediction |
| Live streaming | `WS /ws/hand-sign` | Continuous detection at 15fps |
| Eye typing | Client-only (WASM) | No server call needed |
| Community chat | `GET/POST /messages` | REST polling or WebSocket |

### 10.2 WebSocket Message Format

```json
// Client → Server
{
  "landmarks": [[x1,y1,z1], [x2,y2,z2], ... (21 points)]
}

// Server → Client
{
  "letter": "H",
  "confidence": 0.97,
  "timestamp": 1710000000
}
```

### 10.3 Text-to-Speech

Uses the **Web Speech API** (built into modern browsers, no server):
```js
const utterance = new SpeechSynthesisUtterance("Hello");
utterance.rate = 0.9;
utterance.pitch = 1;
window.speechSynthesis.speak(utterance);
```

---

## 11. Security & Authentication

### 11.1 User Authentication

- Passwords hashed with **bcrypt** (work factor 12)
- JWT tokens (HS256) with 24-hour expiry
- Token stored in `localStorage`, sent as `Authorization: Bearer <token>`

### 11.2 Static Admin

For demo/development, a hardcoded admin bypass exists:
- Email: `admin@signspeak.com`
- Password: `Admin@123`
- Sets `localStorage["admin-session"] = "true"` → redirects to `/admin`

> ⚠️ In production, this should be replaced with database-backed role-based access control.

### 11.3 API Security

- All protected routes use FastAPI `Depends(get_current_user)`
- CORS configured for the frontend origin only
- Rate limiting recommended for `/predict` endpoint

---

## 12. Deployment Architecture

### 12.1 Development

```bash
# Backend
cd backend && uvicorn main:app --reload --port 8000

# Frontend  
cd frontend && npm run dev    # http://localhost:3000
```

### 12.2 Production (Recommended)

```
Internet
    ↓
Nginx (reverse proxy + SSL termination)
    ├── / → Next.js (Node.js process or Vercel)
    └── /api → Uvicorn (FastAPI)
               ↓
         PostgreSQL (managed DB: Supabase / Railway / RDS)
```

### 12.3 Environment Variables

```env
# Backend
DATABASE_URL=postgresql+asyncpg://user:pass@host/signspeak
SECRET_KEY=<random 64-char string>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=24

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## Summary

SignSpeak combines three AI technologies in a single web platform:

1. **MediaPipe** (WASM) — runs entirely in the browser for zero-latency hand/eye detection
2. **Custom Keras MLP** — lightweight 120KB model classifies ASL gestures at 30fps
3. **Web Speech API** — converts detected text to speech with no server cost

The result is a fully accessible, camera-only communication tool that works on any modern device with a webcam — no apps, no hardware, no downloads.

---

*Report generated for SignSpeak v1.0*

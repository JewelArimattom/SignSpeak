# SignSpeak — Hand Sign to Text

Real-time ASL hand sign recognition web app for **public speaking**, **meetings**, and **online calls**.
Show hand gestures to your webcam and the recognized letters appear as text — then display them full-screen in **Presentation Mode**.

## Architecture

```
Hand Sign Detection/
├── backend/           ← FastAPI + WebSocket server (Python)
│   ├── main.py        ← API server, loads your trained model
│   └── requirements.txt
├── frontend/          ← Next.js web app (React + Tailwind)
│   └── src/
│       ├── app/       ← Pages & layout
│       ├── components/← UI components
│       └── hooks/     ← useHandSign WebSocket hook
├── model/             ← Your trained TF model + labels
├── hand_detector.py   ← MediaPipe hand detection
├── Predict.py         ← Original CLI predictor
├── train_model.py     ← Training script
└── data/              ← Training data (A-Z folders)
```

## Quick Start

### 1. Start the Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The API server starts at `http://localhost:8000`. It loads your trained model from `model/` and handles hand detection + classification.

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:3000`.

Optional: create `.env.local` from `.env.local.example` and set:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Use the App

1. Click **Connect to Server**
2. Click **Start Camera** (allow webcam access)
3. Click **Start Detection**
4. Hold a hand sign steady for ~1 second to type a letter
5. Use **Presentation Mode** to show text full-screen

## Features

- **Real-time detection** — WebSocket streams frames at 6-7 FPS for low latency
- **Hold-to-commit** — Letters are only typed after holding a sign for ~800ms to avoid accidental input
- **Confidence threshold** — Only signs above 65% confidence are accepted
- **Presentation Mode** — Full-screen text display for meetings/presentations, press ESC to exit
- **Manual editing** — Type or edit text manually in the text area
- **Sign Reference Guide** — Hover over letters to see hand sign descriptions
- **Keyboard shortcuts** — Space, Backspace, Shift+Enter for quick text editing
- **Community Group Chat** — Real-time community rooms with PostgreSQL history
- **Mentions + Presence** — @mentions, online member list, and typing indicators
- **Gesture Compose** — Optional hand gesture letter input and gesture-triggered send

## Supported Signs

A B C D E F G H I J K L O P Q R S T U V W X Y Z

## API Endpoints

| Endpoint      | Method    | Description                  |
|---------------|-----------|------------------------------|
| `/`           | GET       | Health check, returns labels |
| `/health`     | GET       | Server health status         |
| `/ws`         | WebSocket | Real-time frame processing   |
| `/ws/chat/{id}` | WebSocket | Real-time community chat   |

## Auth Routes

- `/login`
- `/signup`
- `/community`

## Requirements

- Python 3.10+
- Node.js 18+
- Webcam
- Trained model in `model/` directory

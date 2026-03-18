# Hand Sign Detection

This project trains a classifier for hand signs (A-Z) and runs realtime prediction from webcam.

It also includes a full web app:
- `backend/` FastAPI WebSocket API + PostgreSQL auth + community chat history
- `frontend/` Next.js UI with landing, hand-sign mode, air-draw mode, auth pages, and community chat

Files:
- `train_model.py` — train a new model (MobileNetV2 transfer learning). Produces `model/model.keras` and `model/saved_model` and `model/labels.txt`.
- `Predict.py` — realtime webcam classifier. It will try to load `model/model.keras`, then `model/best_model.h5`, then `model/saved_model`, then `model/keras_model.h5`, then `model/keras_model.tflite`.
- `evaluate_model.py` — per-class accuracy check on your `data/` folders so you can quickly confirm A-Z performance.

Quick steps to retrain (recommended in a venv or conda env):

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
python train_model.py
```

After training, run the realtime predictor:

```powershell
python Predict.py
```

If `M`/`N` (or any new class) still does not appear after retraining, stop and restart any running backend/predictor process so it reloads the updated model and labels.

Quick A-Z validation after training:

```powershell
python evaluate_model.py --samples-per-class 60
```

If you prefer a TFLite model (for smaller runtime), run the tflite conversion step in `train_model.py` (it attempts conversion automatically if `saved_model` exists).

If you want me to tune the model, add more classes, or reduce latency (convert to TFLite quantized), tell me which direction to proceed.

## Web App Setup

### 1. Configure PostgreSQL

Create a database named `signspeak` (or use your own name) and set `DATABASE_URL` in `backend/.env.example` format:

```powershell
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/signspeak
JWT_SECRET=replace-with-a-random-secret
JWT_EXPIRE_HOURS=24
```

### 2. Start Backend API

```powershell
cd backend
pip install -r requirements.txt
python main.py
```

The backend exposes:
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `GET /chat/communities`
- `POST /chat/communities`
- `POST /chat/communities/join`
- `GET /chat/communities/{community_id}/members`
- `GET /chat/communities/{community_id}/history`
- `POST /chat/communities/{community_id}/messages`
- `GET /health`
- `WebSocket /ws` and `WebSocket /ws/draw`
- `WebSocket /ws/chat/{community_id}?token=...`

### 3. Start Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

Auth pages:
- `/login`
- `/signup`

Community page:
- `/community`
# SignSpeak

"""
Quick test: capture a webcam frame, send it to the backend via WebSocket
(same as the browser does), and print the prediction.

Shows your hand to the camera for 2 seconds, then captures and sends.
"""

import cv2
import base64
import json
import asyncio
import websockets
import numpy as np
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))


async def test_websocket():
    print("Opening webcam...")
    cap = cv2.VideoCapture(0)

    # Warm up
    for _ in range(30):
        cap.read()

    print("Show your hand sign NOW! Capturing in 2 seconds...")
    import time
    time.sleep(2)

    success, frame = cap.read()
    cap.release()

    if not success:
        print("Failed to capture frame!")
        return

    print(f"Frame shape: {frame.shape}")

    # Encode as PNG (same as browser's canvas.toBlob("image/png"))
    success_enc, png_bytes = cv2.imencode(".png", frame)
    b64 = base64.b64encode(png_bytes).decode("utf-8")
    print(f"PNG size: {len(png_bytes)} bytes, base64 length: {len(b64)}")

    # Save the frame we're sending
    cv2.imwrite("debug/test_ws_sent_frame.jpg", frame)

    # Send via WebSocket
    uri = "ws://localhost:8000/ws"
    try:
        async with websockets.connect(uri) as ws:
            msg = json.dumps({"type": "frame", "data": b64})
            await ws.send(msg)
            response = await asyncio.wait_for(ws.recv(), timeout=10)
            result = json.loads(response)
            print(f"\n=== WebSocket Prediction ===")
            print(f"  Letter: {result.get('letter')}")
            print(f"  Confidence: {result.get('confidence')}")
            if result.get("top3"):
                print(f"  Top-3:")
                for item in result["top3"]:
                    print(f"    {item['label']}: {item['score']:.4f}")
    except Exception as e:
        print(f"WebSocket error: {e}")

    # Now also run the local Predict.py pipeline on the SAME frame for comparison
    print("\n=== Local Pipeline Prediction (Predict.py style) ===")
    from hand_detector import HandDetector
    import tensorflow as tf
    from tensorflow.keras.layers import DepthwiseConv2D as _KDepthwiseConv2D

    class DepthwiseConv2D(_KDepthwiseConv2D):
        def __init__(self, *args, **kwargs):
            kwargs.pop("groups", None)
            super().__init__(*args, **kwargs)

    import tensorflow.keras.layers as _k_layers
    _k_layers.DepthwiseConv2D = DepthwiseConv2D

    import math

    model = tf.keras.models.load_model(
        "model/best_model.h5",
        custom_objects={"DepthwiseConv2D": DepthwiseConv2D},
    )
    with open("model/labels.txt") as f:
        labels = [l.strip() for l in f if l.strip()]

    detector = HandDetector(maxHands=1)
    frame_copy = frame.copy()
    hands, frame_copy = detector.findHands(frame_copy)  # draw=True default

    if hands:
        hand = hands[0]
        x, y, w, h = [int(v) for v in hand["bbox"]]
        OFFSET = 20
        IMG_SIZE = 300

        x1 = max(0, x - OFFSET)
        y1 = max(0, y - OFFSET)
        x2 = min(frame_copy.shape[1], x + w + OFFSET)
        y2 = min(frame_copy.shape[0], y + h + OFFSET)
        imgCrop = frame_copy[y1:y2, x1:x2]

        white = np.ones((IMG_SIZE, IMG_SIZE, 3), np.uint8) * 255
        aspect = h / w if w != 0 else 1
        if aspect > 1:
            k = IMG_SIZE / h
            wCal = math.ceil(k * w)
            resized = cv2.resize(imgCrop, (wCal, IMG_SIZE))
            gap = math.ceil((IMG_SIZE - wCal) / 2)
            white[:, gap:wCal + gap] = resized
        else:
            k = IMG_SIZE / w
            hCal = math.ceil(k * h)
            resized = cv2.resize(imgCrop, (IMG_SIZE, hCal))
            gap = math.ceil((IMG_SIZE - hCal) / 2)
            white[gap:hCal + gap, :] = resized

        cv2.imwrite("debug/test_local_white.jpg", white)

        img_resized = cv2.resize(white, (224, 224))
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB).astype("float32") / 255.0
        inp = np.expand_dims(img_rgb, axis=0)
        preds = model(inp, training=False)
        probs = preds[0].numpy()
        idx = int(np.argmax(probs))
        conf = float(probs[idx])
        label = labels[idx] if 0 <= idx < len(labels) else str(idx)
        top3_idx = np.argsort(probs)[-3:][::-1]

        print(f"  Letter: {label}")
        print(f"  Confidence: {conf:.4f}")
        print(f"  Top-3:")
        for i in top3_idx:
            print(f"    {labels[i]}: {float(probs[i]):.4f}")
    else:
        print("  No hand detected locally")


if __name__ == "__main__":
    asyncio.run(test_websocket())

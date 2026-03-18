"""
Diagnostic script: Compares Predict.py pipeline vs Backend pipeline
on the SAME webcam frame to find any differences.

Run this script to identify where predictions diverge.
"""

import cv2
import numpy as np
import math
import os
import sys
import base64

# ── Setup (same as Predict.py and backend) ──────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from hand_detector import HandDetector

import tensorflow as tf
from tensorflow.keras.layers import DepthwiseConv2D as _KDepthwiseConv2D

class DepthwiseConv2D(_KDepthwiseConv2D):
    def __init__(self, *args, **kwargs):
        kwargs.pop("groups", None)
        super().__init__(*args, **kwargs)

import tensorflow.keras.layers as _k_layers
_k_layers.DepthwiseConv2D = DepthwiseConv2D

MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
model = tf.keras.models.load_model(
    os.path.join(MODEL_DIR, "best_model.h5"),
    custom_objects={"DepthwiseConv2D": DepthwiseConv2D},
)
with open(os.path.join(MODEL_DIR, "labels.txt")) as f:
    labels = [l.strip() for l in f if l.strip()]

OFFSET = 20
IMG_SIZE = 300
INPUT_SIZE = (224, 224)

os.makedirs("debug", exist_ok=True)

def make_white_canvas(img, bbox):
    """Exact replica of the white-canvas logic from Predict.py / dataCollection.py."""
    x, y, w, h = [int(v) for v in bbox]
    img_h, img_w = img.shape[:2]
    x1 = max(0, x - OFFSET)
    y1 = max(0, y - OFFSET)
    x2 = min(img_w, x + w + OFFSET)
    y2 = min(img_h, y + h + OFFSET)
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return None

    white = np.ones((IMG_SIZE, IMG_SIZE, 3), np.uint8) * 255
    aspect = h / w if w != 0 else 1
    if aspect > 1:
        k = IMG_SIZE / h
        w_cal = math.ceil(k * w)
        resized = cv2.resize(crop, (w_cal, IMG_SIZE))
        gap = math.ceil((IMG_SIZE - w_cal) / 2)
        white[:, gap:w_cal + gap] = resized
    else:
        k = IMG_SIZE / w
        h_cal = math.ceil(k * h)
        resized = cv2.resize(crop, (IMG_SIZE, h_cal))
        gap = math.ceil((IMG_SIZE - h_cal) / 2)
        white[gap:h_cal + gap, :] = resized
    return white


def predict_image(white_img):
    """Run model prediction on white canvas."""
    img_resized = cv2.resize(white_img, INPUT_SIZE)
    img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB).astype("float32") / 255.0
    inp = np.expand_dims(img_rgb, axis=0)
    preds = model(inp, training=False)
    probs = preds[0].numpy()
    idx = int(np.argmax(probs))
    conf = float(probs[idx])
    label = labels[idx] if 0 <= idx < len(labels) else str(idx)
    top3_idx = np.argsort(probs)[-3:][::-1]
    top3 = [(labels[i], float(probs[i])) for i in top3_idx]
    return label, conf, top3


# ── Capture frame from OpenCV webcam ─────────────────────────────────────────
print("Opening webcam...")
cap = cv2.VideoCapture(0)
detector = HandDetector(maxHands=1)

# Warm up camera (auto-exposure)
for _ in range(30):
    cap.read()

success, raw_frame = cap.read()
if not success:
    print("Failed to capture frame!")
    sys.exit(1)

print(f"Frame captured: {raw_frame.shape}, dtype={raw_frame.dtype}")
cv2.imwrite("debug/01_raw_frame.jpg", raw_frame)

# ── Pipeline A: Predict.py style (draw=True, direct) ────────────────────────
print("\n=== Pipeline A: Predict.py style (draw=True on original) ===")
frame_a = raw_frame.copy()
hands_a, frame_a = detector.findHands(frame_a)  # draw=True default, modifies frame_a
cv2.imwrite("debug/02_predict_annotated.jpg", frame_a)

if hands_a:
    white_a = make_white_canvas(frame_a, hands_a[0]["bbox"])
    if white_a is not None:
        cv2.imwrite("debug/03_predict_white.jpg", white_a)
        label_a, conf_a, top3_a = predict_image(white_a)
        print(f"  Prediction: {label_a} ({conf_a:.4f})")
        print(f"  Top-3: {top3_a}")
    else:
        print("  Failed to create white canvas")
else:
    print("  No hand detected")

# ── Pipeline B: Backend style (draw=True on copy) ───────────────────────────
print("\n=== Pipeline B: Backend style (draw=True on frame.copy()) ===")
frame_b_input = raw_frame.copy()
hands_b, annotated_b = detector.findHands(frame_b_input, draw=True)
cv2.imwrite("debug/04_backend_annotated.jpg", annotated_b)

if hands_b:
    white_b = make_white_canvas(annotated_b, hands_b[0]["bbox"])
    if white_b is not None:
        cv2.imwrite("debug/05_backend_white.jpg", white_b)
        label_b, conf_b, top3_b = predict_image(white_b)
        print(f"  Prediction: {label_b} ({conf_b:.4f})")
        print(f"  Top-3: {top3_b}")
    else:
        print("  Failed to create white canvas")
else:
    print("  No hand detected")

# ── Pipeline C: Simulate browser encode/decode cycle ─────────────────────────
print("\n=== Pipeline C: Browser simulation (PNG encode → decode → backend) ===")

# Simulate what the browser does: encode as PNG, base64, decode back
success_encode, png_bytes = cv2.imencode(".png", raw_frame)
b64 = base64.b64encode(png_bytes).decode("utf-8")
# Now decode (like the backend does)
img_data = base64.b64decode(b64)
img_array = np.frombuffer(img_data, dtype=np.uint8)
frame_c = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

print(f"  Original shape: {raw_frame.shape}, Decoded shape: {frame_c.shape}")
print(f"  Pixel diff (max): {np.max(np.abs(raw_frame.astype(int) - frame_c.astype(int)))}")
print(f"  Pixel diff (mean): {np.mean(np.abs(raw_frame.astype(int) - frame_c.astype(int))):.4f}")

cv2.imwrite("debug/06_browser_sim_decoded.jpg", frame_c)

hands_c, annotated_c = detector.findHands(frame_c.copy(), draw=True)
cv2.imwrite("debug/07_browser_sim_annotated.jpg", annotated_c)

if hands_c:
    white_c = make_white_canvas(annotated_c, hands_c[0]["bbox"])
    if white_c is not None:
        cv2.imwrite("debug/08_browser_sim_white.jpg", white_c)
        label_c, conf_c, top3_c = predict_image(white_c)
        print(f"  Prediction: {label_c} ({conf_c:.4f})")
        print(f"  Top-3: {top3_c}")
    else:
        print("  Failed to create white canvas")
else:
    print("  No hand detected")

# ── Pipeline D: Simulate JPEG encode (if browser used JPEG) ─────────────────
print("\n=== Pipeline D: JPEG encode simulation (quality=70) ===")
success_jpg, jpg_bytes = cv2.imencode(".jpg", raw_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
b64_jpg = base64.b64encode(jpg_bytes).decode("utf-8")
img_data_jpg = base64.b64decode(b64_jpg)
img_array_jpg = np.frombuffer(img_data_jpg, dtype=np.uint8)
frame_d = cv2.imdecode(img_array_jpg, cv2.IMREAD_COLOR)
print(f"  Pixel diff from original (max): {np.max(np.abs(raw_frame.astype(int) - frame_d.astype(int)))}")
print(f"  Pixel diff from original (mean): {np.mean(np.abs(raw_frame.astype(int) - frame_d.astype(int))):.4f}")

hands_d, annotated_d = detector.findHands(frame_d.copy(), draw=True)
if hands_d:
    white_d = make_white_canvas(annotated_d, hands_d[0]["bbox"])
    if white_d is not None:
        cv2.imwrite("debug/09_jpeg_sim_white.jpg", white_d)
        label_d, conf_d, top3_d = predict_image(white_d)
        print(f"  Prediction: {label_d} ({conf_d:.4f})")
        print(f"  Top-3: {top3_d}")

# ── Pipeline E: Test on a training sample to verify model health ─────────────
print("\n=== Pipeline E: Training sample prediction ===")
test_dirs = ["A", "B", "D", "L", "Y"]
for letter in test_dirs:
    data_dir = os.path.join("data", letter)
    if not os.path.isdir(data_dir):
        continue
    imgs = [f for f in os.listdir(data_dir) if f.endswith(".jpg")]
    if not imgs:
        continue
    sample = cv2.imread(os.path.join(data_dir, imgs[0]))
    if sample is not None:
        label, conf, top3 = predict_image(sample)
        print(f"  data/{letter}/{imgs[0]} → {label} ({conf:.4f}) | Top-3: {top3}")

# ── Compare white canvases ──────────────────────────────────────────────────
if hands_a and hands_b and hands_c:
    if white_a is not None and white_b is not None and white_c is not None:
        print("\n=== White canvas comparison ===")
        diff_ab = np.mean(np.abs(white_a.astype(int) - white_b.astype(int)))
        diff_ac = np.mean(np.abs(white_a.astype(int) - white_c.astype(int)))
        diff_bc = np.mean(np.abs(white_b.astype(int) - white_c.astype(int)))
        print(f"  Predict vs Backend (mean pixel diff): {diff_ab:.4f}")
        print(f"  Predict vs BrowserSim (mean pixel diff): {diff_ac:.4f}")
        print(f"  Backend vs BrowserSim (mean pixel diff): {diff_bc:.4f}")

cap.release()
print("\n✓ Debug images saved to debug/ folder. Inspect them visually!")
print("  Compare 03_predict_white.jpg vs 05_backend_white.jpg vs 08_browser_sim_white.jpg")

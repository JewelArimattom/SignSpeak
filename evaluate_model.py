import argparse
import os
import random
from collections import Counter

import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras.layers import DepthwiseConv2D as _KDepthwiseConv2D


class DepthwiseConv2D(_KDepthwiseConv2D):
    def __init__(self, *args, **kwargs):
        kwargs.pop("groups", None)
        super().__init__(*args, **kwargs)


def has_rescaling_layer(layer) -> bool:
    if layer.__class__.__name__ == "Rescaling":
        return True
    sublayers = getattr(layer, "layers", None)
    if sublayers:
        for sub in sublayers:
            if has_rescaling_layer(sub):
                return True
    return False


def load_labels(labels_path: str) -> list[str]:
    with open(labels_path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def load_model(model_dir: str, labels_count: int):
    attempts = [
        ("model.keras", {}),
        ("best_model.h5", {"custom_objects": {"DepthwiseConv2D": DepthwiseConv2D}}),
        ("saved_model", {"is_dir": True}),
        ("keras_model.h5", {"custom_objects": {"DepthwiseConv2D": DepthwiseConv2D}}),
    ]
    for name, base_kwargs in attempts:
        kwargs = dict(base_kwargs)
        is_dir = kwargs.pop("is_dir", False)
        path = os.path.join(model_dir, name)
        exists = os.path.isdir(path) if is_dir else os.path.exists(path)
        if not exists:
            continue
        try:
            model = tf.keras.models.load_model(path, compile=False, **kwargs)
            out_shape = getattr(model, "output_shape", None)
            if isinstance(out_shape, tuple) and len(out_shape) > 0:
                out_classes = out_shape[-1]
                if isinstance(out_classes, int) and out_classes != labels_count:
                    print(
                        f"Skipping {name}: output classes={out_classes}, labels={labels_count}"
                    )
                    continue
            return model, name
        except Exception as exc:
            print(f"Failed to load {name}: {exc}")
    raise RuntimeError("No compatible model found in model directory.")


def predict_label(model, img_path: str, labels: list[str], model_has_rescaling: bool) -> str | None:
    img = cv2.imread(img_path)
    if img is None:
        return None
    img = cv2.cvtColor(cv2.resize(img, (224, 224)), cv2.COLOR_BGR2RGB)
    x = img.astype("float32")
    if not model_has_rescaling:
        x = x / 255.0
    probs = model(np.expand_dims(x, axis=0), training=False).numpy()[0]
    idx = int(np.argmax(probs))
    if 0 <= idx < len(labels):
        return labels[idx]
    return str(idx)


def main():
    parser = argparse.ArgumentParser(description="Evaluate hand-sign model per class.")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--model-dir", default="model")
    parser.add_argument("--labels", default="model/labels.txt")
    parser.add_argument("--samples-per-class", type=int, default=60)
    args = parser.parse_args()

    labels = load_labels(args.labels)
    model, model_name = load_model(args.model_dir, len(labels))
    model_has_rescaling = has_rescaling_layer(model)
    print(f"Loaded model: {model_name}")
    print(f"Labels: {len(labels)}")
    print(f"Model has Rescaling layer: {model_has_rescaling}")

    classes = sorted(
        d for d in os.listdir(args.data_dir) if os.path.isdir(os.path.join(args.data_dir, d))
    )
    per_class = []

    for cls in classes:
        folder = os.path.join(args.data_dir, cls)
        files = [
            os.path.join(folder, f)
            for f in os.listdir(folder)
            if f.lower().endswith((".jpg", ".jpeg", ".png"))
        ]
        if not files:
            continue

        random.shuffle(files)
        files = files[: min(args.samples_per_class, len(files))]

        preds = []
        for fp in files:
            pred = predict_label(model, fp, labels, model_has_rescaling)
            if pred is not None:
                preds.append(pred)

        if not preds:
            continue

        correct = sum(1 for p in preds if p == cls)
        acc = correct / len(preds)
        wrong = Counter([p for p in preds if p != cls]).most_common(3)
        per_class.append((cls, len(preds), acc, wrong))

    if not per_class:
        raise RuntimeError("No class samples were evaluated.")

    per_class.sort(key=lambda row: row[2])
    mean_acc = sum(row[2] for row in per_class) / len(per_class)

    print(f"\nMean sampled accuracy: {mean_acc:.3f}")
    print("Per-class accuracy (worst first):")
    for cls, count, acc, wrong in per_class:
        wrong_text = ", ".join(f"{lbl}:{n}" for lbl, n in wrong) if wrong else "-"
        print(f"  {cls}: {acc:.3f} ({count} samples) | confusions: {wrong_text}")

    weak = [row for row in per_class if row[2] < 0.9]
    if weak:
        print("\nWeak classes (<0.90):")
        for cls, count, acc, wrong in weak:
            wrong_text = ", ".join(f"{lbl}:{n}" for lbl, n in wrong) if wrong else "-"
            print(f"  {cls}: {acc:.3f} ({count}) -> {wrong_text}")
    else:
        print("\nAll classes are >= 0.90 on sampled local data.")


if __name__ == "__main__":
    main()

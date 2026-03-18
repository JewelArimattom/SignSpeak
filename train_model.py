import os
from pathlib import Path
import numpy as np
print("Loading TensorFlow... this can take 10-30 seconds on first run.", flush=True)
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

DATA_DIR = "data"
MODEL_DIR = "model"
SAVED_MODEL_DIR = os.path.join(MODEL_DIR, "saved_model")
LABELS_FILE = os.path.join(MODEL_DIR, "labels.txt")

IMG_SIZE = (224, 224)
BATCH_SIZE = 16
EPOCHS_HEAD = 12
EPOCHS_FINE_TUNE = 8
FINE_TUNE_AT = -40
SEED = 42
VAL_SPLIT = 0.2
AUTOTUNE = tf.data.AUTOTUNE
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

os.makedirs(MODEL_DIR, exist_ok=True)

data_root = Path(DATA_DIR)
class_names = sorted([d.name for d in data_root.iterdir() if d.is_dir()])
num_classes = len(class_names)
class_indices = {name: i for i, name in enumerate(class_names)}
print("Classes found:", class_indices)

train_paths: list[str] = []
train_labels: list[int] = []
val_paths: list[str] = []
val_labels: list[int] = []

rng = np.random.default_rng(SEED)
for cls in class_names:
    cls_idx = class_indices[cls]
    cls_dir = data_root / cls
    files = [
        str(p)
        for p in cls_dir.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    ]
    if not files:
        continue
    files = list(rng.permutation(files))
    split_idx = int(len(files) * (1.0 - VAL_SPLIT))
    if split_idx <= 0:
        split_idx = 1
    if split_idx >= len(files):
        split_idx = len(files) - 1 if len(files) > 1 else len(files)

    cls_train = files[:split_idx]
    cls_val = files[split_idx:]

    train_paths.extend(cls_train)
    train_labels.extend([cls_idx] * len(cls_train))
    val_paths.extend(cls_val)
    val_labels.extend([cls_idx] * len(cls_val))

if not train_paths:
    raise RuntimeError("No training images found in data/ subfolders.")
if not val_paths:
    raise RuntimeError("No validation images found. Add more data per class.")

train_paths = np.array(train_paths)
train_labels = np.array(train_labels, dtype=np.int32)
val_paths = np.array(val_paths)
val_labels = np.array(val_labels, dtype=np.int32)


def decode_and_resize(path, label):
    img = tf.io.read_file(path)
    img = tf.io.decode_image(img, channels=3, expand_animations=False)
    img.set_shape([None, None, 3])
    img = tf.image.resize(img, IMG_SIZE)
    img = tf.cast(img, tf.float32)
    return img, label


train_ds = tf.data.Dataset.from_tensor_slices((train_paths, train_labels))
train_ds = train_ds.shuffle(
    buffer_size=len(train_paths), seed=SEED, reshuffle_each_iteration=True
)
train_ds = train_ds.map(decode_and_resize, num_parallel_calls=AUTOTUNE)
train_ds = train_ds.batch(BATCH_SIZE).prefetch(AUTOTUNE)

val_ds = tf.data.Dataset.from_tensor_slices((val_paths, val_labels))
val_ds = val_ds.map(decode_and_resize, num_parallel_calls=AUTOTUNE)
val_ds = val_ds.batch(BATCH_SIZE).prefetch(AUTOTUNE)

# Class weights reduce bias toward dominant/easier classes.
class_counts = np.bincount(train_labels, minlength=num_classes)
total_samples = int(np.sum(class_counts))
class_weights = {
    i: float(total_samples / (num_classes * class_counts[i]))
    for i in range(num_classes)
    if class_counts[i] > 0
}
print("Class counts:", class_counts.tolist())
print("Class weights:", class_weights)

data_augmentation = tf.keras.Sequential(
    [
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.1),
        layers.RandomTranslation(0.12, 0.12),
        layers.RandomZoom(0.15),
        layers.RandomContrast(0.2),
    ],
    name="data_augmentation",
)

base = MobileNetV2(input_shape=(*IMG_SIZE, 3), include_top=False, weights="imagenet")
base.trainable = False

inputs = layers.Input(shape=(*IMG_SIZE, 3))
x = data_augmentation(inputs)
x = layers.Rescaling(1.0 / 255)(x)
x = base(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.3)(x)
x = layers.Dense(256, activation="relu")(x)
x = layers.Dropout(0.25)(x)
outputs = layers.Dense(num_classes, activation="softmax")(x)
model = models.Model(inputs, outputs)

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)
model.summary()

checkpoint_path = os.path.join(MODEL_DIR, "best_model.h5")
callbacks = [
    ModelCheckpoint(checkpoint_path, save_best_only=True, monitor="val_accuracy", mode="max"),
    EarlyStopping(monitor="val_accuracy", patience=8, restore_best_weights=True),
    ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-6),
]

print("\nPhase 1: training classification head")
history_head = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS_HEAD,
    callbacks=callbacks,
    class_weight=class_weights,
)

print("\nPhase 2: fine-tuning upper backbone layers")
base.trainable = True
for layer in base.layers[:FINE_TUNE_AT]:
    layer.trainable = False
for layer in base.layers:
    if isinstance(layer, layers.BatchNormalization):
        layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)
_ = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS_HEAD + EPOCHS_FINE_TUNE,
    initial_epoch=len(history_head.epoch),
    callbacks=callbacks,
    class_weight=class_weights,
)

# Quick per-class validation snapshot.
val_true = []
val_pred = []
for images_batch, labels_batch in val_ds:
    probs = model(images_batch, training=False).numpy()
    pred = np.argmax(probs, axis=1)
    val_true.extend(labels_batch.numpy().tolist())
    val_pred.extend(pred.tolist())

val_true = np.array(val_true, dtype=np.int64)
val_pred = np.array(val_pred, dtype=np.int64)
per_class = []
for idx in range(num_classes):
    mask = val_true == idx
    if not np.any(mask):
        continue
    class_acc = float(np.mean(val_pred[mask] == idx))
    per_class.append((class_names[idx], int(np.sum(mask)), class_acc))
per_class.sort(key=lambda row: row[2])

print("\nValidation per-class accuracy (worst first):")
for label, count, acc in per_class[:10]:
    print(f"  {label}: {acc:.3f} ({count} samples)")

model.save(os.path.join(MODEL_DIR, "model.keras"))
print("Saved Keras native model.")

print("Saving model to", SAVED_MODEL_DIR)
try:
    tf.saved_model.save(model, SAVED_MODEL_DIR)
    print("SavedModel saved.")
except Exception as e:
    print("SavedModel export failed (non-critical):", e)

with open(LABELS_FILE, "w", encoding="utf-8") as f:
    f.write("\n".join(class_names))

if os.path.isdir(SAVED_MODEL_DIR):
    try:
        converter = tf.lite.TFLiteConverter.from_saved_model(SAVED_MODEL_DIR)
        tflite_model = converter.convert()
        open(os.path.join(MODEL_DIR, "keras_model.tflite"), "wb").write(tflite_model)
        print("Saved TFLite model to", os.path.join(MODEL_DIR, "keras_model.tflite"))
    except Exception as e:
        print("TFLite conversion failed:", e)

print("Saved labels to", LABELS_FILE)
print("Done")

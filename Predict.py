import cv2
import numpy as np
import math
import tensorflow as tf
import os
from hand_detector import HandDetector

# Patch for DepthwiseConv2D configs that include an unexpected 'groups' kwarg
from tensorflow.keras.layers import DepthwiseConv2D as _KDepthwiseConv2D
class DepthwiseConv2D(_KDepthwiseConv2D):
    def __init__(self, *args, **kwargs):
        # drop unknown 'groups' if present (compatibility across TF versions)
        kwargs.pop('groups', None)
        super().__init__(*args, **kwargs)

# also make sure keras.layers references our patched class
import tensorflow.keras.layers as _k_layers
_k_layers.DepthwiseConv2D = DepthwiseConv2D

# Flexible classifier that can load SavedModel, native .keras, HDF5, or TFLite
class SimpleClassifier:
    def __init__(self, model_dir, labels_path):
        self.model = None
        self.tflite_interpreter = None
        self.labels = []
        self.input_size = (224, 224)
        self.loaded_model_name = None
        self.model_has_rescaling = False

        # load labels if present
        if os.path.exists(labels_path):
            with open(labels_path, 'r', encoding='utf-8') as f:
                self.labels = [line.strip() for line in f if line.strip()]

        self._load_model(model_dir)

        # determine input size from model if available
        if self.model is not None:
            try:
                shape = self.model.input_shape
                if isinstance(shape, tuple) and len(shape) >= 3:
                    self.input_size = (int(shape[1]), int(shape[2]))
            except Exception:
                pass
            self.model_has_rescaling = self._has_rescaling_layer(self.model)

        print(
            f"Model source: {self.loaded_model_name} | labels={len(self.labels)} | input={self.input_size} | has_rescaling={self.model_has_rescaling}"
        )

    def _is_compatible_with_labels(self, candidate_model):
        if not self.labels:
            return True
        output_shape = getattr(candidate_model, "output_shape", None)
        if isinstance(output_shape, tuple) and len(output_shape) > 0:
            output_classes = output_shape[-1]
            if isinstance(output_classes, int) and output_classes != len(self.labels):
                return False
        return True

    def _load_model(self, model_dir):
        # Prefer model.keras because it is always produced at the end of training.
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
                candidate = tf.keras.models.load_model(path, **kwargs)
                if not self._is_compatible_with_labels(candidate):
                    print(
                        f"Skipping {name}: output classes do not match labels.txt ({len(self.labels)} labels)."
                    )
                    continue
                self.model = candidate
                self.loaded_model_name = name
                print("Loaded model:", name)
                return
            except Exception as e:
                print(f"Failed to load {name}:", e)

        tflite_path = os.path.join(model_dir, 'keras_model.tflite')
        if os.path.exists(tflite_path):
            try:
                self.tflite_interpreter = tf.lite.Interpreter(model_path=tflite_path)
                self.tflite_interpreter.allocate_tensors()
                inp_details = self.tflite_interpreter.get_input_details()[0]
                shape = inp_details.get('shape', None)
                if shape is not None and len(shape) >= 3:
                    self.input_size = (int(shape[1]), int(shape[2]))
                self.loaded_model_name = 'keras_model.tflite'
                print('Loaded TFLite model from', tflite_path)
            except Exception as e:
                print('Failed to load TFLite model:', e)
                self.tflite_interpreter = None

    def _has_rescaling_layer(self, layer):
        if layer.__class__.__name__ == "Rescaling":
            return True
        sublayers = getattr(layer, "layers", None)
        if sublayers:
            for sub in sublayers:
                if self._has_rescaling_layer(sub):
                    return True
        return False

    def getPrediction(self, img, draw=False):
        # Returns (probs list, index)
        target_h, target_w = self.input_size
        img_resized = cv2.resize(img, (target_w, target_h))

        if self.model is not None:
            img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
            img_rgb = img_rgb.astype('float32')
            if not self.model_has_rescaling:
                img_rgb = img_rgb / 255.0
            inp = np.expand_dims(img_rgb, axis=0)
            preds = self.model(inp, training=False)  # faster than model.predict() for single images
            probs = preds[0].numpy() if hasattr(preds[0], 'numpy') else np.array(preds[0])
            idx = int(np.argmax(probs))
            return probs.tolist(), idx

        if self.tflite_interpreter is not None:
            inp_details = self.tflite_interpreter.get_input_details()[0]
            out_details = self.tflite_interpreter.get_output_details()[0]
            input_data = np.expand_dims(cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB).astype('float32') / 255.0, axis=0)
            # handle quantization
            if inp_details.get('dtype') == np.uint8:
                input_data = (input_data * 255).astype(np.uint8)
            self.tflite_interpreter.set_tensor(inp_details['index'], input_data)
            self.tflite_interpreter.invoke()
            out = self.tflite_interpreter.get_tensor(out_details['index'])
            probs = out.ravel()
            idx = int(np.argmax(probs))
            return probs.tolist(), idx

        raise RuntimeError('No usable model loaded')

cap = cv2.VideoCapture(0)
detector = HandDetector(maxHands=1)
# instantiate classifier and handle load errors gracefully
try:
    classifier = SimpleClassifier("model", "model/labels.txt")
except Exception as e:
    print("Failed to load model:", e)
    classifier = None

offset = 20
imgSize = 300
labels = classifier.labels if (classifier is not None and classifier.labels) else ["A", "B", "C", "D", "E"]
while True:
    success, img = cap.read()
    if not success or img is None:
        continue
    hands, img = detector.findHands(img)
    imgOutput = img.copy()
    if hands:
        hand = hands[0]
        x, y, w, h = hand['bbox']
        x, y, w, h = int(x), int(y), int(w), int(h)

        imgWhite = np.ones((imgSize, imgSize, 3), np.uint8) * 255

        # clamp crop to image bounds
        x1 = max(0, x - offset)
        y1 = max(0, y - offset)
        x2 = min(img.shape[1], x + w + offset)
        y2 = min(img.shape[0], y + h + offset)

        imgCrop = img[y1:y2, x1:x2]
        if imgCrop.size == 0:
            # nothing to process
            cv2.imshow("Image", imgOutput)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
            continue

        aspectRatio = (h / w) if w != 0 else 1

        if aspectRatio > 1:
            k = imgSize / h
            wCal = math.ceil(k * w)
            imgResize = cv2.resize(imgCrop, (wCal, imgSize))
            wGap = math.ceil((imgSize - wCal) / 2)
            imgWhite[:, wGap:wCal + wGap] = imgResize
        else:
            k = imgSize / w
            hCal = math.ceil(k * h)
            imgResize = cv2.resize(imgCrop, (imgSize, hCal))
            hGap = math.ceil((imgSize - hCal) / 2)
            imgWhite[hGap:hCal + hGap, :] = imgResize

        # only predict if we have a loaded classifier
        text_label = None
        if classifier is not None:
            try:
                prediction, index = classifier.getPrediction(imgWhite, draw=False)
                # map index to label safely
                if 0 <= index < len(labels):
                    text_label = labels[index]
                else:
                    text_label = str(index)
            except Exception as e:
                print("Prediction failed:", e)
                text_label = "Err"
        else:
            text_label = "No model"

        cv2.rectangle(imgOutput, (x - offset, y - offset-50),
                      (x - offset+140, y - offset-50+50), (255, 0, 255), cv2.FILLED)
        cv2.putText(imgOutput, text_label, (x, y -26), cv2.FONT_HERSHEY_COMPLEX, 1.2, (255, 255, 255), 2)
        cv2.rectangle(imgOutput, (x-offset, y-offset),
                      (x + w+offset, y + h+offset), (255, 0, 255), 4)
        cv2.imshow("ImageCrop", imgCrop)
        cv2.imshow("ImageWhite", imgWhite)
    cv2.imshow("Image", imgOutput)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

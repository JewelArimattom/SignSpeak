import cv2
import mediapipe as mp
import os
import urllib.request


class HandDetector:
    HAND_CONNECTIONS = [
        (0, 1), (1, 2), (2, 3), (3, 4),
        (0, 5), (5, 6), (6, 7), (7, 8),
        (5, 9), (9, 10), (10, 11), (11, 12),
        (9, 13), (13, 14), (14, 15), (15, 16),
        (13, 17), (17, 18), (18, 19), (19, 20),
        (0, 17),
    ]

    def __init__(self, maxHands=1, modelPath="hand_landmarker.task"):
        self.maxHands = maxHands
        self.modelPath = modelPath
        self._ensure_model()

        options = mp.tasks.vision.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=self.modelPath),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            num_hands=self.maxHands,
        )
        self.landmarker = mp.tasks.vision.HandLandmarker.create_from_options(options)

    def _ensure_model(self):
        if os.path.exists(self.modelPath):
            return
        url = "https://storage.googleapis.com/mediapipe-assets/hand_landmarker.task"
        urllib.request.urlretrieve(url, self.modelPath)

    def findHands(self, img, draw=True):
        if img is None:
            return [], img

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
        results = self.landmarker.detect(mp_image)

        hands = []
        img_h, img_w = img.shape[:2]

        for landmarks in results.hand_landmarks:
            xs = [lm.x for lm in landmarks]
            ys = [lm.y for lm in landmarks]
            lm_list = [(int(lm.x * img_w), int(lm.y * img_h)) for lm in landmarks]

            x_min = max(0, int(min(xs) * img_w))
            y_min = max(0, int(min(ys) * img_h))
            x_max = min(img_w - 1, int(max(xs) * img_w))
            y_max = min(img_h - 1, int(max(ys) * img_h))

            w = max(1, x_max - x_min)
            h = max(1, y_max - y_min)

            hands.append({"bbox": (x_min, y_min, w, h), "lmList": lm_list})

            if draw:
                for start_idx, end_idx in self.HAND_CONNECTIONS:
                    x1, y1 = lm_list[start_idx]
                    x2, y2 = lm_list[end_idx]
                    cv2.line(img, (x1, y1), (x2, y2), (255, 255, 255), 2)

                for x_pt, y_pt in lm_list:
                    cv2.circle(img, (x_pt, y_pt), 5, (0, 0, 255), cv2.FILLED)

                cv2.rectangle(img, (x_min, y_min), (x_min + w, y_min + h), (255, 0, 255), 2)

        return hands, img

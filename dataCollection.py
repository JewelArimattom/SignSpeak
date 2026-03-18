import cv2
import numpy as np
import math
import time
import os
import sys
from hand_detector import HandDetector


cap = cv2.VideoCapture(0)
detector = HandDetector(maxHands=1)

counter = 0

offset = 20
imgSize = 300

letter = sys.argv[1] if len(sys.argv) > 1 else "G"
folder = f"data/{letter}/"
os.makedirs(folder, exist_ok=True)
print(f"Collecting data for '{letter}' into {folder}")
print("Press 's' to save a frame, 'q' to quit.")

while True:
    success, img = cap.read()
    if not success or img is None:
        # camera read failed — try again
        continue

    hands, img = detector.findHands(img)

    if hands:
        hand = hands[0]

        x, y, w, h = hand['bbox']
        x, y, w, h = int(x), int(y), int(w), int(h)

        imgWhite = np.ones((imgSize, imgSize, 3), np.uint8) * 255

        # Clamp crop coordinates to image bounds
        x1 = max(0, x - offset)
        y1 = max(0, y - offset)
        x2 = min(img.shape[1], x + w + offset)
        y2 = min(img.shape[0], y + h + offset)

        imgCrop = img[y1:y2, x1:x2]

        # Skip if crop is empty
        if imgCrop.size == 0:
            cv2.imshow("Image", img)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
            continue

        aspectRatio = h / w if w != 0 else 1

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

        cv2.imshow("ImageCrop", imgCrop)
        cv2.imshow("ImageWhite", imgWhite)

    cv2.imshow("Image", img)
    key = cv2.waitKey(1)
    if key == ord("s") and hands:
        counter += 1
        filename = os.path.join(folder, f'image_{int(time.time())}_{counter}.jpg')
        cv2.imwrite(filename, imgWhite)
        print(f"Saved #{counter}: {filename}")
    if key == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
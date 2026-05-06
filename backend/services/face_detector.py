import cv2
import numpy as np
import os
import insightface

class FaceDetector:
    def __init__(self, model_dir="models", model_name="det_500m.onnx"):
        self.model_path = os.path.join(model_dir, model_name)
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model not found: {self.model_path}")
        
        # Menggunakan InsightFace secara langsung (Jauh lebih bersih!)
        self.detector = insightface.model_zoo.get_model(self.model_path, providers=['CPUExecutionProvider'])
        self.detector.prepare(ctx_id=0, input_size=(640, 640))

    def detect_faces(self, img_bgr):
        # Kembalikan Bounding Box dan Keypoints (kps)
        bboxes, kps = self.detector.detect(img_bgr)
        faces = []
        if bboxes is not None:
            for i in range(len(bboxes)):
                box = bboxes[i][:4].astype(int).tolist()
                # Simpan box dan kps dalam bentuk dictionary
                faces.append({
                    "box": box,
                    "kps": kps[i]
                })
        return faces

    def pick_largest(self, faces):
        if not faces: return None
        # Cari kotak paling besar berdasarkan luas area (w * h)
        return sorted(faces, key=lambda f: (f["box"][2]-f["box"][0])*(f["box"][3]-f["box"][1]), reverse=True)[0]

    def crop_face(self, img_bgr, box, margin=0.25, min_size=32):
        # Tetap dipertahankan untuk kebutuhan UI Liveness / Log Database
        x1, y1, x2, y2 = box
        w = max(1, x2 - x1)
        h = max(1, y2 - y1)
        mx = int(w * margin)
        my = int(h * margin)
        sx = max(0, x1 - mx)
        sy = max(0, y1 - my)
        ex = min(img_bgr.shape[1], x2 + mx)
        ey = min(img_bgr.shape[0], y2 + my)
        
        face = img_bgr[sy:ey, sx:ex].copy()
        if face.shape[0] < min_size or face.shape[1] < min_size:
            return cv2.resize(face, (min_size, min_size))
        return face
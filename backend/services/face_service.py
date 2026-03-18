import numpy as np
import insightface
from insightface.utils import face_align

class FaceService:
    def __init__(self, model_path="models/w600k_mbf.onnx"):
        try:
            self.rec_model = insightface.model_zoo.get_model(model_path, providers=['CPUExecutionProvider'])
            self.rec_model.prepare(ctx_id=0)
            print(f"OK InsightFace Recognition model loaded: {model_path}")
        except Exception as e:
            print(f"Failed to load Recognition model: {e}")
            self.rec_model = None

    def get_embedding(self, img_bgr, kps):
        if self.rec_model is None: return None
        try:
            # 1. Lakukan Pelurusan Wajah KELAS DUNIA (norm_crop)
            aligned_face = face_align.norm_crop(img_bgr, landmark=kps, image_size=112)
            
            # 2. Ekstrak Fitur AI
            emb = self.rec_model.get_feat(aligned_face)[0]
            
            # 3. Lakukan Normalisasi (Wajib agar skala skor Cosine tetap 0-1)
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm
            return emb
        except Exception as e:
            print("Get embedding error:", e)
            return None

face_service = FaceService()
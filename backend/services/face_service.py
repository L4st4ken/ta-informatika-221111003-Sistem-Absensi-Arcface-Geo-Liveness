import numpy as np
import insightface
from insightface.utils import face_align
from numpy.linalg import norm

class FaceService:
    # Menggunakan ResNet atau MobileFaceNet sesuai model Anda
    def __init__(self, model_path="models/w600k_mbf.onnx"):
        try:
            self.rec_model = insightface.model_zoo.get_model(model_path, providers=['CPUExecutionProvider'])
            self.rec_model.prepare(ctx_id=0)
            print(f"[INFO] InsightFace Recognition model loaded: {model_path}")
        except Exception as e:
            print(f"[ERROR] Failed to load Recognition model: {e}")
            self.rec_model = None

    def extract_arcface_vector(self, img_bgr, kpss):
        """
        Menerima gambar BGR dan titik landmark (kpss) dari LivenessService atau FaceDetector.
        Melakukan pelurusan (Alignment) dan ekstraksi vektor 512D.
        """
        if self.rec_model is None or kpss is None: 
            return None
            
        try:
            # 1. Lakukan Pelurusan Wajah KELAS DUNIA (norm_crop)
            aligned_face = face_align.norm_crop(img_bgr, landmark=kpss, image_size=112)
            
            # 2. Ekstrak Fitur AI (Menghasilkan Vektor)
            emb = self.rec_model.get_feat(aligned_face)[0]
            
            # 3. Lakukan Normalisasi (Wajib agar skala skor Cosine tetap terkalibrasi)
            emb_norm = norm(emb)
            if emb_norm > 0:
                emb = emb / emb_norm
            return emb
            
        except Exception as e:
            print(f"[ERROR] Face extraction failed: {e}")
            return None

# --- FUNGSI MATEMATIKA: COSINE SIMILARITY ---
def calculate_cosine_similarity(vec1, vec2):
    """
    Menghitung tingkat kemiripan dua vektor wajah.
    Output berkisar antara -1.0 (sangat berbeda) hingga 1.0 (identik).
    Ambang batas (Threshold) aman biasanya di angka 0.5
    """
    if vec1 is None or vec2 is None:
        return 0.0
    
    # Cosine Similarity = (A . B) / (||A|| * ||B||)
    # Karena di atas vektor sudah di-normalisasi, dot product saja sebenarnya cukup,
    # tapi kita gunakan rumus penuh untuk keamanan matematis.
    return float(np.dot(vec1, vec2) / (norm(vec1) * norm(vec2)))

# Inisialisasi Singleton
face_service = FaceService()

# Export fungsi agar bisa diimpor dengan mudah oleh attendance.py
extract_arcface_vector = face_service.extract_arcface_vector
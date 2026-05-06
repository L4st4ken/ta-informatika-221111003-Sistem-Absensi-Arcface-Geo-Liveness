import cv2
import numpy as np
import os
import sys
import onnxruntime as ort
import insightface

# ==========================================
# PENGATURAN PATH OTOMATIS
# ==========================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
FAS_DIR = os.path.join(BASE_DIR, "Silent-Face-Anti-Spoofing")
sys.path.append(FAS_DIR)

from src.generate_patches import CropImage

class LivenessService:
    def __init__(self):
        print("[INFO] Memuat Trisula AI ke dalam memori Server Flask...")
        
        # 1. Load Detektor Wajah Lokal
        det_path = os.path.join(MODELS_DIR, "det_500m.onnx")
        self.det_model = insightface.model_zoo.get_model(det_path, providers=['CPUExecutionProvider'])
        self.det_model.prepare(ctx_id=0, input_size=(640, 640))

        # 2. Load Liveness MiniFASNet Lokal
        fas_path = os.path.join(MODELS_DIR, "minifasnet_v2.onnx")
        self.fas_model = ort.InferenceSession(fas_path, providers=['CPUExecutionProvider'])
        self.image_cropper = CropImage()
        
        print("[INFO] Liveness Service Siap Menerima Request!")

    def softmax(self, x):
        e_x = np.exp(x - np.max(x))
        return e_x / e_x.sum(axis=1, keepdims=True)

    def check_liveness(self, image_bgr):
        """
        Menerima gambar BGR (dari endpoint Flask), mengembalikan status Liveness, 
        Bounding Box, dan Titik Landmark (KPSS) untuk ArcFace.
        """
        try:
            # --------------------------------------------------
            # TAHAP A: CARI WAJAH
            # --------------------------------------------------
            bboxes, kpss = self.det_model.detect(image_bgr)
            
            if bboxes is None or len(bboxes) == 0:
                return {
                    "is_live": False, 
                    "msg": "Wajah tidak terdeteksi oleh sistem.", 
                    "score": 0.0, 
                    "bbox": None, 
                    "kpss": None
                }
            
            # Ambil wajah pertama (paling dominan)
            bbox = bboxes[0]
            x1, y1, x2, y2, det_score = bbox
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            
            w = x2 - x1
            h = y2 - y1
            image_bbox = [x1, y1, w, h]

            # --------------------------------------------------
            # TAHAP B: CEK LIVENESS (ONNX)
            # --------------------------------------------------
            param = {
                "org_img": image_bgr, "bbox": image_bbox, "scale": 2.7, 
                "out_w": 80, "out_h": 80, "crop": True
            }
            img_crop = self.image_cropper.crop(**param) 
            
            img_blob = img_crop.astype(np.float32)
            img_blob = np.transpose(img_blob, (2, 0, 1)) 
            img_blob = np.expand_dims(img_blob, axis=0)  
            
            ort_inputs = {self.fas_model.get_inputs()[0].name: img_blob}
            ort_outs = self.fas_model.run(None, ort_inputs)
            result = ort_outs[0]
            
            prob = self.softmax(result)
            label = np.argmax(prob) 
            score = float(prob[0][label]) # Ubah ke float murni agar bisa di-JSON-kan oleh Flask
            
            is_live = (label == 1)

            # --------------------------------------------------
            # TAHAP C: KEMBALIKAN HASIL KE FLASK
            # --------------------------------------------------
            return {
                "is_live": is_live,
                "msg": "Liveness Passed" if is_live else "Spoofing Terdeteksi!",
                "score": score,
                "bbox": [x1, y1, x2, y2],
                # KUNCI EMAS: Kita kirimkan juga kpss (Landmark) agar ArcFace tidak perlu mencari ulang!
                "kpss": kpss[0] 
            }

        except Exception as e:
            print(f"[ERROR] Terjadi kegagalan di Liveness Service: {e}")
            return {"is_live": False, "msg": "Terjadi kesalahan internal server.", "score": 0.0, "bbox": None, "kpss": None}
import cv2
import numpy as np
import time
import os
import sys
import onnxruntime as ort
import insightface

# ==========================================
# PENGATURAN PATH OTOMATIS
# ==========================================
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
MODELS_DIR = os.path.join(BACKEND_DIR, "models")

# Path spesifik ke model lokalmu
DET_MODEL_PATH = os.path.join(MODELS_DIR, "det_500m.onnx")
FAS_MODEL_PATH = os.path.join(MODELS_DIR, "minifasnet_v2.onnx")

FAS_DIR = os.path.join(BACKEND_DIR, "Silent-Face-Anti-Spoofing")
sys.path.append(FAS_DIR)
from src.generate_patches import CropImage

# ==========================================
# 1. INISIALISASI MODEL LOKAL (100% OFFLINE)
# ==========================================
print(f"[INFO] Memuat Detektor Wajah Lokal: {os.path.basename(DET_MODEL_PATH)}")
# Memanggil detektor wajah langsung dari file .onnx lokal
det_model = insightface.model_zoo.get_model(DET_MODEL_PATH, providers=['CPUExecutionProvider'])
det_model.prepare(ctx_id=0, input_size=(640, 640))

print(f"[INFO] Memuat AI Liveness Lokal: {os.path.basename(FAS_MODEL_PATH)}")
fas_model = ort.InferenceSession(FAS_MODEL_PATH, providers=['CPUExecutionProvider'])
image_cropper = CropImage()

def softmax(x):
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum(axis=1, keepdims=True)

# ==========================================
# 2. MEMULAI WEBCAM SECARA REAL-TIME
# ==========================================
print("\nMenyalakan Webcam... (Tekan 'q' pada keyboard untuk keluar)")
cap = cv2.VideoCapture(0)

prev_frame_time = 0

while True:
    ret, frame = cap.read()
    if not ret: break
        
    frame = cv2.flip(frame, 1)
    
    new_frame_time = time.time()
    fps = 1 / (new_frame_time - prev_frame_time)
    prev_frame_time = new_frame_time

    # TAHAP A: CARI WAJAH (Menggunakan det_500m.onnx lokal)
    bboxes, kpss = det_model.detect(frame)
    
    # Jika ada wajah terdeteksi (panjang array bbox > 0)
    if bboxes is not None and len(bboxes) > 0:
        # Ambil wajah pertama
        bbox = bboxes[0]
        x1, y1, x2, y2, det_score = bbox
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        
        # Format untuk pemotong MiniFASNet
        w = x2 - x1
        h = y2 - y1
        image_bbox = [x1, y1, w, h]
        
        # TAHAP B: CEK LIVENESS (Menggunakan minifasnet_v2.onnx lokal)
        param = {
            "org_img": frame, "bbox": image_bbox, "scale": 2.7, 
            "out_w": 80, "out_h": 80, "crop": True
        }
        img_crop = image_cropper.crop(**param) 
        
        img_blob = img_crop.astype(np.float32)
        img_blob = np.transpose(img_blob, (2, 0, 1)) 
        img_blob = np.expand_dims(img_blob, axis=0)  
        
        ort_inputs = {fas_model.get_inputs()[0].name: img_blob}
        ort_outs = fas_model.run(None, ort_inputs)
        result = ort_outs[0]
        
        prob = softmax(result)
        label = np.argmax(prob) 
        score = prob[0][label]
        
        # TAHAP C: VISUALISASI
        if label == 1:
            color = (0, 255, 0)
            text = f"ASLI ({score*100:.1f}%)"
        else:
            color = (0, 0, 255)
            text = f"PALSU! ({score*100:.1f}%)"
            
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        cv2.rectangle(frame, (x1, y1 - 30), (x1 + tw, y1), color, -1)
        cv2.putText(frame, text, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    cv2.putText(frame, f"FPS: {int(fps)}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
    cv2.imshow("Demo Liveness Offline", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
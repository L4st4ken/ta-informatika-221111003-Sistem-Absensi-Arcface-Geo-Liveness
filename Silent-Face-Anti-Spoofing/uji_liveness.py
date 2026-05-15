import cv2
import numpy as np
import time
import os
import warnings
warnings.filterwarnings('ignore')

from src.anti_spoof_predict import AntiSpoofPredict
from src.generate_patches import CropImage
from src.utility import parse_model_name

# ==========================================
# 1. INISIALISASI MODEL MINIFASNET
# ==========================================
print("Memuat Model AI Liveness...")
model_test = AntiSpoofPredict(device_id=-1) # -1 untuk memaksa pakai CPU Laptop
image_cropper = CropImage()

# ==========================================
# 2. MEMULAI WEBCAM SECARA REAL-TIME
# ==========================================
print("\nMenyalakan Webcam... (Tekan 'q' pada keyboard untuk keluar)")
cap = cv2.VideoCapture(0) # 0 untuk webcam bawaan laptop

prev_frame_time = 0

while True:
    ret, frame = cap.read()
    if not ret:
        print("Gagal membaca frame dari webcam.")
        break
        
    # Balik gambar seperti cermin agar natural
    frame = cv2.flip(frame, 1)
    
    # Hitung FPS
    new_frame_time = time.time()
    fps = 1 / (new_frame_time - prev_frame_time)
    prev_frame_time = new_frame_time

    # Deteksi Kotak Wajah
    image_bbox = model_test.get_bbox(frame)
    
    # Jika wajah terdeteksi (Koordinat X dan Y tidak minus)
    if image_bbox[0] >= 0 and image_bbox[1] >= 0:
        x, y, w, h = image_bbox[0], image_bbox[1], image_bbox[2], image_bbox[3]
        
        prediction = np.zeros((1, 3))
        model_dir = "./resources/anti_spoof_models"
        
        # Eksekusi AI Liveness (Ensemble 2 Model)
        for model_name in os.listdir(model_dir):
            h_input, w_input, model_type, scale = parse_model_name(model_name)
            param = {"org_img": frame, "bbox": image_bbox, "scale": scale, "out_w": w_input, "out_h": h_input, "crop": True}
            if scale is None: param["crop"] = False
            img_crop = image_cropper.crop(**param)
            model_path = os.path.join(model_dir, model_name)
            prediction += model_test.predict(img_crop, model_path)

        # Penentuan Label: 1 = Asli (Real Face), Selain 1 = Palsu (Spoofing)
        label = np.argmax(prediction)
        
        # --------------------------------------------------
        # LOGIKA UI: PENENTUAN WARNA KOTAK
        # --------------------------------------------------
        if label == 1:
            color = (0, 255, 0) # HIJAU (Aman)
            text = "MANUSIA ASLI"
        else:
            color = (0, 0, 255) # MERAH (Tertolak)
            text = "SPOOFING (PALSU!)"
            
        # Gambar Kotak Wajah
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
        
        # Gambar Latar Belakang Teks
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        cv2.rectangle(frame, (x, y - 30), (x + tw, y), color, -1)
        
        # Tulis Teks Status
        cv2.putText(frame, text, (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    # Tampilkan teks FPS di pojok kiri atas
    cv2.putText(frame, f"FPS: {int(fps)}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

    # Tampilkan video ke layar
    cv2.imshow("Uji Coba Real-Time Liveness (MiniFASNet)", frame)

    # Tekan 'q' untuk menutup
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
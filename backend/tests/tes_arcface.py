import cv2
import numpy as np
import insightface
from insightface.utils import face_align
import time
import os

THRESHOLD = 0.50
NAMA_TARGET = "mama"

DIR_TES = os.path.dirname(os.path.abspath(__file__)) # Ini adalah path folder /tes
DIR_ROOT = os.path.dirname(DIR_TES)                  # Ini adalah path folder utama (Root)

# Menyusun path yang 100% anti-nyasar
PATH_REFERENCE = os.path.join(DIR_TES, "dataset_arcface", "Orang1", "reference.jpg")
PATH_DET_MODEL = os.path.join(DIR_ROOT, "models", "det_500m.onnx")
PATH_REC_MODEL = os.path.join(DIR_ROOT, "models", "w600k_mbf.onnx")

# Validasi File Referensi
if not os.path.exists(PATH_REFERENCE):
    print(f"ERROR KHUSUS: File {PATH_REFERENCE} tidak ditemukan!")
    exit()

print("Memuat model det_500m dan w600k_mbf...")
# Panggil model menggunakan Dynamic Path
detector = insightface.model_zoo.get_model(PATH_DET_MODEL, providers=['CPUExecutionProvider'])
detector.prepare(ctx_id=0, input_size=(640, 640))

rec_model = insightface.model_zoo.get_model(PATH_REC_MODEL, providers=['CPUExecutionProvider'])
# rec_model siap digunakan
# ==========================================
# 2. EKSTRAK WAJAH REFERENSI (DATABASE)
# ==========================================
print(f"Mengekstrak fitur wajah referensi untuk {NAMA_TARGET}...")
img_ref = cv2.imread(PATH_REFERENCE) 
bboxes_ref, kps_ref = detector.detect(img_ref)

if bboxes_ref is None or len(bboxes_ref) == 0:
    print("ERROR: Wajah pada foto reference.jpg tidak terdeteksi!")
    exit()

# Proses pelurusan dan ekstraksi fitur referensi
aligned_ref = face_align.norm_crop(img_ref, landmark=kps_ref[0], image_size=112)
feat_ref = rec_model.get_feat(aligned_ref)[0]
feat_ref = feat_ref / np.linalg.norm(feat_ref)

# ==========================================
# 3. MEMULAI WEBCAM SECARA REAL-TIME
# ==========================================
print("\nMenyalakan Webcam... (Tekan 'q' pada keyboard untuk keluar)")
cap = cv2.VideoCapture(0) # Angka 0 biasanya untuk webcam bawaan laptop

# Variabel untuk menghitung FPS
prev_frame_time = 0

while True:
    ret, frame = cap.read()
    if not ret:
        print("Gagal membaca frame dari webcam.")
        break
        
    # Membalikkan gambar agar seperti cermin (opsional tapi lebih nyaman)
    frame = cv2.flip(frame, 1)
    
    # Hitung FPS (Dengan Pengaman)
    new_frame_time = time.time()
    time_diff = new_frame_time - prev_frame_time
    fps = 1 / time_diff if time_diff > 0 else 0
    prev_frame_time = new_frame_time

    # Deteksi Wajah di frame saat ini
    bboxes, kps = detector.detect(frame)
    
    if bboxes is not None and len(bboxes) > 0:
        for i in range(len(bboxes)):
            # Ambil koordinat kotak wajah dan ubah ke integer
            bbox = bboxes[i].astype(int)
            x1, y1, x2, y2 = bbox[0], bbox[1], bbox[2], bbox[3]
            
            # Pengaman tambahan: Pastikan koordinat tidak keluar dari batas gambar
            h_img, w_img = frame.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w_img, x2), min(h_img, y2)
            
            # Ekstrak fitur wajah dari frame video
            aligned_face = face_align.norm_crop(frame, landmark=kps[i], image_size=112)
            feat = rec_model.get_feat(aligned_face)[0]
            feat = feat / np.linalg.norm(feat)
            
            # Hitung Cosine Similarity
            sim = np.dot(feat_ref, feat)
            
            # --------------------------------------------------
            # LOGIKA UI: PENENTUAN WARNA BERDASARKAN THRESHOLD
            # --------------------------------------------------
            if sim >= THRESHOLD:
                # DITERIMA (HIJAU)
                color = (0, 255, 0) # BGR
                label_text = f"{NAMA_TARGET} ({sim:.2f})"
            else:
                # DITOLAK (MERAH)
                color = (0, 0, 255) # BGR
                label_text = f"Impostor ({sim:.2f})"
            
            # Gambar Kotak Wajah
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            
            # Gambar Latar Belakang Teks agar mudah dibaca
            (w, h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(frame, (x1, y1 - 25), (x1 + w, y1), color, -1)
            
            # Tulis Teks Nama & Similarity
            cv2.putText(frame, label_text, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Opsional: Gambar 5 titik landmark wajah
            for point in kps[i]:
                cv2.circle(frame, (int(point[0]), int(point[1])), 2, (0, 255, 255), -1)

    # Tampilkan teks FPS di pojok kiri atas
    cv2.putText(frame, f"FPS: {int(fps)}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

    # Tampilkan video ke layar
    cv2.imshow("Live Demo Absensi (Threshold 0.5)", frame)

    # Tekan 'q' untuk menutup jendela
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Bersihkan RAM dan matikan kamera setelah selesai
cap.release()
cv2.destroyAllWindows()
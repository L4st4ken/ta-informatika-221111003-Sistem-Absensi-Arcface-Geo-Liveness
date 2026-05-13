import cv2
import dlib
import numpy as np
import imutils
from imutils import face_utils

# --- FUNGSI MENGHITUNG JARAK MATA (EAR) ---
def euclidean_dist(ptA, ptB):
    return np.linalg.norm(ptA - ptB)

def eye_aspect_ratio(eye):
    # Menghitung jarak vertikal mata
    A = euclidean_dist(eye[1], eye[5])
    B = euclidean_dist(eye[2], eye[4])
    # Menghitung jarak horizontal mata
    C = euclidean_dist(eye[0], eye[3])
    
    if C == 0: return 0.0
    # Rumus EAR
    return (A + B) / (2.0 * C)

# --- KONFIGURASI DLIB ---
EAR_THRESH = 0.25      # Batas nilai mata dianggap tertutup (bisa disesuaikan)
EAR_CONSEC_FRAMES = 2  # Berapa frame berturut-turut mata harus tertutup

print("[INFO] Memuat model Dlib...")
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor("models/shape_predictor_68_face_landmarks.dat")

# Mengambil indeks titik koordinat untuk mata kiri dan kanan (dari 68 titik)
(lStart, lEnd) = face_utils.FACIAL_LANDMARKS_IDXS["left_eye"]
(rStart, rEnd) = face_utils.FACIAL_LANDMARKS_IDXS["right_eye"]

# Variabel penghitung
COUNTER = 0
TOTAL_BLINKS = 0

print("[INFO] Menyalakan Webcam... (Tekan 'q' untuk keluar)")
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret: break
    
    # Efek cermin agar pergerakan natural
    frame = cv2.flip(frame, 1)
    # Dlib butuh gambar grayscale (hitam putih) agar prosesnya sedikit lebih ringan
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Deteksi wajah di dalam frame
    rects = detector(gray, 0)
    
    for rect in rects:
        # Cari 68 titik landmark di wajah yang terdeteksi
        shape = predictor(gray, rect)
        shape = face_utils.shape_to_np(shape)
        
        # Ekstrak koordinat mata
        leftEye = shape[lStart:lEnd]
        rightEye = shape[rStart:rEnd]
        
        # Hitung rasio EAR untuk kedua mata
        leftEAR = eye_aspect_ratio(leftEye)
        rightEAR = eye_aspect_ratio(rightEye)
        
        # Ambil rata-rata EAR dari kedua mata
        ear = (leftEAR + rightEAR) / 2.0
        
        # --- VISUALISASI: MENGGAMBAR GARIS DI MATA ---
        leftEyeHull = cv2.convexHull(leftEye)
        rightEyeHull = cv2.convexHull(rightEye)
        cv2.drawContours(frame, [leftEyeHull], -1, (0, 255, 0), 1)
        cv2.drawContours(frame, [rightEyeHull], -1, (0, 255, 0), 1)
        
        # --- LOGIKA KEDIPAN ---
        if ear < EAR_THRESH:
            # Jika mata tertutup, tambah counter frame
            COUNTER += 1
        else:
            # Jika mata terbuka, cek apakah sebelumnya sempat tertutup cukup lama
            if COUNTER >= EAR_CONSEC_FRAMES:
                TOTAL_BLINKS += 1
            COUNTER = 0
            
        # --- MENAMPILKAN TEKS DI LAYAR ---
        cv2.putText(frame, f"Kedipan: {TOTAL_BLINKS}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        cv2.putText(frame, f"EAR: {ear:.2f}", (250, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        
        # Simulasi "Liveness Berhasil" jika sudah berkedip 3 kali
        if TOTAL_BLINKS >= 3:
            cv2.putText(frame, "LIVENESS BERHASIL (Hidup)!", (50, 100),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

    cv2.imshow("Uji Kedipan Dlib (Offline)", frame)
    
    if cv2.waitKey(1) == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
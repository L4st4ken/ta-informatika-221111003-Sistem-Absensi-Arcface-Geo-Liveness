import cv2
import requests
import base64
import json
import time
import numpy as np

# --- KONFIGURASI ---
BASE_URL = "http://127.0.0.1:5000"
EMAIL = "hana@example.com" 
PASSWORD = "123456"

# --- KOORDINAT PALSU (Simulasi GPS HP) ---
# Ganti angka ini sesuai koordinat cabang di Database Anda nanti
# Agar dianggap "Hadir", jaraknya harus dekat.
MOCK_LAT = -6.873252  # Contoh: Monas
MOCK_LON = 107.542403

MOCK_TIME = "16:05"

def login():
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": EMAIL, "password": PASSWORD
        })
        if resp.status_code == 200:
            token = resp.json().get("access_token")
            print(f"✅ Login Sukses!")
            return token
        else:
            print(f"❌ Login Gagal: {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Gagal koneksi ke server: {e}")
        return None

def register_face_mode(token):
    print("\n=== MODE REGISTRASI WAJAH ===")
    print("Tekan SPASI untuk register. Q untuk batal.")
    cap = cv2.VideoCapture(0)
    headers = {"Authorization": f"Bearer {token}"}

    while True:
        ret, frame = cap.read()
        if not ret: break
        cv2.imshow("Client Register", frame)
        key = cv2.waitKey(1)

        if key == ord(' '):
            print("📸 Mengirim foto...")
            _, buffer = cv2.imencode('.jpg', frame)
            img_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
            try:
                resp = requests.post(
                    f"{BASE_URL}/face/upload-embedding",
                    headers=headers,
                    json={"image_base64": img_base64}
                )
                print("✅ STATUS:", resp.json().get("msg"))
                break
            except Exception as e:
                print(f"Error: {e}")
        elif key == ord('q'): break
            
    cap.release()
    cv2.destroyAllWindows()

def liveness_mode(token):
    print("\n=== MODE ABSENSI (LIVENESS + GPS) ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = requests.post(f"{BASE_URL}/face/liveness/start", headers=headers)
    if resp.status_code != 200:
        print("Gagal start session")
        return

    cap = cv2.VideoCapture(0)
    print("Tekan 'q' untuk stop.")

    while True:
        ret, frame = cap.read()
        if not ret: break

        _, buffer = cv2.imencode('.jpg', frame)
        img_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

        try:
            start_time = time.time()
            # --- UPDATE DISINI: KIRIM LAT/LON ---
            payload = {
                "image_base64": img_base64,
                "latitude": MOCK_LAT,  # Kirim GPS
                "longitude": MOCK_LON,
                "mock_time": MOCK_TIME
            }
            
            resp = requests.post(
                f"{BASE_URL}/face/liveness/frame", 
                headers=headers,
                json=payload
            )
            latency = (time.time() - start_time) * 1000 
            
            if resp.status_code == 200:
                data = resp.json()
                status = data.get("status")
                msg = data.get("msg", "")
                
                # Visualisasi UI
                if "guide_box" in data:
                    gx1, gy1, gx2, gy2 = data["guide_box"]
                    color = (0, 0, 255) 
                    if status == "processing": color = (0, 255, 0)
                    elif status == "liveness_passed": color = (255, 255, 0)
                    cv2.rectangle(frame, (gx1, gy1), (gx2, gy2), color, 2)
                    cv2.putText(frame, msg, (gx1, gy1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

                if "face_box" in data:
                    fx1, fy1, fx2, fy2 = data["face_box"]
                    cv2.rectangle(frame, (fx1, fy1), (fx2, fy2), (255, 0, 0), 1)

                if status == "liveness_passed":
                    final_score = data.get("face_similarity_score", 0.0)
                    cv2.putText(frame, f"PASSED! Score: {final_score:.2f}", (50, 50), 
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 3)
                    print(f"🎉 SUKSES! {msg}")
                    cv2.imshow("Client Simulation", frame)
                    cv2.waitKey(2000)
                    break 
                
                # Print status
                print(f"Server: {status} | GPS: {MOCK_LAT},{MOCK_LON} | {msg}")

            else:
                print(f"Server Error: {resp.status_code} - {resp.text}")

        except Exception as e:
            print(f"Error Request: {e}")

        cv2.imshow("Client Simulation", frame)
        if cv2.waitKey(1) == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    tk = login()
    if tk:
        while True:
            print("\n1. Register | 2. Absensi (+GPS)")
            p = input("Pilih: ")
            if p == '1': register_face_mode(tk)
            elif p == '2': liveness_mode(tk)
            elif p == 'q': break
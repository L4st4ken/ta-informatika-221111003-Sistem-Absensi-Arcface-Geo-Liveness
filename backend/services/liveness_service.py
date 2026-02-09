import collections
from imutils import face_utils
import numpy as np
import cv2  # Kita butuh cv2 di sini untuk konversi darurat

class LivenessService:
    def __init__(self, predictor, left_eye_idx=(42,48), right_eye_idx=(36,42), ear_threshold=0.25, consec_frames_for_blink=1, smooth_window=5):
        self.predictor = predictor
        self.left_start, self.left_end = left_eye_idx
        self.right_start, self.right_end = right_eye_idx
        self.EAR_THRESH = ear_threshold
        self.COUNTER_FOR_BLINK = consec_frames_for_blink
        self.SMOOTH_WINDOW = smooth_window
        self.reset()

    def reset(self, target_blinks=None):
        self.target_blinks = target_blinks if target_blinks is not None else 1
        self.blink_count = 0
        self.prev_eye_open = True
        self._ear_history = collections.deque(maxlen=self.SMOOTH_WINDOW)
        self._closed_frame_counter = 0
        self._open_frame_counter = 0

    def euclidean_dist(self, ptA, ptB):
        return np.linalg.norm(ptA - ptB)

    def eye_aspect_ratio(self, eye):
        A = self.euclidean_dist(eye[1], eye[5])
        B = self.euclidean_dist(eye[2], eye[4])
        C = self.euclidean_dist(eye[0], eye[3])
        if C == 0: return 0.0
        return (A + B) / (2.0 * C)

    def _smooth_ear(self, ear):
        self._ear_history.append(ear)
        return float(np.median(np.array(self._ear_history, dtype=np.float32)))

    def process_frame(self, frame_input, face_rect):
        try:
            # --- HARD FIX UNTUK DLIB ---
            # 1. Pastikan input tidak None
            if frame_input is None:
                print("Error: Frame input kosong (None)")
                return False

            # 2. Cek apakah input 3 Channel (BGR) atau 2 Channel (Gray)
            # Dlib predictor butuh GRAYSCALE (2D array)
            if len(frame_input.shape) == 3:
                # Jika user tidak sengaja kirim BGR, kita ubah paksa jadi Gray
                gray_frame = cv2.cvtColor(frame_input, cv2.COLOR_BGR2GRAY)
            else:
                gray_frame = frame_input

            # 3. Paksa tipe data uint8 dan contiguous memory (WAJIB BUAT DLIB)
            gray_frame = np.array(gray_frame, dtype=np.uint8, copy=True)
            gray_frame = np.ascontiguousarray(gray_frame)

            # 4. Validasi ukuran Rect agar tidak crash jika kotak keluar gambar
            h, w = gray_frame.shape
            l = max(0, face_rect.left())
            t = max(0, face_rect.top())
            r = min(w, face_rect.right())
            b = min(h, face_rect.bottom())
            
            # Buat rect baru yang aman (clamped)
            import dlib
            safe_rect = dlib.rectangle(l, t, r, b)
            # ---------------------------

            # Debug Print (Untuk memastikan data benar)
            # Uncomment baris ini jika masih error untuk melihat info gambarnya
            # print(f"DEBUG IMG -> Shape: {gray_frame.shape}, Dtype: {gray_frame.dtype}")

            shape = self.predictor(gray_frame, safe_rect)
            shape = face_utils.shape_to_np(shape)
            
            leftEye = shape[self.left_start:self.left_end]
            rightEye = shape[self.right_start:self.right_end]
            
            ear = (self.eye_aspect_ratio(leftEye) + self.eye_aspect_ratio(rightEye)) / 2.0
            ear_sm = self._smooth_ear(ear)
            
            status = "OPEN" if ear_sm > self.EAR_THRESH else "CLOSED"
            print(f"DEBUG >> EAR: {ear_sm:.3f} | Thresh: {self.EAR_THRESH} | Status: {status} | Blinks: {self.blink_count}")

            eye_open = ear_sm > self.EAR_THRESH

            if not eye_open: 
                self._closed_frame_counter += 1
                self._open_frame_counter = 0
            else: 
                self._open_frame_counter += 1
                if self._closed_frame_counter >= self.COUNTER_FOR_BLINK and not self.prev_eye_open:
                    self.blink_count += 1
                    print("!!! BLINK DETECTED !!!") 
                self._closed_frame_counter = 0

            if self._open_frame_counter >= self.COUNTER_FOR_BLINK:
                self.prev_eye_open = True
            elif self._closed_frame_counter >= self.COUNTER_FOR_BLINK:
                self.prev_eye_open = False

            return self.blink_count >= self.target_blinks
        except Exception as e:
            print(f"Error logic di process_frame: {e}")
            return False
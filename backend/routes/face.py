from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from services.face_detector import FaceDetector
from services.face_service import face_service
from services.liveness_manager import LivenessManager
from utils.validation import decode_image, calculate_face_similarity, validate_geofence
from utils.crypto import decrypt_embedding
from models.models import FaceEmbedding, AttendanceLog, User, Branch, Shift, Schedule
from datetime import datetime, date, time, timedelta
import dlib
import cv2
import json
import numpy as np
from config import Config

face_bp = Blueprint("face_bp", __name__, url_prefix="/face")

# Init Model
detector = FaceDetector(model_dir="models", model_name="det_500m.onnx")
predictor = dlib.shape_predictor(Config.DLIB_LANDMARK_PATH)
liveness_mgr = LivenessManager(predictor)

# --- HELPER TIMEZONE WIB ---
def get_wib_time():
    # UTC + 7 Jam
    return datetime.utcnow() + timedelta(hours=7)

def check_face_alignment(face_box, img_w, img_h):
    fx1, fy1, fx2, fy2 = face_box
    box_w = int(img_w * 0.45) 
    box_h = int(img_h * 0.55)
    gx1 = (img_w - box_w) // 2
    gy1 = (img_h - box_h) // 2
    gx2 = gx1 + box_w
    gy2 = gy1 + box_h
    guide_box = [gx1, gy1, gx2, gy2]

    fcx = (fx1 + fx2) // 2
    fcy = (fy1 + fy2) // 2
    gcx = (gx1 + gx2) // 2
    gcy = (gy1 + gy2) // 2
    
    diff_x = abs(fcx - gcx)
    diff_y = abs(fcy - gcy)
    limit_x = img_w * 0.15 
    limit_y = img_h * 0.15

    if diff_x > limit_x or diff_y > limit_y:
        return False, "Paskan Wajah di Tengah Kotak!", guide_box

    face_h = fy2 - fy1
    if face_h < box_h * 0.4:
        return False, "Maju Dikit (Wajah Terlalu Jauh)", guide_box
        
    return True, "OK", guide_box

@face_bp.route("/liveness/start", methods=["POST"])
@jwt_required()
def start_liveness():
    user_id = get_jwt_identity()
    session = liveness_mgr.start_session(user_id)
    return jsonify({"msg": "session started", "target_blinks": session.target_blinks}), 200

@face_bp.route("/liveness/frame", methods=["POST"])
@jwt_required()
def liveness_frame():
    user_id = get_jwt_identity()
    db: Session = next(get_db())
    data = request.json or {}
    
    img = decode_image(data.get("image_base64"))
    if img is None: return jsonify({"status": "error", "msg": "invalid image"}), 400
    
    lat_attempt = data.get("latitude")
    lon_attempt = data.get("longitude")

    # 1. Deteksi Wajah
    boxes = detector.detect_faces(img)
    if not boxes: return jsonify({"status": "no_face", "msg": "Wajah tidak ditemukan"}), 200

    box = detector.pick_largest(boxes)
    x1, y1, x2, y2 = box
    face_box_coords = [int(x1), int(y1), int(x2), int(y2)]

    # 2. Cek Guide Box
    h, w, _ = img.shape
    is_aligned, align_msg, guide_box_coords = check_face_alignment(box, w, h)

    session = liveness_mgr.get_session(user_id)
    if not session: session = liveness_mgr.start_session(user_id)

    if not is_aligned:
        return jsonify({
            "status": "position_error", "msg": align_msg,
            "face_box": face_box_coords, "guide_box": guide_box_coords,
            "current_blinks": 0, "target_blinks": session.target_blinks
        }), 200

    # 3. Liveness Check
    face_rect = dlib.rectangle(int(x1), int(y1), int(x2), int(y2))
    session.update_seen()
    passed = session.ls.process_frame(img, face_rect)
    current_blinks = session.ls.blink_count
    session.last_frame = detector.crop_face(img, box, margin=0.25)

    if not passed:
        return jsonify({
            "status": "processing",
            "msg": f"Kedip sekarang! ({current_blinks}/{session.target_blinks})",
            "current_blinks": current_blinks, "target_blinks": session.target_blinks,
            "face_box": face_box_coords, "guide_box": guide_box_coords
        }), 200

    # 4. ArcFace Check
    crop = session.last_frame
    captured_embedding = face_service.get_embedding(crop)
    if captured_embedding is None: return jsonify({"status": "error", "msg": "failed_extract_embedding"}), 500

    user = db.query(User).filter_by(user_id=user_id).first()
    record = db.query(FaceEmbedding).filter_by(user_id=user_id).first()
    
    if not record:
        liveness_mgr.end_session(user_id)
        return jsonify({"status": "error", "msg": "Belum registrasi wajah!"}), 404

    try:
        stored_json = decrypt_embedding(record.embedding_data)
        stored_embedding = json.loads(stored_json)
    except:
        liveness_mgr.end_session(user_id)
        return jsonify({"status": "error", "msg": "Decryption failed"}), 500

    score, ok_face = calculate_face_similarity(stored_embedding, captured_embedding, threshold=Config.ARCFACE_THRESHOLD)
    
    # Init pesan default
    msg_response = "Wajah Tidak Cocok" 

    # === [CORE BUSINESS LOGIC] ===
    if ok_face:
        # Gunakan Waktu WIB (UTC+7)
        current_dt = get_wib_time() 
        current_time_obj = current_dt.time()
        today = current_dt.date()

        # [ANTI SPAM] Cek 10 detik terakhir
        recent_log = db.query(AttendanceLog).filter(
            AttendanceLog.user_id == user_id,
            AttendanceLog.timestamp_attempt >= (current_dt - timedelta(seconds=10))
        ).first()

        if recent_log:
            print("🚫 Spam detected: Mengabaikan frame tambahan.")
            return jsonify({
                "status": "liveness_passed",
                "face_similarity_score": float(score),
                "face_passed": True,
                "msg": "Proses selesai (Duplicate Ignored).",
                "final_status": recent_log.final_status
            }), 200

        # --- A. AMBIL JADWAL / SHIFT ---
        assigned_branches = []
        jam_masuk_target = time(8, 0)
        jam_pulang_target = time(16, 0)
        
        # 1. Cek Jadwal (Supervisor)
        todays_schedules = db.query(Schedule).filter_by(user_id=user_id, tanggal=today, is_active=True).all()
        if todays_schedules:
            assigned_branches = [s.branch_id for s in todays_schedules]
            start_times = [s.jam_mulai for s in todays_schedules]
            end_times = [s.jam_selesai for s in todays_schedules]
            if start_times: jam_masuk_target = min(start_times)
            if end_times: jam_pulang_target = max(end_times)

        # 2. Cek Shift (Karyawan)
        elif user.shift:
            jam_masuk_target = user.shift.jam_masuk
            jam_pulang_target = user.shift.jam_pulang
            if user.branch_id: assigned_branches = [user.branch_id]
        
        # --- B. DETEKSI LOKASI ---
        detected_branch_id = None
        is_in_valid_location = False

        if lat_attempt and lon_attempt and assigned_branches:
            valid_branches_db = db.query(Branch).filter(Branch.branch_id.in_(assigned_branches)).all()
            for br in valid_branches_db:
                office_data = {"latitude": br.latitude, "longitude": br.longitude, "radius_meter": br.radius_meter}
                inside, dist = validate_geofence(lat_attempt, lon_attempt, office_data)
                if inside:
                    is_in_valid_location = True
                    detected_branch_id = br.branch_id
                    break 

        # --- C. TENTUKAN TARGET LOG (CHECK-IN / CHECK-OUT) ---
        
        # [PERBAIKAN UTAMA] Cari Log TERAKHIR user ini, apa pun tanggalnya.
        last_log = db.query(AttendanceLog).filter(
            AttendanceLog.user_id == user_id
        ).order_by(AttendanceLog.timestamp_attempt.desc()).first()

        target_log = None
        
        # Jika log terakhir ternyata BELUM CHECK-OUT, berarti user mau pulang.
        if last_log and last_log.check_out_time is None:
            # Safety Check: Pastikan log ini valid (kurang dari 18 jam shift)
            duration_since = datetime.utcnow() - last_log.check_in_time
            if duration_since.total_seconds() < (18 * 3600): 
                target_log = last_log

        try:
            # === SKENARIO 1: CHECK-OUT (Jika target_log ketemu) ===
            if target_log:
                # 1. Anti-Double Tap (Minimal kerja 1 menit baru boleh pulang)
                duration_work = current_dt - target_log.check_in_time
                if duration_work.total_seconds() < 60:
                     print(f"🚫 Pulang terlalu cepat (debounce). Durasi: {int(duration_work.total_seconds())}s")
                     # Return sukses palsu agar UI tidak error
                     return jsonify({
                        "status": "liveness_passed",
                        "face_similarity_score": float(score),
                        "face_passed": True,
                        "msg": "Check-In Berhasil! (Tunggu 1 menit untuk pulang)",
                        "final_status": target_log.final_status
                    }), 200

                # 2. Validasi Lokasi saat Check-Out
                if not is_in_valid_location:
                    msg_response = "Gagal Check-Out! Lokasi Anda jauh dari kantor."
                    ok_face = False # Frontend Merah
                
                else:
                    # Logic: Pindah Cabang atau Pulang Cepat
                    is_moved = (detected_branch_id != target_log.checkin_branch_id)
                    is_early = current_time_obj < jam_pulang_target 
                    
                    if is_early:
                        # Karyawan Biasa: Ditolak
                        if user.role == 'karyawan':
                            msg_response = f"Ditolak! Belum jam pulang ({jam_pulang_target.strftime('%H:%M')})"
                            ok_face = False
                        # Supervisor: Boleh (Pulang Cepat)
                        else:
                            target_log.check_out_time = current_dt
                            target_log.checkout_branch_id = detected_branch_id
                            target_log.attendance_status = 'Pulang Cepat'
                            target_log.face_similarity_score = float(score)
                            msg_response = "Check-Out Berhasil (Pulang Cepat)"
                    else:
                        # Pulang Normal
                        target_log.check_out_time = current_dt
                        target_log.checkout_branch_id = detected_branch_id
                        target_log.face_similarity_score = float(score)
                        msg_response = "Check-Out Berhasil!"

            # === SKENARIO 2: CHECK-IN BARU (Jika tidak ada target_log) ===
            else:
                status_hadir = "Tepat Waktu"
                # Toleransi 15 menit dari jam masuk
                limit_dt = datetime.combine(today, jam_masuk_target) + timedelta(minutes=15)
                if current_dt > limit_dt: 
                    status_hadir = "Terlambat"

                if is_in_valid_location:
                    new_log = AttendanceLog(
                        user_id=user_id, 
                        checkin_branch_id=detected_branch_id,
                        check_in_time=current_dt, 
                        attendance_status=status_hadir, 
                        timestamp_attempt=current_dt,
                        latitude_attempt=lat_attempt, longitude_attempt=lon_attempt,
                        is_inside_geofence=True, is_liveness_passed=True, 
                        face_similarity_score=float(score), final_status='Success'
                    )
                    db.add(new_log)
                    msg_response = f"Check-In Berhasil ({status_hadir})"
                else:
                    # Gagal Lokasi -> Catat Failure
                    target_branch = db.query(Branch).filter(Branch.branch_id.in_(assigned_branches)).first()
                    target_name = target_branch.nama_cabang if target_branch else "Unknown"
                    
                    new_log = AttendanceLog(
                        user_id=user_id, 
                        checkin_branch_id=assigned_branches[0] if assigned_branches else 1,
                        timestamp_attempt=current_dt, 
                        latitude_attempt=lat_attempt, longitude_attempt=lon_attempt,
                        is_inside_geofence=False, is_liveness_passed=True, 
                        face_similarity_score=float(score), final_status='Failure_Schedule'
                    )
                    db.add(new_log)
                    msg_response = f"Ditolak! Lokasi salah. Target: {target_name}"
                    ok_face = False # Frontend Merah

            # COMMIT DB (Hanya jika sukses atau error validasi bisnis)
            if ok_face or "Ditolak" in msg_response:
                db.commit()

        except Exception as e:
            db.rollback()
            current_app.logger.error(f"DB Error: {e}")
            return jsonify({"status": "error", "msg": str(e)}), 500

    liveness_mgr.end_session(user_id)

    return jsonify({
        "status": "liveness_passed",
        "face_similarity_score": float(score),
        "face_passed": bool(ok_face), # Ini menentukan warna (Hijau/Merah) di Frontend
        "msg": msg_response,          # Ini pesan teks yang muncul
        "final_status": "Success" if ok_face else "Failure"
    }), 200
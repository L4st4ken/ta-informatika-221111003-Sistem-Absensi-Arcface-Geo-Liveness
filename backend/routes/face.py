from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import Session
from database.connection import get_db
from services.face_service import face_service
from services.liveness_service import LivenessService # <-- IMPORT BARU KITA
from utils.validation import decode_image, calculate_face_similarity, validate_geofence
from utils.crypto import decrypt_embedding
from models.models import FaceEmbedding, AttendanceLog, User, Branch, Shift, Schedule
from datetime import datetime, timedelta
import cv2
import json
import numpy as np
from config import Config

face_bp = Blueprint("face_bp", __name__, url_prefix="/face")

# Inisialisasi Service Baru yang sudah mencakup Detektor & Liveness
liveness_service = LivenessService() 

def get_wib_time():
    return datetime.utcnow() + timedelta(hours=7)

def check_face_alignment(face_box, img_w, img_h):
    fx1, fy1, fx2, fy2 = face_box
    
    is_portrait = img_h > img_w
    if is_portrait:
        box_w = int(img_w * 0.65)  
        box_h = int(box_w * 1.3)   
    else:
        box_h = int(img_h * 0.65)  
        box_w = int(box_h / 1.3)   

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
    if face_h < box_h * 0.45: 
        return False, "Maju Dikit (Wajah Terlalu Jauh)", guide_box
        
    return True, "OK", guide_box

# =====================================================================
# ENDPOINT /liveness/start DIHAPUS KARENA SUDAH TIDAK PERLU KEDIP LAGI
# =====================================================================

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
    
    action_type = data.get("action_type", "check_in")
    alasan_note = data.get("note", "").strip()

    # -----------------------------------------------------------------
    # TAHAP 1: DETEKSI & CEK LIVENESS (SEKALIGUS!)
    # -----------------------------------------------------------------
    liveness_result = liveness_service.check_liveness(img)

    # 1a. Jika tidak ada wajah
    if not liveness_result["bbox"]:
        return jsonify({"status": "no_face", "msg": "Wajah tidak ditemukan"}), 200

    # 1b. Jika terdeteksi foto palsu / layar HP (SPOOFING)
    if not liveness_result["is_live"]:
        return jsonify({
            "status": "spoofing", 
            "msg": liveness_result["msg"], # Pesan: "Spoofing Terdeteksi!"
            "liveness_score": liveness_result["score"]
        }), 200

    # 1c. Wajah asli (Live)! Ambil datanya
    box = liveness_result["bbox"]
    kps = liveness_result["kpss"] 
    x1, y1, x2, y2 = box
    face_box_coords = [int(x1), int(y1), int(x2), int(y2)]

    # -----------------------------------------------------------------
    # TAHAP 2: CEK POSISI WAJAH (ALIGNMENT)
    # -----------------------------------------------------------------
    h, w, _ = img.shape
    is_aligned, align_msg, guide_box_coords = check_face_alignment(box, w, h)

    if not is_aligned:
        return jsonify({
            "status": "position_error", 
            "msg": align_msg,
            "face_box": face_box_coords, 
            "guide_box": guide_box_coords
            # Hapus data blink, karena sudah tidak digunakan frontend
        }), 200

    # -----------------------------------------------------------------
    # TAHAP 3: EKSTRAKSI WAJAH & PENCOCOKAN
    # -----------------------------------------------------------------
    captured_embedding = face_service.get_embedding(img, kps)
    if captured_embedding is None: return jsonify({"status": "error", "msg": "failed_extract_embedding"}), 500

    user = db.query(User).filter_by(user_id=user_id).first()
    record = db.query(FaceEmbedding).filter_by(user_id=user_id).first()
    
    if not record:
        return jsonify({"status": "error", "msg": "Belum registrasi wajah!"}), 404

    try:
        stored_json = decrypt_embedding(record.embedding_data)
        stored_embedding = json.loads(stored_json)
    except:
        return jsonify({"status": "error", "msg": "Decryption failed"}), 500

    score, ok_face = calculate_face_similarity(stored_embedding, captured_embedding, threshold=Config.ARCFACE_THRESHOLD)
    msg_response = "Wajah Tidak Cocok" 

    # === [CORE BUSINESS LOGIC - EXPLICIT INTENT] ===
    # (Logika absen gantung 18 jam, geofence, jadwal, tidak ada yang berubah!)
    if ok_face:
        current_dt = get_wib_time() 
        current_time_obj = current_dt.time()
        today = current_dt.date()

        recent_log = db.query(AttendanceLog).filter(
            AttendanceLog.user_id == user_id,
            AttendanceLog.timestamp_attempt >= (current_dt - timedelta(seconds=10))
        ).first()

        if recent_log:
            return jsonify({
                "status": "liveness_passed", "face_similarity_score": float(score), 
                "face_passed": True, "msg": "Proses selesai (Duplicate Ignored).", 
                "final_status": recent_log.final_status
            }), 200

        open_log = db.query(AttendanceLog).filter(
            AttendanceLog.user_id == user_id,
            AttendanceLog.check_out_time == None,
            AttendanceLog.final_status == 'Success'
        ).order_by(AttendanceLog.timestamp_attempt.desc()).first()

        if open_log:
            duration = current_dt - open_log.check_in_time
            if duration.total_seconds() > (18 * 3600):
                open_log.attendance_status = 'Lupa Pulang'
                open_log.keterangan = 'Ditutup Otomatis (Melewati 18 Jam)'
                db.commit()
                open_log = None 

        assigned_branches = []
        jam_masuk_target = None  
        jam_pulang_target = None 
        
        if action_type == "check_out" and open_log:
            assigned_branches = [open_log.checkin_branch_id] 
            
            sched = db.query(Schedule).filter_by(
                user_id=user_id, tanggal=today, branch_id=open_log.checkin_branch_id, is_active=True
            ).first()
            if sched:
                jam_pulang_target = sched.jam_selesai
            elif user.shift:
                jam_pulang_target = user.shift.jam_pulang

        else:
            todays_schedules = db.query(Schedule).filter_by(user_id=user_id, tanggal=today, is_active=True).all()
            if todays_schedules:
                active_schedule_found = False
                for sched in todays_schedules:
                    waktu_buka = (datetime.combine(today, sched.jam_mulai) - timedelta(hours=1)).time()
                    waktu_tutup = sched.jam_selesai
                    
                    if waktu_buka <= current_time_obj <= waktu_tutup:
                        assigned_branches = [sched.branch_id]
                        jam_masuk_target = sched.jam_mulai       
                        jam_pulang_target = sched.jam_selesai   
                        active_schedule_found = True
                        break 
                
                if not active_schedule_found:
                    return jsonify({
                        "status": "position_error", 
                        "msg": "Ditolak! Belum ada jadwal yang aktif untuk jam ini.",
                        "final_status": "Failure"
                    }), 200
                    
            elif user.shift:
                jam_masuk_target = user.shift.jam_masuk
                jam_pulang_target = user.shift.jam_pulang
                if user.branch_id: assigned_branches = [user.branch_id]

        detected_branch_id = None
        is_in_valid_location = False

        if lat_attempt and lon_attempt and assigned_branches:
            valid_branches_db = db.query(Branch).filter(Branch.branch_id.in_(assigned_branches)).all()
            for br in valid_branches_db:
                office_data = {"latitude": float(br.latitude), "longitude": float(br.longitude), "radius_meter": br.radius_meter}
                inside, dist = validate_geofence(float(lat_attempt), float(lon_attempt), office_data)
                if inside:
                    is_in_valid_location = True
                    detected_branch_id = br.branch_id
                    break 

        try:
            if action_type == "check_out":
                if not open_log:
                    ok_face = False
                    msg_response = "Ditolak! Anda belum Absen Masuk hari ini."
                else:
                    duration_work = current_dt - open_log.check_in_time
                    if duration_work.total_seconds() < 60:
                        return jsonify({"status": "liveness_passed", "face_passed": True, "msg": "Tunggu 1 menit setelah masuk!", "final_status": "Success", "face_similarity_score": float(score)}), 200
                    
                    if not is_in_valid_location:
                        msg_response = "Gagal Check-Out! Lokasi di luar area kantor."
                        ok_face = False
                    else:
                        is_early = current_time_obj < jam_pulang_target if jam_pulang_target else False
                        
                        open_log.check_out_time = current_dt
                        open_log.checkout_branch_id = detected_branch_id
                        open_log.face_similarity_score = float(score)
                        open_log.keterangan = alasan_note if alasan_note else "-"

                        if is_early:
                            open_log.attendance_status = 'Pulang Cepat'
                            msg_response = "Check-Out Awal Berhasil Dicatat"
                        else:
                            open_log.attendance_status = 'Tepat Waktu'
                            msg_response = "Check-Out Berhasil!"
                            
            elif action_type == "check_in":
                if open_log:
                    ok_face = False
                    msg_response = "Ditolak! Anda belum Check-Out dari sesi sebelumnya."
                else:
                    target_dt = datetime.combine(today, jam_masuk_target)
                    
                    if user.role == 'karyawan':
                        batas_buka = target_dt - timedelta(minutes=60) 
                        batas_tutup = target_dt + timedelta(hours=2)   
                    else: 
                        batas_buka = target_dt - timedelta(hours=2)    
                        batas_tutup = datetime.combine(today, jam_pulang_target) if jam_pulang_target else target_dt + timedelta(hours=8)

                    alasan_gagal = ""
                    if current_dt < batas_buka:
                        ok_face = False
                        msg_response = f"Ditolak! Absen baru dibuka pukul {batas_buka.strftime('%H:%M')}."
                        alasan_gagal = "Terlalu Cepat (Di Luar Jendela Waktu)"
                    elif current_dt > batas_tutup:
                        ok_face = False
                        msg_response = f"Ditolak! Batas absen masuk habis ({batas_tutup.strftime('%H:%M')})."
                        alasan_gagal = "Terlambat Parah (Melewati Jendela Waktu)"
                    else:
                        if not is_in_valid_location:
                            ok_face = False
                            target_branch = db.query(Branch).filter(Branch.branch_id.in_(assigned_branches)).first()
                            target_name = target_branch.nama_cabang if target_branch else "Unknown"
                            msg_response = f"Ditolak! Lokasi salah. Target: {target_name}"
                            alasan_gagal = "Gagal Lokasi"
                        else:
                            status_hadir = "Tepat Waktu"
                            teks_keterangan = "Check-In Tepat Waktu"
                            limit_dt = target_dt + timedelta(minutes=15)

                            if current_dt > limit_dt:
                                status_hadir = "Terlambat"
                                teks_keterangan = "Terlambat (Lebih dari 15 Menit)"

                            new_log = AttendanceLog(
                                user_id=user_id, checkin_branch_id=detected_branch_id,
                                check_in_time=current_dt, attendance_status=status_hadir, timestamp_attempt=current_dt,
                                latitude_attempt=lat_attempt, longitude_attempt=lon_attempt,
                                is_inside_geofence=True, is_liveness_passed=True, 
                                face_similarity_score=float(score), final_status='Success',
                                keterangan=teks_keterangan
                            )
                            db.add(new_log)
                            msg_response = f"Check-In Berhasil ({status_hadir})"

                    if not ok_face and alasan_gagal:
                        new_log = AttendanceLog(
                            user_id=user_id, 
                            checkin_branch_id=assigned_branches[0] if assigned_branches else 1,
                            check_in_time=current_dt, 
                            timestamp_attempt=current_dt, 
                            latitude_attempt=lat_attempt, longitude_attempt=lon_attempt,
                            is_inside_geofence=is_in_valid_location, 
                            is_liveness_passed=True, 
                            face_similarity_score=float(score), 
                            final_status='Failure_Schedule',
                            keterangan=alasan_gagal
                        )
                        db.add(new_log)

            db.commit()

        except Exception as e:
            db.rollback()
            current_app.logger.error(f"DB Error: {e}")
            return jsonify({"status": "error", "msg": str(e)}), 500

    return jsonify({
        "status": "liveness_passed",
        "face_similarity_score": float(score),
        "face_passed": bool(ok_face),
        "msg": msg_response,
        "final_status": "Success" if ok_face else "Failure"
    }), 200
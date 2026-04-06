import os
import cv2
import numpy as np
import base64
import math
from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta, date

from database.connection import get_db
from models.models import User, Branch, FaceEmbedding, AttendanceLog
from flask_jwt_extended import jwt_required, get_jwt_identity

from services.liveness_service import LivenessService
from services.face_service import extract_arcface_vector, calculate_cosine_similarity

attendance_bp = Blueprint("attendance_bp", __name__, url_prefix="/attendance")
liveness_svc = LivenessService()

def calculate_haversine(lat1, lon1, lat2, lon2):
    R = 6371000 
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))

def decode_base64_to_bgr(base64_string):
    if "," in base64_string: base64_string = base64_string.split(",")[1]
    img_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

@attendance_bp.route("/attend", methods=["POST"])
@jwt_required()
def process_attendance():
    db: Session = next(get_db())
    user_id = get_jwt_identity()
    data = request.json
    
    threshold = float(os.getenv("ARCFACE_THRESHOLD", 0.50))
    attempt_type = data.get('attempt_type', 'IN')
    user_lat, user_lon = float(data.get('latitude', 0)), float(data.get('longitude', 0))
    image_base64 = data.get('image_base64')
    
    # --- TAMBAHAN BARU: Tangkap teks laporan dari frontend ---
    laporan_teks = data.get('laporan_kegiatan', None)

    if not image_base64:
        return jsonify({"status": "Failed", "msg": "Gambar tidak ditemukan."}), 400

    def save_log(is_live, score, status, branch_id, dist, msg):
        # Logika proteksi ganda: Pastikan laporan hanya tersimpan saat absen PULANG (OUT)
        laporan_final = laporan_teks if attempt_type == 'OUT' else None
        
        new_log = AttendanceLog(
            user_id=user_id, attempted_branch_id=branch_id, attempt_type=attempt_type,
            latitude_attempt=user_lat, longitude_attempt=user_lon, distance_meters=dist,
            is_live=is_live, similarity_score=score, status=status,
            laporan_kegiatan=laporan_final # <--- TAMBAHAN BARU: Masukkan ke database
        )
        db.add(new_log); db.commit()

    try:
        user = db.query(User).filter_by(user_id=user_id).first()
        dist_m = None
        
        # 1. GEOFENCING
        if not user.marketing_flexible:
            branch = db.query(Branch).filter_by(branch_id=user.branch_id).first()
            if branch:
                b_lat = float(branch.latitude)
                b_lon = float(branch.longitude)
                dist_m = calculate_haversine(user_lat, user_lon, b_lat, b_lon)
                if dist_m > branch.radius_meter:
                    save_log(None, None, 'Failed', branch.branch_id, dist_m, "Luar Radius")
                    return jsonify({"status": "Failed", "msg": f"Luar area: {dist_m:.0f}m dari cabang."}), 403

        # 2. LIVENESS
        img = decode_base64_to_bgr(image_base64)
        live_res = liveness_svc.check_liveness(img)
        if not live_res["is_live"]:
            save_log(False, None, 'Failed', user.branch_id, dist_m, "Spoofing")
            return jsonify({"status": "Failed", "msg": "Wajah palsu terdeteksi!"}), 403

        # 3. ARCFACE
        db_blob = db.query(FaceEmbedding.embedding_data).filter_by(user_id=user_id).scalar()
        db_vec = np.frombuffer(db_blob, dtype=np.float32)
        curr_vec = extract_arcface_vector(img, kpss=live_res["kpss"])
        
        if curr_vec is None: return jsonify({"status": "Failed", "msg": "Wajah tidak jelas."}), 400
        
        score = calculate_cosine_similarity(curr_vec, db_vec)
        if score < threshold:
            save_log(True, float(score), 'Failed', user.branch_id, dist_m, "Wajah Beda")
            return jsonify({"status": "Failed", "msg": f"Wajah tidak cocok ({score*100:.1f}%)."}), 403

        save_log(True, float(score), 'Success', user.branch_id, dist_m, "OK")
        return jsonify({"status": "Success", "msg": f"Absen {attempt_type} Berhasil!"}), 200
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500
    
@attendance_bp.route("/history", methods=["GET"])
@jwt_required()
def get_history():
    db = next(get_db())
    logs = db.query(AttendanceLog).filter_by(user_id=get_jwt_identity()).order_by(desc(AttendanceLog.timestamp)).limit(30).all()
    
    return jsonify([{
        "log_id": l.log_id, 
        "tanggal": (l.timestamp + timedelta(hours=7)).strftime("%d %B %Y"),
        "jam": (l.timestamp + timedelta(hours=7)).strftime("%H:%M:%S"), 
        "tipe": l.attempt_type,
        "status": l.status, 
        "jarak": f"{round(l.distance_meters)}m" if l.distance_meters else "Flexible",
        "laporan": l.laporan_kegiatan # <--- TAMBAHAN BARU
    } for l in logs]), 200

@attendance_bp.route("/office-location", methods=["GET"])
@jwt_required()
def get_office_location():
    db: Session = next(get_db())
    user_id = get_jwt_identity()
    user = db.query(User).filter_by(user_id=user_id).first()

    if user.marketing_flexible or not user.branch_id:
        return jsonify({"is_flexible": True}), 200

    branch = db.query(Branch).filter_by(branch_id=user.branch_id).first()
    if branch:
        return jsonify({
            "is_flexible": False,
            "latitude": branch.latitude,
            "longitude": branch.longitude,
            "radius_meter": branch.radius_meter
        }), 200
    
    return jsonify({"error": "Cabang tidak ditemukan"}), 404

# ==========================================
# API BARU: CEK STATUS ABSEN HARI INI
# ==========================================
@attendance_bp.route("/today-status", methods=["GET"])
@jwt_required()
def check_today_status():
    db = next(get_db())
    user_id = get_jwt_identity()
    
    # Hitung waktu saat ini (WIB)
    sekarang_wib = datetime.utcnow() + timedelta(hours=7)
    hari_ini = sekarang_wib.date()

    # Ambil semua log kehadiran yang "Success" milik user ini (terbaru di atas)
    logs = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == user_id,
        AttendanceLog.status == 'Success'
    ).order_by(desc(AttendanceLog.timestamp)).all()

    # Filter manual dengan Python agar konversi zona waktu akurat
    last_log = None
    for log in logs:
        log_date = (log.timestamp + timedelta(hours=7)).date()
        if log_date == hari_ini:
            last_log = log
            break # Kita hanya butuh 1 data absensi terakhir hari ini

    # Tentukan tombol apa yang harus muncul di Frontend
    if not last_log:
        next_action = "IN"   # Belum absen hari ini -> Suruh Masuk
    elif last_log.attempt_type == "IN":
        next_action = "OUT"  # Tadi sudah Masuk -> Suruh Pulang
    else:
        next_action = "DONE" # Tadi sudah Pulang -> Selesai

    return jsonify({
        "last_attempt": last_log.attempt_type if last_log else None,
        "next_action": next_action
    }), 200
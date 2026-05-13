from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.connection import get_db
from models.models import User, AttendanceLog, FaceEmbedding
from sqlalchemy import func, desc, extract
from datetime import datetime, timedelta, date

dashboard_bp = Blueprint('dashboard_bp', __name__, url_prefix='/dashboard')

@dashboard_bp.route('', methods=['GET'])
@jwt_required()
def get_summary():
    user_id = get_jwt_identity()
    db = next(get_db())
    
    now_wib = datetime.utcnow() + timedelta(hours=7)
    today = now_wib.date()

    user = db.query(User).filter_by(user_id=user_id).first()
    if not user: return jsonify({"msg": "User not found"}), 404

    # 1. CEK STATUS WAJAH (ENROLLMENT)
    face_rec = db.query(FaceEmbedding).filter_by(user_id=user_id).first()
    if not face_rec:
        return jsonify({
            "action_status": "enroll", 
            "msg": "Wajah belum didaftarkan HRD"
        }), 200

    # 2. LOGIKA EVENT-BASED: TOMBOL APA YANG HARUS MUNCUL?
    # Cari log absen terakhir hari ini yang sukses
    last_log_today = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == user_id,
        func.date(AttendanceLog.timestamp) == today,
        AttendanceLog.status == 'Success'
    ).order_by(desc(AttendanceLog.timestamp)).first()

    action_status = 'IN' # Default pagi hari
    if last_log_today and last_log_today.attempt_type == 'IN':
        action_status = 'OUT' # Jika terakhir masuk, berarti sekarang waktunya pulang

    # 3. AMBIL NAMA CABANG / STATUS FLEKSIBEL
    nama_cabang = "Dinas Luar / Bypass" if user.is_dynamic else (user.branch.nama_cabang if user.branch else "Belum Diatur")

    # 4. STATISTIK BULAN INI (Sederhana & Cepat)
    tahun = today.year
    bulan = today.month

    # Hitung jumlah hari kerja yang sudah berlalu (Senin - Sabtu)
    working_days_passed = sum(1 for day in range(1, today.day + 1) if date(tahun, bulan, day).weekday() < 6)

    # Hitung total HARI hadir (bukan total klik IN/OUT)
    total_hadir = db.query(func.date(AttendanceLog.timestamp)).filter(
        AttendanceLog.user_id == user_id,
        extract('month', AttendanceLog.timestamp) == bulan,
        extract('year', AttendanceLog.timestamp) == tahun,
        AttendanceLog.attempt_type == 'IN',
        AttendanceLog.status == 'Success'
    ).distinct().count()

    total_alpha = max(0, working_days_passed - total_hadir)

    # 5. RIWAYAT 5 TERAKHIR
    logs = db.query(AttendanceLog).filter_by(user_id=user_id)\
             .order_by(desc(AttendanceLog.timestamp))\
             .limit(5).all()
    
    history_data = []
    for log in logs:
        timestamp_wib = log.timestamp + timedelta(hours=7)
        history_data.append({
            "tanggal": timestamp_wib.strftime("%Y-%m-%d"),
            "waktu": timestamp_wib.strftime("%H:%M:%S"),
            "tipe_absen": log.attempt_type, # IN / OUT
            "status_akhir": log.status,
            "jarak_meter": f"{round(log.distance_meters, 1)} m" if log.distance_meters else "Bypass"
        })

    return jsonify({
        "user": {
            "nama": user.nama_lengkap,
            "email": user.email,
            "role": user.role,
            "cabang": nama_cabang,
            "tipe_mobilitas": "Dinamis" if user.is_dynamic else "Statis"
        },
        "stats": {
            "total_hadir": total_hadir,
            "total_alpha": total_alpha 
        },
        "action_status": action_status,
        "history": history_data
    }), 200
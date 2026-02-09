from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.connection import get_db
from models.models import User, AttendanceLog, FaceEmbedding, Schedule, Branch, Shift
from sqlalchemy import func, desc
from datetime import date

dashboard_bp = Blueprint('dashboard_bp', __name__, url_prefix='/dashboard')

@dashboard_bp.route('', methods=['GET'])
@jwt_required()
def get_summary():
    user_id = get_jwt_identity()
    db = next(get_db())
    today = date.today()

    # 1. Ambil User Info
    user = db.query(User).filter_by(user_id=user_id).first()
    if not user: return jsonify({"msg": "User not found"}), 404

    # 2. Cek Apakah Wajah Sudah Didaftarkan?
    face_rec = db.query(FaceEmbedding).filter_by(user_id=user_id).first()
    has_face = True if face_rec else False

    # 3. Cek Status Absen Hari Ini
    log_today = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == user_id,
        func.date(AttendanceLog.timestamp_attempt) == today
    ).first()

    # Tentukan Action Status untuk Frontend
    # Possible values: 'enroll', 'check_in', 'check_out', 'done'
    action_status = 'check_in'

    if not has_face:
        action_status = 'enroll'
    elif log_today:
        if log_today.check_out_time:
            action_status = 'done' # Sudah pulang
        else:
            action_status = 'check_out' # Sudah masuk, belum pulang
    else:
        action_status = 'check_in' # Belum ada log sama sekali

    # 4. Ambil Nama Cabang & Jam Kerja (Untuk Info Card)
    nama_cabang = "-"
    jam_kerja = "-"
    
    # Cek Schedule dulu (Supervisor)
    sched = db.query(Schedule).filter_by(user_id=user_id, tanggal=today).first()
    if sched:
        br = db.query(Branch).filter_by(branch_id=sched.branch_id).first()
        nama_cabang = br.nama_cabang if br else "Unknown"
        jam_kerja = f"{sched.jam_mulai.strftime('%H:%M')} - {sched.jam_selesai.strftime('%H:%M')}"
    elif user.shift:
        # Fallback Shift
        jam_kerja = f"{user.shift.jam_masuk.strftime('%H:%M')} - {user.shift.jam_pulang.strftime('%H:%M')}"
        if user.branch: nama_cabang = user.branch.nama_cabang

    # 5. Ambil Riwayat 5 Terakhir
    logs = db.query(AttendanceLog).filter_by(user_id=user_id)\
             .order_by(desc(AttendanceLog.timestamp_attempt))\
             .limit(5).all()
    
    history_data = []
    for log in logs:
        history_data.append({
            "tanggal": log.timestamp_attempt.strftime("%Y-%m-%d"),
            "jam_masuk": log.check_in_time.strftime("%H:%M") if log.check_in_time else "-",
            "jam_pulang": log.check_out_time.strftime("%H:%M") if log.check_out_time else "-",
            "status_akhir": log.final_status,
            "keterangan": log.attendance_status or "-"
        })

    return jsonify({
        "user": {
            "nama": user.nama_lengkap,
            "email": user.email,
            "role": user.role,
            "cabang": nama_cabang,
            "jam_kerja": jam_kerja
        },
        "action_status": action_status,
        "history": history_data
    }), 200


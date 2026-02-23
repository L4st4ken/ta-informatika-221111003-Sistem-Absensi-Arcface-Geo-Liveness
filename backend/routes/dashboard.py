from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.connection import get_db
from models.models import User, AttendanceLog, FaceEmbedding, Schedule, Branch, Shift
from sqlalchemy import func, desc
from datetime import datetime, timedelta

dashboard_bp = Blueprint('dashboard_bp', __name__, url_prefix='/dashboard')

def get_wib_today():
    # Pastikan pakai WIB agar pergantian hari akurat
    return (datetime.utcnow() + timedelta(hours=7)).date()

@dashboard_bp.route('', methods=['GET'])
@jwt_required()
def get_summary():
    user_id = get_jwt_identity()
    db = next(get_db())
    today = get_wib_today()

    # 1. Ambil User Info
    user = db.query(User).filter_by(user_id=user_id).first()
    if not user: return jsonify({"msg": "User not found"}), 404

    # 2. Cek Apakah Wajah Sudah Didaftarkan?
    face_rec = db.query(FaceEmbedding).filter_by(user_id=user_id).first()
    has_face = True if face_rec else False

    # 3. TENTUKAN ACTION STATUS (LOGIKA BARU YANG BULLETPROOF)
    
    # A. Cari Sesi Aktif (Sukses Masuk, TAPI Belum Pulang)
    open_session = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == user_id,
        AttendanceLog.final_status == 'Success',
        AttendanceLog.check_out_time == None
    ).order_by(desc(AttendanceLog.timestamp_attempt)).first()

    # B. Cari Sesi Selesai Hari Ini (Sukses Masuk & Sudah Pulang hari ini)
    done_today = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == user_id,
        func.date(AttendanceLog.timestamp_attempt) == today,
        AttendanceLog.final_status == 'Success',
        AttendanceLog.check_out_time != None
    ).first()

    # Penentuan Tombol
    action_status = 'check_in' # Default

    if not has_face:
        action_status = 'enroll'
    elif open_session:
        action_status = 'check_out' # Ada sesi gantung -> Minta Pulang
    elif done_today:
        action_status = 'done' # Sudah pulang hari ini -> Tidur
    else:
        action_status = 'check_in' # Belum ada sesi sukses -> Minta Masuk

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
        # Tambahan: Konversi UTC ke WIB untuk tampilan history di dashboard
        check_in_wib = log.check_in_time + timedelta(hours=7) if log.check_in_time else None
        check_out_wib = log.check_out_time + timedelta(hours=7) if log.check_out_time else None

        history_data.append({
            "tanggal": (log.timestamp_attempt + timedelta(hours=7)).strftime("%Y-%m-%d"),
            "jam_masuk": check_in_wib.strftime("%H:%M") if check_in_wib else "-",
            "jam_pulang": check_out_wib.strftime("%H:%M") if check_out_wib else "-",
            "status_akhir": log.final_status,
            "keterangan": log.keterangan if log.keterangan else (log.attendance_status or "-")
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
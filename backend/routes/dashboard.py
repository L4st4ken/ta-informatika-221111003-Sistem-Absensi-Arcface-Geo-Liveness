from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.connection import get_db
from models.models import User, AttendanceLog, FaceEmbedding, Schedule, Branch, Shift
from sqlalchemy import func, desc
from datetime import datetime, timedelta, date

dashboard_bp = Blueprint('dashboard_bp', __name__, url_prefix='/dashboard')

def get_wib_today():
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

    # 3. TENTUKAN ACTION STATUS (LOGIKA JADWAL DINAMIS)
    
    # A. Cek apakah ada sesi gantung (Belum Pulang)
    open_session = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == user_id,
        AttendanceLog.final_status == 'Success',
        AttendanceLog.check_out_time == None
    ).order_by(desc(AttendanceLog.timestamp_attempt)).first()

    # B. Hitung berapa kali user SUDAH SELESAI (Masuk & Pulang) hari ini
    completed_sessions_count = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == user_id,
        func.date(AttendanceLog.timestamp_attempt) == today,
        AttendanceLog.final_status == 'Success',
        AttendanceLog.check_out_time != None
    ).count()

    # C. Cek TARGET jumlah kunjungan / shift hari ini
    todays_schedules_count = db.query(Schedule).filter_by(
        user_id=user_id, tanggal=today, is_active=True
    ).count()
    
    # Jika tidak ada jadwal khusus di tabel Schedule, asumsikan ikut Shift reguler (Target = 1 kali)
    expected_sessions = todays_schedules_count if todays_schedules_count > 0 else 1

    # D. EKSEKUSI LOGIKA
    action_status = 'check_in' # Default

    if not has_face:
        action_status = 'enroll'
    elif open_session:
        # Ada sesi gantung -> Wajib Pulang dulu
        action_status = 'check_out'
    elif completed_sessions_count >= expected_sessions:
        # INI KUNCI DARI IDE ANDA!
        # Berlaku untuk Karyawan & Supervisor. Jika target sesi sudah terpenuhi -> DONE
        action_status = 'done'
    else:
        # Sesi selesai < Target sesi (Misal target 2 cabang, baru selesai 1) -> Boleh Masuk Lagi
        action_status = 'check_in'

    # 4. Ambil Nama Cabang & Jam Kerja
    nama_cabang = "-"
    jam_kerja = "-"
    
    sched = db.query(Schedule).filter_by(user_id=user_id, tanggal=today).first()
    if sched:
        br = db.query(Branch).filter_by(branch_id=sched.branch_id).first()
        nama_cabang = br.nama_cabang if br else "Unknown"
        jam_kerja = f"{sched.jam_mulai.strftime('%H:%M')} - {sched.jam_selesai.strftime('%H:%M')}"
    elif user.shift:
        jam_kerja = f"{user.shift.jam_masuk.strftime('%H:%M')} - {user.shift.jam_pulang.strftime('%H:%M')}"
        if user.branch: nama_cabang = user.branch.nama_cabang

    # ==========================================
    # 5. FITUR BARU: STATISTIK KEHADIRAN BULAN INI
    # ==========================================
    first_day_of_month = today.replace(day=1)

    # Hitung total hari masuk (hanya yang final_status-nya Success)
    total_hadir = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == user_id,
        func.date(AttendanceLog.check_in_time) >= first_day_of_month,
        AttendanceLog.final_status == 'Success'
    ).count()

    # Hitung total telat bulan ini
    total_telat = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == user_id,
        func.date(AttendanceLog.check_in_time) >= first_day_of_month,
        AttendanceLog.attendance_status == 'Terlambat',
        AttendanceLog.final_status == 'Success'
    ).count()

    # 6. Ambil Riwayat 5 Terakhir
    logs = db.query(AttendanceLog).filter_by(user_id=user_id)\
             .order_by(desc(AttendanceLog.timestamp_attempt))\
             .limit(5).all()
    
    history_data = []
    for log in logs:
        # PERBAIKAN: Hapus timedelta(hours=7) karena data di DB sudah WIB (disimpan via face.py)
        check_in_str = log.check_in_time.strftime("%H:%M") if log.check_in_time else "-"
        check_out_str = log.check_out_time.strftime("%H:%M") if log.check_out_time else "-"

        history_data.append({
            "tanggal": log.timestamp_attempt.strftime("%Y-%m-%d"),
            "jam_masuk": check_in_str,
            "jam_pulang": check_out_str,
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
        "stats": {
            "total_hadir": total_hadir,
            "total_telat": total_telat
        },
        "action_status": action_status,
        "history": history_data
    }), 200
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.connection import get_db
from models.models import User, AttendanceLog, FaceEmbedding, Schedule, Branch, Shift
from sqlalchemy import func, desc, extract
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
    if open_session:
        current_time_wib = datetime.utcnow() + timedelta(hours=7)
        # Hitung selisih waktu dari check-in sampai sekarang
        durasi_gantung = (current_time_wib - open_session.check_in_time).total_seconds()
        
        # Jika sudah lewat 18 jam, anggap sesi ini HANGUS / EXPIRED
        if durasi_gantung > (18 * 3600):
            open_session.check_out_time = open_session.check_in_time 
            open_session.attendance_status = 'Lupa Pulang'
            open_session.keterangan = 'Ditutup otomatis oleh sistem (>18 Jam)'
            
            try:
                db.commit() # Simpan perubahan ke database permanen
            except Exception as e:
                db.rollback()
                print(f"Error auto-close session: {e}")
            
            # 2. Kosongkan sesi di memori agar Dashboard mereset tombol menjadi "Absen Masuk"
            open_session = None

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

    # 4. Ambil Nama Cabang & Jam Kerja (TARGET SHIFT / SCHEDULE)
    nama_cabang = "-"
    jam_kerja = "-"
    current_time_obj = (datetime.utcnow() + timedelta(hours=7)).time()
    
    # LANGKAH 1: Tentukan Target Jam Kerja (Jadwal vs Shift)
    todays_schedules = db.query(Schedule).filter_by(user_id=user_id, tanggal=today, is_active=True).all()
    if todays_schedules:
        todays_schedules = sorted(todays_schedules, key=lambda x: x.jam_mulai)
        sched_target = todays_schedules[0]
        for sched in todays_schedules:
            # Teks di dashboard akan BERUBAH 1 jam sebelum jadwal berikutnya dimulai
            waktu_buka = (datetime.combine(today, sched.jam_mulai) - timedelta(hours=1)).time()
            
            if current_time_obj >= waktu_buka:
                # Jika jam sekarang sudah melewati jam buka jadwal ini, timpa targetnya!
                sched_target = sched
        br = db.query(Branch).filter_by(branch_id=sched_target.branch_id).first()
        nama_cabang = br.nama_cabang if br else "Unknown"
        jam_kerja = f"{sched_target.jam_mulai.strftime('%H:%M')} - {sched_target.jam_selesai.strftime('%H:%M')}"
        
    elif user.shift:
        # Jika tidak ada jadwal, gunakan Shift normal
        jam_kerja = f"{user.shift.jam_masuk.strftime('%H:%M')} - {user.shift.jam_pulang.strftime('%H:%M')}"
        if user.branch: 
            nama_cabang = user.branch.nama_cabang

    # LANGKAH 2: Update Nama Cabang HANYA jika sedang ada sesi berjalan (Tanpa merusak Jam Kerja)
    if open_session:
        br_actual = db.query(Branch).filter_by(branch_id=open_session.checkin_branch_id).first()
        if br_actual:
            nama_cabang = br_actual.nama_cabang
        
        matched_sched = db.query(Schedule).filter_by(
            user_id=user_id, 
            tanggal=today, 
            branch_id=open_session.checkin_branch_id,
            is_active=True
        ).first()

        if matched_sched:
            jam_kerja = f"{matched_sched.jam_mulai.strftime('%H:%M')} - {matched_sched.jam_selesai.strftime('%H:%M')}"
        elif user.shift:
            # Fallback jika ternyata dia pakai shift reguler, bukan jadwal
            jam_kerja = f"{user.shift.jam_masuk.strftime('%H:%M')} - {user.shift.jam_pulang.strftime('%H:%M')}"

    # ==========================================
    # 5. FITUR BARU: STATISTIK KEHADIRAN BULAN INI (DENGAN ALPHA CERDAS)
    # ==========================================
    tahun = today.year
    bulan = today.month
    hari_ini = today.day

    # A. Hitung Total Hari Kerja (Senin - Jumat) dari tanggal 1 sampai HARI INI
    working_days_passed = 0
    for day in range(1, hari_ini + 1):
        if date(tahun, bulan, day).weekday() < 5:  # 0=Senin, 4=Jumat
            working_days_passed += 1

    # B. Ambil semua log absen SUKSES milik user ini di bulan ini
    logs_sebulan = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == user_id,
        extract('month', AttendanceLog.timestamp_attempt) == bulan,
        extract('year', AttendanceLog.timestamp_attempt) == tahun,
        AttendanceLog.final_status == 'Success'
    ).all()

    # C. Rekapitulasi (Gunakan Set agar absen berkali-kali di hari yang sama dihitung 1 kali Hadir)
    attended_days = set()
    total_telat = 0

    for log in logs_sebulan:
        if log.check_in_time:
            log_date = log.check_in_time.date()
            if log_date not in attended_days:
                attended_days.add(log_date)
                # Hanya hitung telat pada absen pertama di hari itu
                if log.attendance_status == 'Terlambat':
                    total_telat += 1

    total_hadir = len(attended_days)

    # D. Kalkulasi Alpha
    total_alpha = working_days_passed - total_hadir
    if total_alpha < 0: 
        total_alpha = 0

    # 6. Ambil Riwayat 5 Terakhir
    logs = db.query(AttendanceLog).filter_by(user_id=user_id)\
             .order_by(desc(AttendanceLog.timestamp_attempt))\
             .limit(5).all()
    
    history_data = []
    for log in logs:
        check_in_str = log.check_in_time.strftime("%H:%M") if log.check_in_time else "-"
        check_out_str = log.check_out_time.strftime("%H:%M") if log.check_out_time else "-"

        # LOGIKA LUPA PULANG DI DASHBOARD KARYAWAN
        log_date = log.timestamp_attempt.date()
        status_tampil = log.attendance_status
        current_time_wib = datetime.utcnow() + timedelta(hours=7)
        if log.final_status == 'Success':
            # SKENARIO 1: SESI MASIH TERBUKA (Belum Checkout)
            if not log.check_out_time:
                # Gunakan aturan 18 Jam
                durasi_gantung = (current_time_wib - log.check_in_time).total_seconds()
                if durasi_gantung > (18 * 3600):
                    status_tampil = "Lupa Pulang"
                else:
                    status_tampil = "Sesi Aktif" # Teks dinamis agar user tahu sesi masih berjalan
            
            # SKENARIO 2: SUDAH CHECKOUT & HARI SUDAH BERGANTI (Evaluasi Absen Tidak Lengkap)
            elif log_date < today:
                # Cek apakah target jadwal hari itu terpenuhi
                target_jadwal = db.query(Schedule).filter_by(
                    user_id=user_id, tanggal=log_date, is_active=True
                ).count()
                target_jadwal = target_jadwal if target_jadwal > 0 else 1 # Default 1 jika pakai shift biasa
                
                selesai_count = db.query(AttendanceLog).filter(
                    AttendanceLog.user_id == user_id,
                    func.date(AttendanceLog.timestamp_attempt) == log_date,
                    AttendanceLog.final_status == 'Success',
                    AttendanceLog.check_out_time != None
                ).count()
                
                # JIKA REALISASI < TARGET -> ABSEN TIDAK LENGKAP
                if selesai_count < target_jadwal:
                    status_tampil = "Absen Tidak Lengkap"

        history_data.append({
            "tanggal": log.timestamp_attempt.strftime("%Y-%m-%d"),
            "jam_masuk": check_in_str,
            "jam_pulang": check_out_str,
            "status_akhir": log.final_status,
            "keterangan": status_tampil if status_tampil else log.keterangan
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
            "total_telat": total_telat,
            "total_alpha": total_alpha # <-- Alpha masuk ke sini!
        },
        "action_status": action_status,
        "history": history_data
    }), 200
from flask import Blueprint, request, jsonify, current_app, send_file
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, extract
from database.connection import get_db
from models.models import User, Branch, AttendanceLog, Shift
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash
from functools import wraps
from datetime import date, datetime, timedelta
import pandas as pd
import calendar
from openpyxl.utils import get_column_letter
from io import BytesIO

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/admin")

# --- MIDDLEWARE: ADMIN ONLY ---
def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper

# --- DASHBOARD STATS (PENTING BUAT FRONTEND) ---
@admin_bp.route("/dashboard-stats", methods=["GET"])
@jwt_required()
@admin_required
def admin_stats():
    db: Session = next(get_db())
    today = date.today()

    # 1. Statistik
    total_karyawan = db.query(User).count()
    hadir_today = db.query(AttendanceLog).filter(
        func.date(AttendanceLog.timestamp_attempt) == today
    ).count()
    terlambat_today = db.query(AttendanceLog).filter(
        func.date(AttendanceLog.timestamp_attempt) == today,
        AttendanceLog.attendance_status == 'Terlambat'
    ).count()

    # 2. Live Feed
    logs = db.query(AttendanceLog).order_by(desc(AttendanceLog.timestamp_attempt)).limit(10).all()
    
    live_feed = []
    for log in logs:
        cabang_nama = log.checkin_branch.nama_cabang if log.checkin_branch else "Unknown"
        if log.checkout_branch:
            cabang_nama = f"{cabang_nama} -> {log.checkout_branch.nama_cabang}"

        live_feed.append({
            "nama": log.user.nama_lengkap,
            "role": log.user.role,
            "jam": log.timestamp_attempt.strftime("%H:%M"),
            "lokasi": cabang_nama,
            "status": log.attendance_status,
            "final_status": log.final_status
        })

    return jsonify({
        "stats": {
            "total_user": total_karyawan,
            "hadir": hadir_today,
            "terlambat": terlambat_today,
            "alpha": total_karyawan - hadir_today
        },
        "feed": live_feed
    })

# --- USER CRUD ---
@admin_bp.route("/users", methods=["POST"])
@jwt_required()
@admin_required
def create_user():
    db: Session = next(get_db())
    data = request.json
    
    # Validasi Input
    if not all(k in data for k in ("nama_lengkap", "email", "password")):
        return jsonify({"error": "Missing required fields"}), 400

    if db.query(User).filter(User.email == data.get("email")).first():
        return jsonify({"error": "Email already exists"}), 400

    # Auto Assign Shift Default jika tidak dipilih
    shift_id = data.get("shift_id")
    if not shift_id:
        default_shift = db.query(Shift).first()
        shift_id = default_shift.shift_id if default_shift else None

    user = User(
        nama_lengkap=data.get("nama_lengkap"),
        email=data.get("email"),
        password_hash=generate_password_hash(data.get("password")),
        role=data.get("role", "karyawan"),
        branch_id=data.get("branch_id"),
        shift_id=shift_id
    )
    
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return jsonify({"msg": "User created", "user_id": user.user_id}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/users", methods=["GET"])
@jwt_required()
@admin_required
def list_users():
    db: Session = next(get_db())
    users = db.query(User).all()
    result = [{
        "user_id": u.user_id,
        "nama_lengkap": u.nama_lengkap,
        "email": u.email,
        "role": u.role,
        "branch": u.branch.nama_cabang if u.branch else "-"
    } for u in users]
    return jsonify(result), 200

@admin_bp.route("/users/<int:target_user_id>", methods=["PUT"])
@jwt_required()
@admin_required
def update_user(target_user_id):
    db: Session = next(get_db())
    user = db.query(User).filter_by(user_id=target_user_id).first()
    
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.json
    if "nama_lengkap" in data: user.nama_lengkap = data["nama_lengkap"]
    if "email" in data: user.email = data["email"]
    if "password" in data: user.password_hash = generate_password_hash(data["password"])
    if "role" in data: user.role = data["role"]
    if "branch_id" in data: user.branch_id = data["branch_id"]
    if "shift_id" in data: user.shift_id = data["shift_id"]

    try:
        db.commit()
        return jsonify({"msg": "User updated"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/users/<int:target_user_id>", methods=["DELETE"])
@jwt_required()
@admin_required
def delete_user(target_user_id):
    db: Session = next(get_db())
    current_admin_id = get_jwt_identity()
    if str(target_user_id) == str(current_admin_id):
        return jsonify({"error": "Cannot delete yourself"}), 400

    user = db.query(User).filter_by(user_id=target_user_id).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    try:
        db.delete(user)
        db.commit()
        return jsonify({"message": "User deleted"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

# --- BRANCH CRUD ---
@admin_bp.route("/branches", methods=["POST"])
@jwt_required()
@admin_required
def create_branch():
    db: Session = next(get_db())
    data = request.json
    
    name = data.get("nama_cabang") or data.get("branch_name") 
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    radius = data.get("radius_meter", 50)

    if not all([name, latitude, longitude]):
        return jsonify({"error": "Missing name, lat, or lon"}), 400

    branch = Branch(
        nama_cabang=name,
        latitude=float(latitude),
        longitude=float(longitude),
        radius_meter=int(radius)
    )
    try:
        db.add(branch)
        db.commit()
        return jsonify({"msg": "Branch created", "branch_id": branch.branch_id}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/branches", methods=["GET"])
@jwt_required()
@admin_required
def list_branches():
    db: Session = next(get_db())
    branches = db.query(Branch).all()
    result = [{
        "branch_id": b.branch_id,
        "nama_cabang": b.nama_cabang,
        "latitude": b.latitude,
        "longitude": b.longitude,
        "radius_meter": b.radius_meter
    } for b in branches]
    return jsonify(result), 200

@admin_bp.route("/branches/<int:branch_id>", methods=["PUT"])
@jwt_required()
@admin_required
def update_branch(branch_id):
    db: Session = next(get_db())
    branch = db.query(Branch).filter_by(branch_id=branch_id).first()
    if not branch:
        return jsonify({"error": "Branch not found"}), 404

    data = request.json
    if "nama_cabang" in data: branch.nama_cabang = data["nama_cabang"]
    if "latitude" in data: branch.latitude = float(data["latitude"])
    if "longitude" in data: branch.longitude = float(data["longitude"])
    if "radius_meter" in data: branch.radius_meter = int(data["radius_meter"])

    try:
        db.commit()
        return jsonify({"msg": "Branch updated"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/branches/<int:branch_id>", methods=["DELETE"])
@jwt_required()
@admin_required
def delete_branch(branch_id):
    db: Session = next(get_db())
    branch = db.query(Branch).filter_by(branch_id=branch_id).first()
    if not branch:
        return jsonify({"error": "Branch not found"}), 404

    try:
        db.delete(branch)
        db.commit()
        return jsonify({"msg": "Branch deleted"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

# --- REPORTING (Admin View - JSON) ---
@admin_bp.route("/reports", methods=["GET"])
@jwt_required()
@admin_required
def get_attendance_reports():
    db: Session = next(get_db())
    
    # 1. Ambil Parameter Filter
    sekarang = datetime.utcnow() + timedelta(hours=7)
    filter_month = request.args.get('month', sekarang.month, type=int)
    filter_year = request.args.get('year', sekarang.year, type=int)
    filter_branch = request.args.get('branch_id')
    
    # 2. Tentukan Rentang Hari
    _, num_days = calendar.monthrange(filter_year, filter_month)
    if filter_year == sekarang.year and filter_month == sekarang.month:
        end_day = sekarang.day # Stop di hari ini jika bulan berjalan
    else:
        end_day = num_days

    # 3. Ambil Semua User Kecuali Admin
    all_users = db.query(User).filter(User.role != 'admin').all()

    # 4. Ambil Log Absensi Bulan Tersebut
    logs = db.query(AttendanceLog).filter(
        extract('month', AttendanceLog.timestamp_attempt) == filter_month,
        extract('year', AttendanceLog.timestamp_attempt) == filter_year
    ).all()

    # Kelompokkan Log
    logs_dict = {}
    for log in logs:
        log_date = log.timestamp_attempt.date()
        key = (log.user_id, log_date)
        if key not in logs_dict:
            logs_dict[key] = []
        logs_dict[key].append(log)

    report_data = []

    # 5. CROSS-CHECK UNTUK TAMPILAN WEB
    for day in range(1, end_day + 1):
        current_date = date(filter_year, filter_month, day)
        is_weekend = current_date.weekday() >= 5
        
        for user in all_users:
            # Jika admin memfilter cabang, kita abaikan Karyawan Alpha yang bukan dari cabang tersebut
            if filter_branch and str(user.branch_id) != str(filter_branch):
                continue
                
            key = (user.user_id, current_date)
            
            # A. Jika ada log absensi
            if key in logs_dict:
                for log in logs_dict[key]:
                    # Filter by branch untuk log
                    if filter_branch and str(log.checkin_branch_id) != str(filter_branch):
                        continue
                        
                    check_in_wib = log.check_in_time if log.check_in_time else None
                    check_out_wib = log.check_out_time  if log.check_out_time else None
                    
                    durasi = "-"
                    if check_in_wib and check_out_wib:
                        delta = check_out_wib - check_in_wib
                        durasi = str(delta).split('.')[0]
                        
                    # LOGIKA LUPA PULANG
                    sekarang_date = (datetime.utcnow() + timedelta(hours=7)).date()
                    status_hadir = log.attendance_status

                    # Jika tidak ada jam pulang DAN hari sudah berganti (kemarin)
                    if not log.check_out_time and current_date < sekarang_date:
                        status_hadir = "Lupa Pulang"
                    report_data.append({
                        "tanggal": current_date.strftime("%Y-%m-%d"),
                        "nama_karyawan": user.nama_lengkap,
                        "role": user.role,
                        "cabang": log.checkin_branch.nama_cabang if log.checkin_branch else "-",
                        "jam_masuk": check_in_wib.strftime("%H:%M") if check_in_wib else "-",
                        "jam_pulang": check_out_wib.strftime("%H:%M") if check_out_wib else "-",
                        "durasi_kerja": durasi,
                        "status_kehadiran": status_hadir,
                        "skor_wajah": f"{log.face_similarity_score:.2f}",
                        "status_akhir": log.final_status,
                        "sort_date": current_date # Hidden field untuk sorting
                    })
            
            # B. Jika TIDAK ADA log absensi (Alpha / Libur)
            else:
                status_kehadiran = "Libur" if is_weekend else "Alpha"
                
                report_data.append({
                    "tanggal": current_date.strftime("%Y-%m-%d"),
                    "nama_karyawan": user.nama_lengkap,
                    "role": user.role,
                    "cabang": user.branch.nama_cabang if user.branch else "-",
                    "jam_masuk": "-",
                    "jam_pulang": "-",
                    "durasi_kerja": "-",
                    "status_kehadiran": status_kehadiran,
                    "skor_wajah": "-",
                    "status_akhir": "Alpha" if not is_weekend else "Libur", # Status spesial
                    "sort_date": current_date
                })

    # 6. Urutkan berdasarkan tanggal terbaru ke terlama
    report_data.sort(key=lambda x: x["sort_date"], reverse=True)
    
    # Hapus field pembantu sebelum dikirim ke Frontend
    for r in report_data:
        del r["sort_date"]

    return jsonify(report_data), 200

# ==========================================
# --- FITUR BARU: EXPORT EXCEL UNTUK HRD ---
# ==========================================
# ==========================================
# --- FITUR EXPORT EXCEL (FORMAT MATRIKS BULANAN) ---
# ==========================================
@admin_bp.route('/export/attendance', methods=['GET'])
# @jwt_required()
# @admin_required
def export_attendance():
    """
    Endpoint untuk mendownload Laporan Absensi format Matriks (Pivot).
    Satu baris per karyawan, kolom berisi tanggal 1-30/31, plus rekap total.
    """
    db = next(get_db())
    
    # 1. Ambil Parameter Filter
    sekarang = datetime.utcnow() + timedelta(hours=7)
    bulan_target = request.args.get('month', sekarang.month, type=int)
    tahun_target = request.args.get('year', sekarang.year, type=int)

    # 2. Tentukan Rentang Hari dalam Bulan
    _, num_days = calendar.monthrange(tahun_target, bulan_target)

    # 3. Ambil Semua Karyawan & Log Absensinya
    all_users = db.query(User).filter(User.role != 'admin').all()
    if not all_users:
        return jsonify({"msg": "Belum ada data karyawan di sistem."}), 404

    logs = db.query(AttendanceLog).filter(
        extract('month', AttendanceLog.timestamp_attempt) == bulan_target,
        extract('year', AttendanceLog.timestamp_attempt) == tahun_target
    ).all()

    # 4. Petakan Log ke dalam Dictionary: {(user_id, tanggal): log}
    logs_dict = {}
    for log in logs:
        log_date = (log.timestamp_attempt + timedelta(hours=7)).date()
        key = (log.user_id, log_date.day)
        
        # Jika karyawan absen berkali-kali di hari yang sama, prioritaskan yang Success
        if key not in logs_dict or log.final_status == 'Success':
            logs_dict[key] = log

    # 5. Bangun Matriks Data
    data_excel = []
    
    for user in all_users:
        row_data = {
            "Nama Karyawan": user.nama_lengkap,
            "Jabatan": user.role.capitalize(),
            "Cabang Utama": user.branch.nama_cabang if user.branch else "-"
        }
        
        # Siapkan Counter Rekapitulasi
        total_hadir = 0
        total_telat = 0
        total_alpha = 0
        total_gagal = 0
        
        # Loop dari tanggal 1 sampai akhir bulan
        for day in range(1, num_days + 1):
            current_date = date(tahun_target, bulan_target, day)
            is_weekend = current_date.weekday() >= 5 # 5=Sabtu, 6=Minggu
            
            key = (user.user_id, day)
            status_teks = ""
            
            if key in logs_dict:
                log = logs_dict[key]
                sekarang_date = (datetime.utcnow() + timedelta(hours=7)).date()

                if log.final_status == 'Success':
                    # LOGIKA LUPA PULANG
                    if not log.check_out_time and current_date < sekarang_date:
                        status_teks = "Lupa Pulang"
                        total_hadir += 1
                    elif log.attendance_status == 'Terlambat':
                        status_teks = "Telat"
                        total_telat += 1
                        total_hadir += 1 # Telat tetap dihitung masuk kerja
                    else:
                        status_teks = "Hadir"
                        total_hadir += 1
                else:
                    status_teks = "Gagal"
                    total_gagal += 1
            else:
                # Jika tidak ada log absensi
                if current_date > sekarang.date():
                    status_teks = "-" # Hari belum terjadi (masa depan)
                elif is_weekend:
                    status_teks = "Libur"
                else:
                    status_teks = "Alpha"
                    total_alpha += 1
                    
            # Masukkan status ke kolom tanggal (Tgl 1, Tgl 2, dst)
            row_data[f"Tgl {day}"] = status_teks
            
        # Tambahkan Kolom Summary di Ujung Kanan
        row_data["Total Hadir"] = total_hadir
        row_data["Total Telat"] = total_telat
        row_data["Total Alpha"] = total_alpha
        row_data["Total Gagal"] = total_gagal
        
        data_excel.append(row_data)

    # 6. Convert ke Excel
    df = pd.DataFrame(data_excel)
    # Urutkan berdasarkan Nama Karyawan A-Z
    df.sort_values(by=['Nama Karyawan'], ascending=[True], inplace=True)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Rekap Matriks')
        worksheet = writer.sheets['Rekap Matriks']
        
        # Fitur UX Keren: Kunci kolom (Freeze Panes) agar nama tidak hilang saat di-scroll ke kanan
        worksheet.freeze_panes = 'D2' 
        
        # Sesuaikan lebar kolom otomatis
        for idx, col in enumerate(df.columns):
            column_letter = get_column_letter(idx + 1)
            if col.startswith("Tgl"):
                worksheet.column_dimensions[column_letter].width = 6 # Kolom tanggal dirampingkan
            else:
                max_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
                worksheet.column_dimensions[column_letter].width = max_len

    output.seek(0)
    nama_file = f"Rekap_Matriks_HRD_{tahun_target}_{bulan_target:02d}.xlsx"
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=nama_file
    )

# ==========================================
# --- FITUR TAHAP 3: LOG ANOMALI / AUDIT ---
# ==========================================
@admin_bp.route("/anomalies", methods=["GET"])
@jwt_required()
@admin_required
def get_anomalies():
    db: Session = next(get_db())
    
    # 1. Ambil Parameter Filter (Default: Bulan Ini)
    sekarang = datetime.utcnow() + timedelta(hours=7)
    bulan_target = request.args.get('month', sekarang.month, type=int)
    tahun_target = request.args.get('year', sekarang.year, type=int)
    
    # 2. Tarik data pelanggaran berdasarkan Bulan & Tahun
    logs = db.query(AttendanceLog).join(User).filter(
        AttendanceLog.final_status != 'Success',
        extract('month', AttendanceLog.timestamp_attempt) == bulan_target,
        extract('year', AttendanceLog.timestamp_attempt) == tahun_target
    ).order_by(desc(AttendanceLog.timestamp_attempt)).all()
    
    result = []
    for log in logs:
        # Konversi ke WIB
        waktu_wib = log.timestamp_attempt + timedelta(hours=7)
        
        result.append({
            "log_id": log.log_id,
            "waktu": waktu_wib.strftime("%Y-%m-%d %H:%M:%S"),
            "nama_karyawan": log.user.nama_lengkap,
            "role": log.user.role,
            "koordinat": f"{log.latitude_attempt}, {log.longitude_attempt}" if log.latitude_attempt else "Tidak ada akses GPS",
            "alasan": log.keterangan if log.keterangan else "Gagal Sistem",
            "status_akhir": log.final_status
        })
        
    return jsonify(result), 200
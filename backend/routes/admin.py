from flask import Blueprint, request, jsonify, current_app, send_file
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, extract
from database.connection import get_db
from models.models import User, Branch, AttendanceLog, FaceEmbedding
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash
from functools import wraps
from datetime import date, datetime, timedelta
import pandas as pd
import calendar
import os
from openpyxl.utils import get_column_letter
from io import BytesIO

# --- IMPORT SERVICE AI ---
from services.face_detector import FaceDetector
from services.face_service import extract_arcface_vector
from services.liveness_service import LivenessService # WAJIB ADA INI

import numpy as np
import cv2
import base64

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/admin")

# Inisialisasi Service
face_detector = FaceDetector()
liveness_svc = LivenessService() # Sekarang ini tidak akan error

def decode_base64_to_bgr(base64_string):
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    img_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

# --- MIDDLEWARE: ADMIN ONLY ---
def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role") != "admin": 
            return jsonify({"error": "Akses ditolak! Hanya Admin HRD."}), 403
        return fn(*args, **kwargs)
    return wrapper

# ==========================================
# 1. DASHBOARD STATS & LIVE FEED (DENGAN FILTER & KOORDINAT PETA)
# ==========================================
@admin_bp.route("/dashboard-stats", methods=["GET"])
@jwt_required()
@admin_required
def admin_stats():
    db: Session = next(get_db())
    today = date.today()

    # 1. Hitung Statistik (Tetap Global, tidak terpengaruh filter feed)
    total_karyawan = db.query(User).filter(User.role == 'karyawan').count()
    
    hadir_today = db.query(AttendanceLog.user_id).filter(
        func.date(AttendanceLog.timestamp) == today,
        AttendanceLog.attempt_type == 'IN',
        AttendanceLog.status == 'Success'
    ).distinct().count()

    # 2. Tangkap Parameter Filter dari URL (Frontend)
    filter_nama = request.args.get("nama")
    filter_cabang = request.args.get("cabang_id")

    # 3. Base Query untuk Live Feed (Join dengan User agar bisa baca nama)
    query = db.query(AttendanceLog).join(User)

    # 4. Terapkan Filter Jika Parameter Dikirim
    if filter_nama:
        # ilike() digunakan agar pencarian tidak sensitif huruf besar/kecil (case-insensitive)
        query = query.filter(User.nama_lengkap.ilike(f"%{filter_nama}%"))
        
    if filter_cabang:
        query = query.filter(AttendanceLog.attempted_branch_id == int(filter_cabang))

    # 5. Eksekusi Query (Ambil yang terbaru, limit diperbesar jadi 50 karena ada filter)
    logs = query.order_by(desc(AttendanceLog.timestamp)).limit(50).all()
    
    # 6. Format ke JSON
    live_feed = []
    for log in logs:
        cabang_nama = log.branch.nama_cabang if log.branch else "Dinas Luar (Bypass)"
        live_feed.append({
            "nama": log.user.nama_lengkap,
            "role": "Fleksibel" if log.user.marketing_flexible else "Statis",
            "tipe": log.attempt_type,
            "jam": (log.timestamp + timedelta(hours=7)).strftime("%H:%M"),
            "lokasi": cabang_nama,
            "status_akhir": log.status,
            
            # --- TAMBAHAN BARU UNTUK GOOGLE MAPS ---
            "lat": float(log.latitude_attempt) if log.latitude_attempt is not None else None,
            "lng": float(log.longitude_attempt) if log.longitude_attempt is not None else None,
            "laporan": log.laporan_kegiatan
        })

    return jsonify({
        "stats": {
            "total_user": total_karyawan,
            "hadir": hadir_today,
            "alpha": max(0, total_karyawan - hadir_today)
        },
        "feed": live_feed
    }), 200
# ==========================================
# 2. USER CRUD (DENGAN TRIPLE THREAT AI)
# ==========================================
@admin_bp.route("/users", methods=["POST"])
@jwt_required()
@admin_required # Menggunakan middleware agar konsisten
def create_user():
    db: Session = next(get_db())
    data = request.json
    
    if not all(k in data for k in ("nik", "nama_lengkap", "email", "password", "image_base64")):
        return jsonify({"error": "Data tidak lengkap. Foto wajah wajib ada."}), 400
    
    if db.query(User).filter(User.nik == data.get("nik")).first():
        return jsonify({"error": "NIK sudah terdaftar."}), 400

    if db.query(User).filter(User.email == data.get("email")).first():
        return jsonify({"error": "Email sudah terdaftar."}), 400

    try:
        img_bgr = decode_base64_to_bgr(data.get("image_base64"))
        
        # 1. Detection
        faces = face_detector.detect_faces(img_bgr)
        if not faces: 
            return jsonify({"error": "Wajah tidak ditemukan"}), 422
        
        # 2. Liveness (PENTING!)
        if not liveness_svc.check_liveness(img_bgr)["is_live"]:
            return jsonify({"error": "Ditolak! Harap gunakan wajah asli karyawan."}), 403
            
        # 3. Embedding
        largest_face = face_detector.pick_largest(faces)
        kpss = largest_face["kps"]
        face_vector = extract_arcface_vector(img_bgr, kpss)
        
        if face_vector is None:
            return jsonify({"error": "Gagal mengekstrak fitur wajah."}), 400
            
    except Exception as e:
        return jsonify({"error": f"Error AI: {str(e)}"}), 500

    is_flexible = data.get("marketing_flexible", False)
    user = User(
        nik=data.get("nik"),
        nama_lengkap=data.get("nama_lengkap"),
        email=data.get("email"),
        password_hash=generate_password_hash(data.get("password")),
        role=data.get("role", "karyawan"),
        branch_id=None if is_flexible else data.get("branch_id"),
        marketing_flexible=is_flexible
    )
    
    try:
        db.add(user)
        db.flush() 
        
        embedding_blob = face_vector.tobytes()
        new_embedding = FaceEmbedding(user_id=user.user_id, embedding_data=embedding_blob)
        
        db.add(new_embedding)
        db.commit() 
        return jsonify({"msg": "User & Biometrik Berhasil!", "user_id": user.user_id}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/users", methods=["GET"])
@jwt_required()
@admin_required
def list_users():
    db: Session = next(get_db())
    users = db.query(User).all()
    return jsonify([{
        "user_id": u.user_id,
        "nama_lengkap": u.nama_lengkap,
        "email": u.email,
        "role": u.role,
        "branch": u.branch.nama_cabang if u.branch else "Fleksibel (Semua Area)",
        "marketing_flexible": u.marketing_flexible
    } for u in users]), 200

@admin_bp.route("/users/<int:target_user_id>", methods=["DELETE"])
@jwt_required()
@admin_required
def delete_user(target_user_id):
    db: Session = next(get_db())
    if str(target_user_id) == str(get_jwt_identity()):
        return jsonify({"error": "Tidak bisa menghapus akun sendiri"}), 400

    user = db.query(User).filter_by(user_id=target_user_id).first()
    if not user: return jsonify({"error": "User tidak ditemukan"}), 404
        
    try:
        db.delete(user)
        db.commit()
        return jsonify({"message": "User deleted"}), 200
    except Exception as e:
        db.rollback(); return jsonify({"error": str(e)}), 500

# ==========================================
# 3. BRANCH CRUD
# ==========================================
@admin_bp.route("/branches", methods=["POST"])
@jwt_required()
@admin_required
def create_branch():
    db: Session = next(get_db())
    data = request.json
    branch = Branch(
        nama_cabang=data.get("nama_cabang"), 
        latitude=float(data.get("latitude")), 
        longitude=float(data.get("longitude")), 
        radius_meter=int(data.get("radius_meter", 50))
    )
    try:
        db.add(branch); db.commit()
        return jsonify({"msg": "Branch created", "branch_id": branch.branch_id}), 201
    except Exception as e:
        db.rollback(); return jsonify({"error": str(e)}), 500

@admin_bp.route("/branches", methods=["GET"])
@jwt_required()
@admin_required
def list_branches():
    db: Session = next(get_db())
    branches = db.query(Branch).all()
    return jsonify([{
        "branch_id": b.branch_id, "nama_cabang": b.nama_cabang,
        "latitude": float(b.latitude), "longitude": float(b.longitude),
        "radius_meter": b.radius_meter
    } for b in branches]), 200

# ==========================================
# 4. REPORTING EXCEL
# ==========================================
import pandas as pd
from io import BytesIO
import calendar
from datetime import datetime, timedelta, date
from sqlalchemy import extract
from flask import send_file, request, jsonify
# Pastikan import lain yang dibutuhkan sudah ada...

# ==========================================
# 1. API UNTUK TABEL LAPORAN (REPORT)
# ==========================================
@admin_bp.route('/reports', methods=['GET'])
@jwt_required()
@admin_required
def get_reports():
    db = next(get_db())
    sekarang = datetime.utcnow() + timedelta(hours=7)
    
    bulan_target = request.args.get('month', sekarang.month, type=int)
    tahun_target = request.args.get('year', sekarang.year, type=int)
    branch_id = request.args.get('branch_id', type=int)

    # Base query untuk mencari absen sukses di bulan tersebut
    query = db.query(AttendanceLog).filter(
        extract('month', AttendanceLog.timestamp) == bulan_target,
        extract('year', AttendanceLog.timestamp) == tahun_target,
        AttendanceLog.status == 'Success'
    )

    # Filter by Cabang (Jika HRD memilih dropdown cabang)
    if branch_id:
        query = query.filter(AttendanceLog.attempted_branch_id == branch_id)
        
    logs = query.all()

    # Strukturkan data untuk tabel frontend
    laporan_harian = {}
    for log in logs:
        log_date = (log.timestamp + timedelta(hours=7)).strftime("%Y-%m-%d")
        user_id = log.user_id
        key = f"{user_id}_{log_date}"
        
        if key not in laporan_harian:
            laporan_harian[key] = {
                "tanggal": log_date,
                "nama_karyawan": log.user.nama_lengkap,
                "role": "Dinamis" if log.user.marketing_flexible else "Statis",
                "cabang": log.branch.nama_cabang if log.branch else "Bypass Lapangan",
                "jam_masuk": None, "lat_in": None, "lng_in": None,    # <-- Siapkan slot IN
                "jam_pulang": None, "lat_out": None, "lng_out": None, # <-- Siapkan slot OUT
                "status_kehadiran": log.status if log.status in ['Sakit', 'Izin', 'Cuti'] else "Hadir"
            }
            
        jam_str = (log.timestamp + timedelta(hours=7)).strftime("%H:%M")
        lat_val = float(log.latitude_attempt) if log.latitude_attempt else None
        lng_val = float(log.longitude_attempt) if log.longitude_attempt else None

        # Pisahkan koordinat berdasarkan tipe absennya
        if log.attempt_type == 'IN':
            laporan_harian[key]["jam_masuk"] = jam_str
            laporan_harian[key]["lat_in"] = lat_val
            laporan_harian[key]["lng_in"] = lng_val
        elif log.attempt_type == 'OUT':
            laporan_harian[key]["jam_pulang"] = jam_str
            laporan_harian[key]["lat_out"] = lat_val
            laporan_harian[key]["lng_out"] = lng_val

    # Ubah dictionary ke list untuk dikirim ke React
    hasil_akhir = list(laporan_harian.values())
    
    # Urutkan berdasarkan tanggal terbalik (terbaru di atas)
    hasil_akhir.sort(key=lambda x: x['tanggal'], reverse=True)

    return jsonify(hasil_akhir), 200

@admin_bp.route('/export/attendance', methods=['GET'])
@jwt_required()
@admin_required
def export_attendance():
    db = next(get_db())
    sekarang = datetime.utcnow() + timedelta(hours=7)
    
    bulan_target = request.args.get('month', sekarang.month, type=int)
    tahun_target = request.args.get('year', sekarang.year, type=int)
    branch_id = request.args.get('branch_id', type=int) # Tambahan: Tangkap filter cabang

    _, num_days = calendar.monthrange(tahun_target, bulan_target)
    
    # Filter user: Jika branch_id ada, hanya ambil karyawan di cabang tersebut
    user_query = db.query(User).filter(User.role == 'karyawan')
    if branch_id:
        user_query = user_query.filter(User.branch_id == branch_id)
    all_users = user_query.all()
    
    # Cari Log
    log_query = db.query(AttendanceLog).filter(
        extract('month', AttendanceLog.timestamp) == bulan_target,
        extract('year', AttendanceLog.timestamp) == tahun_target,
        AttendanceLog.status.in_(['Success', 'Sakit', 'Izin', 'Cuti'])
    )
    if branch_id:
        log_query = log_query.filter(AttendanceLog.attempted_branch_id == branch_id)
    logs = log_query.all()

    logs_dict = {}
    for log in logs:
        log_date = (log.timestamp + timedelta(hours=7)).date()
        key = (log.user_id, log_date.day)
        if key not in logs_dict: logs_dict[key] = {'IN': None, 'OUT': None}
        log_time = (log.timestamp + timedelta(hours=7)).strftime("%H:%M")
        if log.attempt_type == 'IN' and not logs_dict[key]['IN']: logs_dict[key]['IN'] = log_time
        if log.attempt_type == 'OUT': logs_dict[key]['OUT'] = log_time

    data_excel = []
    for user in all_users:
        row_data = {
            "Nama Karyawan": user.nama_lengkap, 
            "Tipe": "Dinamis" if user.marketing_flexible else "Statis"
        }
        t_hadir = 0; t_alpha = 0
        for day in range(1, num_days + 1):
            curr = date(tahun_target, bulan_target, day)
            key = (user.user_id, day)
            if key in logs_dict:
                row_data[f"Tgl {day}"] = f"IN: {logs_dict[key]['IN'] or '-'} | OUT: {logs_dict[key]['OUT'] or '-'}"
                t_hadir += 1
            else:
                row_data[f"Tgl {day}"] = "Libur" if curr.weekday() >= 6 else "Alpha"
                if curr.weekday() < 6 and curr <= sekarang.date(): t_alpha += 1
        
        row_data["Total Hadir"] = t_hadir
        row_data["Total Alpha"] = t_alpha
        data_excel.append(row_data)

    df = pd.DataFrame(data_excel)
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Rekap')
    output.seek(0)
    
    nama_file = f"Rekap_{tahun_target}_{bulan_target}.xlsx"
    if branch_id:
        nama_file = f"Rekap_Cabang_{branch_id}_{tahun_target}_{bulan_target}.xlsx"
        
    return send_file(
        output, 
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
        as_attachment=True, 
        download_name=nama_file
    )

@admin_bp.route('/manual-attendance', methods=['POST'])
@jwt_required()
@admin_required
def manual_attendance():
    db = next(get_db())
    data = request.json
    
    user_id = data.get('user_id')
    tanggal_str = data.get('tanggal') # Format: YYYY-MM-DD
    status = data.get('status')
    keterangan = data.get('keterangan', '')

    if not all([user_id, tanggal_str, status]):
        return jsonify({"error": "Data tidak lengkap"}), 400

    # Ubah string tanggal menjadi objek datetime (Set jam 08:00 pagi WIB / 01:00 UTC)
    # Agar masuk akal secara urutan waktu
    try:
        tanggal_obj = datetime.strptime(f"{tanggal_str} 01:00:00", "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return jsonify({"error": "Format tanggal salah"}), 400

    # Cek apakah sudah ada log manual di hari yang sama agar tidak dobel
    existing_log = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == user_id,
        extract('year', AttendanceLog.timestamp) == tanggal_obj.year,
        extract('month', AttendanceLog.timestamp) == tanggal_obj.month,
        extract('day', AttendanceLog.timestamp) == tanggal_obj.day,
        AttendanceLog.status.in_(['Sakit', 'Izin', 'Cuti'])
    ).first()

    if existing_log:
        return jsonify({"error": f"Karyawan sudah tercatat {existing_log.status} pada tanggal tersebut."}), 400

    # Buat Log Ground Truth dengan Gatekeeper AI yang di-Bypass (Dibuat NULL)
    new_log = AttendanceLog(
        user_id=user_id,
        attempt_type='MANUAL', # Menandakan ini bukan dari mesin absensi
        timestamp=tanggal_obj,
        latitude_attempt=None,
        longitude_attempt=None,
        distance_meters=None,
        is_live=None,
        similarity_score=None,
        status=status,
        keterangan_hrd=keterangan
    )

    db.add(new_log)
    db.commit()

    return jsonify({"msg": "Data manual berhasil disimpan"}), 200
# ==========================================
# 5. LOG ANOMALI
# ==========================================
@admin_bp.route("/anomalies", methods=["GET"])
@jwt_required()
@admin_required 
def get_anomalies():
    db = next(get_db())
    threshold = float(os.getenv("ARCFACE_THRESHOLD", 0.50))
    logs = db.query(AttendanceLog).filter_by(status='Failed').order_by(desc(AttendanceLog.timestamp)).limit(50).all()
    
    res = []
    for l in logs:
        reason = "Anomali Sistem Tidak Diketahui"
        
        # URUTAN SESUAI ACTIVITY DIAGRAM (GEOFENCING -> LIVENESS -> ARCFACE)
        
        # 1. Cek Geofencing
        if l.distance_meters is not None and l.branch and l.distance_meters > l.branch.radius_meter:
            reason = f"Luar Area ({round(l.distance_meters)}m)"
            
        # 2. Cek Liveness (Anti-Spoofing)
        elif l.is_live is False: 
            reason = "Spoofing (Foto Palsu / Topeng)"
            
        # 3. Cek ArcFace (Kecocokan Wajah)
        elif l.similarity_score is not None and l.similarity_score < threshold:
            reason = f"Wajah Tidak Cocok ({round(l.similarity_score*100)}%)"
            
        res.append({
            "log_id": l.log_id, 
            "waktu": (l.timestamp + timedelta(hours=7)).strftime("%Y-%m-%d %H:%M"),
            "nama_karyawan": l.user.nama_lengkap, 
            "alasan": reason,
            "koordinat": f"{l.latitude_attempt}, {l.longitude_attempt}" if l.latitude_attempt is not None else "No GPS"
        })
        
    return jsonify(res), 200
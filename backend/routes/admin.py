from flask import Blueprint, request, jsonify, current_app
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database.connection import get_db
from models.models import User, Branch, AttendanceLog, Shift
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash
from functools import wraps
from datetime import date

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/admin")

# --- MIDDLEWARE: ADMIN ONLY ---
# Kita buat lokal saja biar tidak tergantung file utils lain
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
    # PERBAIKAN: Gunakan 'target_user_id' dari URL, JANGAN get_jwt_identity()
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
    # PERBAIKAN: Gunakan 'target_user_id' agar admin tidak menghapus dirinya sendiri
    db: Session = next(get_db())
    
    # Cegah admin menghapus dirinya sendiri (Safety)
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
    
    # PERBAIKAN: Sesuaikan nama kolom dengan models.py (nama_cabang)
    name = data.get("nama_cabang") or data.get("branch_name") 
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    radius = data.get("radius_meter", 50)

    if not all([name, latitude, longitude]):
        return jsonify({"error": "Missing name, lat, or lon"}), 400

    branch = Branch(
        nama_cabang=name, # Gunakan nama_cabang
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
    

# ... (Kode create_branch yang sudah ada biarkan saja) ...

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
    # Cek apakah ada user yang terikat di cabang ini? (Optional Safety)
    # user_count = db.query(User).filter_by(branch_id=branch_id).count()
    # if user_count > 0: return jsonify({"error": "Cannot delete branch with active users"}), 400

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
    


# --- REPORTING (Admin View) ---

@admin_bp.route("/reports", methods=["GET"])
@jwt_required()
@admin_required
def get_attendance_reports():
    db: Session = next(get_db())
    
    # Ambil parameter filter dari URL (Query Params)
    # Contoh: /admin/reports?date=2023-10-25&branch_id=2
    filter_date = request.args.get('date')
    filter_branch = request.args.get('branch_id')
    
    query = db.query(AttendanceLog).join(User).order_by(desc(AttendanceLog.timestamp_attempt))
    
    # Filter by Date
    if filter_date:
        query = query.filter(func.date(AttendanceLog.timestamp_attempt) == filter_date)
    else:
        # Default: Tampilkan hari ini saja biar ringan
        query = query.filter(func.date(AttendanceLog.timestamp_attempt) == date.today())
        
    # Filter by Branch
    if filter_branch:
        query = query.filter(AttendanceLog.checkin_branch_id == filter_branch)

    logs = query.all()
    
    report_data = []
    for log in logs:
        # Hitung Durasi
        durasi = "-"
        if log.check_in_time and log.check_out_time:
            delta = log.check_out_time - log.check_in_time
            durasi = str(delta).split('.')[0] # Format H:M:S
            
        report_data.append({
            "nama_karyawan": log.user.nama_lengkap,
            "role": log.user.role,
            "cabang": log.checkin_branch.nama_cabang if log.checkin_branch else "-",
            "jam_masuk": log.check_in_time.strftime("%H:%M") if log.check_in_time else "-",
            "jam_pulang": log.check_out_time.strftime("%H:%M") if log.check_out_time else "-",
            "durasi_kerja": durasi,
            "status_kehadiran": log.attendance_status, # Tepat Waktu/Terlambat
            "skor_wajah": f"{log.face_similarity_score:.2f}",
            "status_akhir": log.final_status
        })
        
    return jsonify(report_data), 200
from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database.connection import get_db
from models.models import Schedule, User, Branch
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from functools import wraps
from datetime import datetime, date

schedule_bp = Blueprint("schedule_bp", __name__, url_prefix="/schedule")

# --- MIDDLEWARE: ADMIN CHECK ---
def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper

# --- ADMIN ENDPOINTS (CRUD) ---

@schedule_bp.route("/", methods=["GET"])
@jwt_required()
@admin_required
def list_all_schedules():
    """
    Admin melihat semua jadwal (bisa difilter tanggal)
    """
    db: Session = next(get_db())
    
    # Filter opsional dari URL ?date=2025-12-09
    filter_date = request.args.get('date')
    
    query = db.query(Schedule).join(User).join(Branch).order_by(desc(Schedule.tanggal))
    
    if filter_date:
        query = query.filter(Schedule.tanggal == filter_date)
        
    schedules = query.all()
    
    result = [{
        "schedule_id": s.schedule_id,
        "user_id": s.user_id,
        "nama_karyawan": s.user.nama_lengkap, # Tampilkan Nama
        "branch_id": s.branch_id,
        "nama_cabang": s.branch.nama_cabang,  # Tampilkan Lokasi
        "tanggal": s.tanggal.isoformat(),
        "jam_mulai": s.jam_mulai.strftime("%H:%M"),
        "jam_selesai": s.jam_selesai.strftime("%H:%M"),
        "is_active": s.is_active
    } for s in schedules]
    
    return jsonify(result), 200

@schedule_bp.route("/", methods=["POST"])
@jwt_required()
@admin_required
def create_schedule():
    db: Session = next(get_db())
    data = request.json

    required_fields = ["user_id", "branch_id", "tanggal", "jam_mulai", "jam_selesai"]
    if not all(f in data for f in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        schedule = Schedule(
            user_id=data["user_id"],
            branch_id=data["branch_id"],
            tanggal=datetime.strptime(data["tanggal"], "%Y-%m-%d").date(),
            jam_mulai=datetime.strptime(data["jam_mulai"], "%H:%M").time(),
            jam_selesai=datetime.strptime(data["jam_selesai"], "%H:%M").time(),
            is_active=True
        )
        db.add(schedule)
        db.commit()
        return jsonify({"msg": "Jadwal berhasil dibuat", "schedule_id": schedule.schedule_id}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

@schedule_bp.route("/<int:schedule_id>", methods=["PUT"])
@jwt_required()
@admin_required
def update_schedule(schedule_id):
    db: Session = next(get_db())
    schedule = db.query(Schedule).filter(Schedule.schedule_id == schedule_id).first()
    if not schedule: return jsonify({"error": "Schedule not found"}), 404

    data = request.json
    try:
        if "branch_id" in data: schedule.branch_id = data["branch_id"]
        if "tanggal" in data: 
            schedule.tanggal = datetime.strptime(data["tanggal"], "%Y-%m-%d").date()
        if "jam_mulai" in data: 
            schedule.jam_mulai = datetime.strptime(data["jam_mulai"], "%H:%M").time()
        if "jam_selesai" in data: 
            schedule.jam_selesai = datetime.strptime(data["jam_selesai"], "%H:%M").time()
        if "is_active" in data: 
            schedule.is_active = bool(data["is_active"])

        db.commit()
        return jsonify({"msg": "Jadwal berhasil diupdate"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

@schedule_bp.route("/<int:schedule_id>", methods=["DELETE"])
@jwt_required()
@admin_required
def delete_schedule(schedule_id):
    db: Session = next(get_db())
    schedule = db.query(Schedule).filter(Schedule.schedule_id == schedule_id).first()
    if not schedule: return jsonify({"error": "Schedule not found"}), 404
    
    try:
        db.delete(schedule)
        db.commit()
        return jsonify({"msg": "Jadwal dihapus"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

# --- USER ENDPOINT (VIEW ONLY) ---

@schedule_bp.route("/my", methods=["GET"])
@jwt_required()
def get_my_schedule():
    """
    User/Supervisor melihat jadwal mereka sendiri.
    Menampilkan Nama Cabang agar user tahu harus ke mana.
    """
    db: Session = next(get_db())
    user_id = get_jwt_identity()
    
    # Ambil jadwal hari ini ke depan (Upcoming)
    today = date.today()
    
    # Join dengan Branch supaya user tau nama tempatnya
    schedules = db.query(Schedule).join(Branch).filter(
        Schedule.user_id == user_id,
        Schedule.is_active == True,
        Schedule.tanggal >= today
    ).order_by(Schedule.tanggal.asc()).all()

    result = [{
        "schedule_id": s.schedule_id,
        "tanggal": s.tanggal.isoformat(),
        "jam_mulai": s.jam_mulai.strftime("%H:%M"),
        "jam_selesai": s.jam_selesai.strftime("%H:%M"),
        "nama_cabang": s.branch.nama_cabang, # <--- PENTING BUAT USER
        "alamat": f"Lat: {s.branch.latitude}, Lon: {s.branch.longitude}",
        "status": "Aktif" if s.is_active else "Batal"
    } for s in schedules]

    return jsonify(result), 200
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
        # UPDATE 1: Role menjadi admin_hrd
        if claims.get("role") != "admin_hrd":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper

# --- ADMIN ENDPOINTS (CRUD) ---

@schedule_bp.route("/", methods=["GET"])
@jwt_required()
@admin_required
def list_all_schedules():
    db: Session = next(get_db())
    filter_date = request.args.get('date')
    
    # UPDATE 2: Gunakan outerjoin(Branch) agar jadwal "Dinas Luar" yang tidak punya cabang tetap muncul!
    query = db.query(Schedule).join(User).outerjoin(Branch).order_by(desc(Schedule.tanggal))
    
    if filter_date:
        query = query.filter(Schedule.tanggal == filter_date)
        
    schedules = query.all()
    
    result = [{
        "schedule_id": s.schedule_id,
        "user_id": s.user_id,
        "nama_karyawan": s.user.nama_lengkap, 
        "branch_id": s.branch_id,
        # UPDATE 3: Penanganan aman jika branch_id NULL
        "nama_cabang": s.branch.nama_cabang if s.branch else "Dinas Luar / Bebas Lokasi", 
        "tipe_jadwal": s.tipe_jadwal, # <-- Menampilkan tipe jadwal ke HRD
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

    required_fields = ["user_id", "tanggal", "jam_mulai", "jam_selesai"]
    if not all(f in data for f in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    # UPDATE 4: Logika Cerdas Pendaftaran Cabang vs Dinas Luar
    tipe_jadwal = data.get("tipe_jadwal", "Reguler")
    branch_id = data.get("branch_id")

    if tipe_jadwal != "Dinas Luar" and not branch_id:
        return jsonify({"error": "Cabang wajib diisi untuk jadwal Reguler / BKO"}), 400

    try:
        schedule = Schedule(
            user_id=data["user_id"],
            branch_id=branch_id if tipe_jadwal != "Dinas Luar" else None,
            tipe_jadwal=tipe_jadwal, # <-- Simpan tipe jadwal
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
        if "tipe_jadwal" in data: 
            schedule.tipe_jadwal = data["tipe_jadwal"]
            
        # Jika diubah jadi Dinas Luar, pastikan cabangnya otomatis jadi Null
        if schedule.tipe_jadwal == "Dinas Luar":
            schedule.branch_id = None
        elif "branch_id" in data: 
            schedule.branch_id = data["branch_id"]

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
    
    today = date.today()
    
    # UPDATE 5: outerjoin Branch agar Dinas Luar bisa muncul di HP karyawan
    schedules = db.query(Schedule).outerjoin(Branch).filter(
        Schedule.user_id == user_id,
        Schedule.is_active == True,
        Schedule.tanggal >= today
    ).order_by(Schedule.tanggal.asc()).all()

    result = [{
        "schedule_id": s.schedule_id,
        "tanggal": s.tanggal.isoformat(),
        "tipe_jadwal": s.tipe_jadwal,
        "jam_mulai": s.jam_mulai.strftime("%H:%M"),
        "jam_selesai": s.jam_selesai.strftime("%H:%M"),
        "nama_cabang": s.branch.nama_cabang if s.branch else "Dinas Luar (Bebas Lokasi)", 
        "alamat": f"Lat: {s.branch.latitude}, Lon: {s.branch.longitude}" if s.branch else "Menggunakan GPS Aktual",
        "status": "Aktif" if s.is_active else "Batal"
    } for s in schedules]

    return jsonify(result), 200
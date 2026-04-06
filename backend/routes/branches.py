from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from database.connection import get_db
from models.models import Branch, User
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from functools import wraps

branches_bp = Blueprint("branches_bp", __name__, url_prefix="/branches")

# Middleware Helper: Pastikan role adalah 'admin'
def admin_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role") != "admin":
            return jsonify({"error": "Akses ditolak! Hanya Admin HRD yang diizinkan."}), 403
        return func(*args, **kwargs)
    return wrapper

@branches_bp.route("/", methods=["GET"])
@jwt_required()
def get_branches():
    db: Session = next(get_db())
    branches = db.query(Branch).all()
    result = [{
        "branch_id": b.branch_id,
        "nama_cabang": b.nama_cabang,
        "latitude": float(b.latitude),
        "longitude": float(b.longitude),
        "radius_meter": getattr(b, "radius_meter", 50)
    } for b in branches]
    return jsonify(result), 200

@branches_bp.route("/create", methods=["POST"])
@jwt_required()
@admin_required
def create_branch():
    db: Session = next(get_db())
    data = request.json
    
    nama_cabang = data.get("nama_cabang") 
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    radius_meter = data.get("radius_meter", 50)

    if not all([nama_cabang, latitude, longitude]):
        return jsonify({"error": "Data tidak lengkap"}), 400

    branch = Branch(
        nama_cabang=nama_cabang,
        latitude=float(latitude),
        longitude=float(longitude),
        radius_meter=int(radius_meter)
    )
    db.add(branch)
    db.commit()

    return jsonify({"msg": "Cabang dibuat!", "branch_id": branch.branch_id}), 201

@branches_bp.route("/<int:branch_id>/update", methods=["PUT"])
@jwt_required()
@admin_required
def update_branch(branch_id):
    db: Session = next(get_db())
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        return jsonify({"error": "Cabang tidak ditemukan"}), 404

    data = request.json
    if "nama_cabang" in data: branch.nama_cabang = data["nama_cabang"]
    if "latitude" in data: branch.latitude = float(data["latitude"])
    if "longitude" in data: branch.longitude = float(data["longitude"])
    if "radius_meter" in data: branch.radius_meter = int(data["radius_meter"])

    db.commit()
    return jsonify({"msg": "Cabang diupdate"}), 200

@branches_bp.route("/<int:branch_id>/delete", methods=["DELETE"])
@jwt_required()
@admin_required
def delete_branch(branch_id):
    db: Session = next(get_db())
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch: return jsonify({"error": "Cabang tidak ditemukan"}), 404

    db.delete(branch)
    db.commit()
    return jsonify({"message": "Cabang berhasil dihapus"}), 200
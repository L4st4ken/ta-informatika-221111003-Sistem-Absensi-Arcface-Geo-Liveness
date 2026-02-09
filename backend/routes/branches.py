# routes/branches.py
from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from database.connection import get_db
from models.models import Branch, User
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.roles import role_required

branches_bp = Blueprint("branches_bp", __name__, url_prefix="/branches")

# Middleware helper: pastikan user adalah admin
def admin_required(func):
    def wrapper(*args, **kwargs):
        current_email = get_jwt_identity()
        db: Session = next(get_db())
        user_id = get_jwt_identity()
        user = db.query(User).filter(user_id=user_id).first()
        if not user or user.role != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return func(*args, **kwargs)
    wrapper.__name__ = func.__name__
    return wrapper

@branches_bp.route("/", methods=["GET"])
@jwt_required()
def get_branches():
    db: Session = next(get_db())
    branches = db.query(Branch).all()
    result = [{
        "branch_id": b.branch_id,
        "branch_name": b.branch_name,
        "latitude": b.latitude,
        "longitude": b.longitude,
        "radius_meter": getattr(b, "radius_meter", None)
    } for b in branches]
    return jsonify(result), 200

@branches_bp.route("/create", methods=["POST"])
@jwt_required()
@role_required("admin")
def create_branch():
    db: Session = next(get_db())
    data = request.json
    branch_name = data.get("branch_name")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    radius_meter = data.get("radius_meter", 50)

    if not all([branch_name, latitude, longitude]):
        return jsonify({"error": "Missing required fields"}), 400

    branch = Branch(
        branch_name=branch_name,
        latitude=float(latitude),
        longitude=float(longitude),
        radius_meter=int(radius_meter)
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)

    return jsonify({
        "branch_id": branch.branch_id,
        "branch_name": branch.branch_name,
        "latitude": branch.latitude,
        "longitude": branch.longitude,
        "radius_meter": branch.radius_meter
    }), 201

@branches_bp.route("/<int:branch_id>/update", methods=["PUT"])
@jwt_required()
@role_required("admin")
def update_branch(branch_id):
    db: Session = next(get_db())
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        return jsonify({"error": "Branch not found"}), 404

    data = request.json
    branch.branch_name = data.get("branch_name", branch.branch_name)
    branch.latitude = float(data.get("latitude", branch.latitude))
    branch.longitude = float(data.get("longitude", branch.longitude))
    branch.radius_meter = int(data.get("radius_meter", getattr(branch, "radius_meter", 50)))

    db.commit()
    db.refresh(branch)

    return jsonify({
        "branch_id": branch.branch_id,
        "branch_name": branch.branch_name,
        "latitude": branch.latitude,
        "longitude": branch.longitude,
        "radius_meter": branch.radius_meter
    }), 200

@branches_bp.route("/<int:branch_id>/delete", methods=["DELETE"])
@jwt_required()
@admin_required
def delete_branch(branch_id):
    db: Session = next(get_db())
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        return jsonify({"error": "Branch not found"}), 404

    db.delete(branch)
    db.commit()
    return jsonify({"message": "Branch deleted"}), 200

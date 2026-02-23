from flask import Blueprint, jsonify
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import timedelta
from database.connection import get_db
from models.models import AttendanceLog
from flask_jwt_extended import jwt_required, get_jwt_identity

# File ini murni hanya untuk Query Database untuk laporan.

attendance_bp = Blueprint("attendance_bp", __name__, url_prefix="/attendance")

@attendance_bp.route("/history", methods=["GET"])
@jwt_required()
def history():
    """
    Endpoint KHUSUS Reporting User.
    Mengambil data riwayat absensi untuk ditampilkan di menu 'Riwayat'.
    """
    db: Session = next(get_db())
    uid = get_jwt_identity()
    
    # Ambil 30 log terakhir user ini
    logs = db.query(AttendanceLog).filter(
        AttendanceLog.user_id == uid
    ).order_by(desc(AttendanceLog.check_in_time)).limit(30).all()
    
    history_data = []
    for log in logs:
        # Konversi UTC ke WIB (+7) untuk tampilan
        check_in_wib = log.check_in_time + timedelta(hours=7) if log.check_in_time else None
        check_out_wib = log.check_out_time + timedelta(hours=7) if log.check_out_time else None
        
        # Hitung Durasi Kerja
        durasi = "-"
        if check_in_wib and check_out_wib:
            delta = check_out_wib - check_in_wib
            # Hilangkan milidetik agar rapi (H:M:S)
            durasi = str(delta).split('.')[0] 

        history_data.append({
            "log_id": log.log_id,
            "tanggal": check_in_wib.strftime("%Y-%m-%d") if check_in_wib else "-",
            "jam_masuk": check_in_wib.strftime("%H:%M") if check_in_wib else "-",
            "jam_pulang": check_out_wib.strftime("%H:%M") if check_out_wib else "-",
            "durasi": durasi,
            "status": log.attendance_status, 
            "cabang": log.checkin_branch.nama_cabang if log.checkin_branch else "Unknown",
            "status_akhir": log.final_status,
            "keterangan": log.keterangan if log.keterangan else "-" # <-- TAMBAHAN BARU
        })
        
    return jsonify(history_data), 200
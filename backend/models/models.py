from sqlalchemy import Column, Integer, String, Float, Text, Date, Time, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from database.connection import Base
from datetime import datetime

# -----------------------------
# 1. Master Shift (BARU)
# -----------------------------
# Menyimpan template jam kerja (cth: "Reguler 08:00-16:00")
class Shift(Base):
    __tablename__ = "shifts"

    shift_id = Column(Integer, primary_key=True, autoincrement=True)
    nama_shift = Column(String(50), nullable=False)  # e.g. "Pagi", "Siang"
    jam_masuk = Column(Time, nullable=False)         # 08:00:00
    jam_pulang = Column(Time, nullable=False)        # 16:00:00

    # Relationships
    users = relationship("User", back_populates="shift")


# -----------------------------
# 2. Branch
# -----------------------------
class Branch(Base):
    __tablename__ = "branches"

    branch_id = Column(Integer, primary_key=True, autoincrement=True)
    nama_cabang = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    radius_meter = Column(Integer, default=50)

    # Relationships
    users = relationship("User", back_populates="branch")
    schedules = relationship("Schedule", back_populates="branch")
    
    # Relasi ke Logs (Ada 2 karena CheckIn dan CheckOut)
    logs_checkin = relationship("AttendanceLog", foreign_keys="[AttendanceLog.checkin_branch_id]", back_populates="checkin_branch")
    logs_checkout = relationship("AttendanceLog", foreign_keys="[AttendanceLog.checkout_branch_id]", back_populates="checkout_branch")


# -----------------------------
# 3. User
# -----------------------------
class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    nama_lengkap = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum('karyawan', 'supervisor', 'admin'), nullable=False, default='karyawan')
    
    # Lokasi Tetap (Homebase)
    branch_id = Column(Integer, ForeignKey("branches.branch_id"), nullable=True)
    
    # Shift Tetap (Default Shift) - BARU
    shift_id = Column(Integer, ForeignKey("shifts.shift_id"), nullable=True)

    # Relationships
    branch = relationship("Branch", back_populates="users")
    shift = relationship("Shift", back_populates="users") # Relasi ke Shift
    
    embeddings = relationship("FaceEmbedding", back_populates="user", uselist=False)
    schedules = relationship("Schedule", back_populates="user")
    attendance_logs = relationship("AttendanceLog", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


# -----------------------------
# 4. Face Embedding
# -----------------------------
class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    embedding_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), unique=True, nullable=False)
    embedding_data = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="embeddings")


# -----------------------------
# 5. Schedule (Override/Dinas)
# -----------------------------
# Hanya dipakai jika Supervisor punya jadwal khusus di luar shift default
class Schedule(Base):
    __tablename__ = "schedules"

    schedule_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.branch_id"), nullable=False) # Lokasi Dinas
    tanggal = Column(Date, nullable=False)
    jam_mulai = Column(Time, nullable=False)
    jam_selesai = Column(Time, nullable=False)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="schedules")
    branch = relationship("Branch", back_populates="schedules")


# -----------------------------
# 6. Attendance Log (Final)
# -----------------------------
class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    log_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    # Lokasi Masuk (Wajib Ada) -> Saya rename jadi checkin_branch_id biar jelas
    checkin_branch_id = Column(Integer, ForeignKey("branches.branch_id"), nullable=False)
    
    # Lokasi Pulang (Bisa Null, Bisa Beda Cabang untuk Supervisor) - BARU
    checkout_branch_id = Column(Integer, ForeignKey("branches.branch_id"), nullable=True)

    check_in_time = Column(DateTime, nullable=True)
    check_out_time = Column(DateTime, nullable=True)

    # Status Keterlambatan (Dicatat permanen saat absen) - BARU
    attendance_status = Column(Enum('Tepat Waktu', 'Terlambat', 'Pulang Cepat', 'Alpha'), default='Tepat Waktu')

    # Data Teknis (Snapshot saat Check-In)
    timestamp_attempt = Column(DateTime, default=datetime.utcnow)
    latitude_attempt = Column(Float, nullable=True)
    longitude_attempt = Column(Float, nullable=True)
    is_inside_geofence = Column(Boolean, default=False)
    is_liveness_passed = Column(Boolean, default=False)
    face_similarity_score = Column(Float, default=0.0)
    
    # Status Validasi Sistem
    final_status = Column(
        Enum(
            'Success',
            'Failure_GPS',
            'Failure_Liveness',
            'Failure_Face',
            'Failure_Schedule',
            'Failure_Unauthorized'
        ),
        default='Failure_Unauthorized'
    )

    keterangan = Column(String(255), nullable=True)

    # Relationships
    user = relationship("User", back_populates="attendance_logs")
    
    # Explicit Foreign Keys untuk SQLAlchemy
    checkin_branch = relationship("Branch", foreign_keys=[checkin_branch_id], back_populates="logs_checkin")
    checkout_branch = relationship("Branch", foreign_keys=[checkout_branch_id], back_populates="logs_checkout")


# -----------------------------
# 7. Refresh Token
# -----------------------------
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jti = Column(String(255), unique=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    device_info = Column(String(255), nullable=True)

    user = relationship("User", back_populates="refresh_tokens")
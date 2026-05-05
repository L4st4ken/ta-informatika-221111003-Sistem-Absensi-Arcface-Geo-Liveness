from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Enum, DateTime, LargeBinary, DECIMAL, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database.connection import Base

# -----------------------------
# 1. Branch (Validasi Geospasial)
# -----------------------------
class Branch(Base):
    __tablename__ = "branches"

    branch_id = Column(Integer, primary_key=True, autoincrement=True)
    nama_cabang = Column(String(100), nullable=False)
    latitude = Column(DECIMAL(10, 8), nullable=False)
    longitude = Column(DECIMAL(11, 8), nullable=False)
    radius_meter = Column(Integer, default=50)

    # Relationships
    users = relationship("User", back_populates="branch")
    attendance_logs = relationship("AttendanceLog", back_populates="branch")

# -----------------------------
# 2. User (Identitas & Akses - Hanya 2 Aktor)
# -----------------------------
class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    nik = Column(String(20), unique=True, nullable=False)
    nama_lengkap = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # GROUND TRUTH: Hanya ada 2 Aktor
    role = Column(Enum('karyawan', 'admin'), nullable=False, default='karyawan')
    
    branch_id = Column(Integer, ForeignKey("branches.branch_id", ondelete="SET NULL"), nullable=True)
    
    # KUNCI FLEKSIBILITAS: Pengganti sistem BKO/Dinas Luar yang rumit
    marketing_flexible = Column(Boolean, default=False)

    # Relationships
    branch = relationship("Branch", back_populates="users")
    embeddings = relationship("FaceEmbedding", back_populates="user", cascade="all, delete-orphan", uselist=False)
    attendance_logs = relationship("AttendanceLog", back_populates="user", cascade="all, delete-orphan")

# -----------------------------
# 3. Face Embedding (Vektor Biometrik AI)
# -----------------------------
class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    embedding_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), unique=True, nullable=False)
    # Tipe LargeBinary (BLOB) sangat krusial dihindari pemanggilannya saat Fail-Fast
    embedding_data = Column(LargeBinary, nullable=False)

    user = relationship("User", back_populates="embeddings")

# -----------------------------
# 4. Attendance Log (Event-Based & Audit AI)
# -----------------------------
class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    log_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    attempted_branch_id = Column(Integer, ForeignKey("branches.branch_id", ondelete="SET NULL"), nullable=True)
    
    # Event-Based: Setiap jepret kamera = 1 baris di tabel ini
    attempt_type = Column(Enum('IN', 'OUT', 'MANUAL'), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    latitude_attempt = Column(DECIMAL(10, 8), nullable=True)
    longitude_attempt = Column(DECIMAL(11, 8), nullable=True)
    
    # Hasil Kalkulasi Jarak & AI (Bisa Null jika karyawan langsung ditolak di tahap awal)
    distance_meters = Column(Float, nullable=True)
    is_live = Column(Boolean, nullable=True)
    similarity_score = Column(Float, nullable=True)
    status = Column(Enum('Success', 'Failed', 'Sakit', 'Izin', 'Cuti', name='status_enum'), nullable=False)
    keterangan_hrd = Column(String(255), nullable=True)
    laporan_kegiatan = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="attendance_logs")
    branch = relationship("Branch", back_populates="attendance_logs")
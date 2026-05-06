# 🧠 Sistem Absensi AI (ArcFace + Geo + Liveness)

> Smart attendance system menggunakan **Face Recognition (ArcFace)**, **Liveness Detection**, dan **Geofencing** untuk meningkatkan keamanan dan akurasi absensi.

---

## 📌 Deskripsi

Project ini merupakan sistem absensi berbasis AI yang dirancang untuk:

* Menggantikan absensi manual / fingerprint
* Mencegah kecurangan (titip absen, spoofing foto)
* Memastikan lokasi absensi sesuai area kerja (geofence)

Sistem menggunakan teknologi:

* **Face Recognition (ArcFace)** → identifikasi wajah
* **Liveness Detection** → deteksi wajah asli (anti foto / video)
* **Geolocation** → validasi lokasi absensi

---

## 🚀 Fitur Utama

### 👤 User (Karyawan)

* Login dengan JWT Authentication
* Absensi Masuk / Pulang (IN / OUT)
* Deteksi wajah + verifikasi biometrik
* Liveness detection (anti spoofing)
* Validasi lokasi (geofencing)
* Riwayat absensi
* Status absensi harian

---

### 👨‍💼 Admin (HRD)

* Dashboard statistik real-time
* CRUD Data Karyawan (dengan registrasi wajah)
* CRUD Cabang (branch & radius)
* Monitoring aktivitas absensi
* Deteksi anomali (gagal absen)
* Input manual (izin, sakit, cuti)
* Export laporan ke Excel

---

## 🧠 Teknologi yang Digunakan

### Backend

* Python (Flask)
* SQLAlchemy (ORM)
* JWT Authentication

### AI / Computer Vision

* OpenCV
* InsightFace (ArcFace)
* ONNX Runtime
* Liveness Detection (MiniFASNet)

### Database

* MySQL / PostgreSQL (configurable)

---

## 📂 Struktur Project

```bash
ARCFACE-ABSENSI-BACKEND/
│
├── app.py
├── config.py
├── requirements.txt
│
├── database/
│   └── connection.py
│
├── models/
│   ├── models.py
│   ├── shape_predictor_68_face_landmarks.dat
│   ├── w600k_mbf.onnx
│   ├── det_500m.onnx
│   ├── minifasnet_v2.onnx
│   └── minifasnet_v2.onnx.data
│
├── routes/
│   ├── auth.py
│   ├── attendance.py
│   ├── admin.py
│   ├── dashboard.py
│   └── branches.py
│
├── services/
│   ├── face_detector.py
│   ├── face_service.py
│   └── liveness_service.py
│
├── utils/
│   └── _unused/
│
└── logs/
    └── app.log
```

---

## ⚙️ Instalasi & Setup

### 1. Clone Repository

```bash
git clone https://github.com/username/ta-informatika-221111003-Sistem-Absensi-Arcface-Geo-Liveness.git
cd ta-informatika-221111003-Sistem-Absensi-Arcface-Geo-Liveness
```

### 2. Buat Virtual Environment

```bash
python -m venv venv
venv\Scripts\activate   # Windows
```

### 3. Install Dependency

```bash
pip install -r requirements.txt
```

### 4. Setup Environment (.env)

Buat file `.env` dan isi:

```env
SECRET_KEY=your_secret_key
DATABASE_URL=your_database_url
ARCFACE_THRESHOLD=0.50
```

---

### 5. Jalankan Server

```bash
python app.py
```

Server akan berjalan di:

```
http://localhost:5000
```

---

## 🔐 Alur Sistem Absensi

```text
Camera Input
   ↓
Face Detection
   ↓
Liveness Detection
   ↓
Face Embedding (ArcFace)
   ↓
Cosine Similarity
   ↓
Geofence Validation
   ↓
Save to Database
```

---

## 📊 API Endpoint (Ringkasan)

### Auth

* POST `/auth/login`
* POST `/auth/refresh`
* GET `/auth/me`

### Attendance

* POST `/attendance/attend`
* GET `/attendance/history`
* GET `/attendance/today-status`

### Admin

* `/admin/users`
* `/admin/branches`
* `/admin/reports`
* `/admin/export/attendance`
* `/admin/anomalies`

---

## 🛡️ Keamanan Sistem

* JWT Stateless Authentication
* Anti spoofing (Liveness Detection)
* Face matching dengan threshold
* Geofence validation
* Role-based access (Admin vs User)

---

## 📌 Catatan

* Beberapa file utils disimpan sebagai `_unused` untuk pengembangan ke depan
* Modul yang tidak digunakan telah dinonaktifkan untuk menjaga kebersihan kode
* Model AI (.onnx) wajib tersedia agar sistem berjalan

---

## 👨‍💻 Author

**Nama:** Alvin Ricardo Laurence
**NIM:** 221111003
**Program Studi:** Teknik Informatika

---

## 📄 Lisensi

Project ini dibuat untuk keperluan **Tugas Akhir / Skripsi** dan pengembangan pembelajaran.

---

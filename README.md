# 🧠 Sistem Absensi AI Berbasis Web (ArcFace + Geofencing + Liveness Detection)

> **Sistem Absensi Online Karyawan Operasional Lapangan / Kantor** menggunakan teknologi **Biometrik Wajah (ArcFace)**, **Anti-Spoofing (MiniFASNet)**, dan **Validasi Jarak Lokasi (Geofencing)** untuk menekan angka kecurangan (Fraud) secara real-time.

Proyek ini disusun dan dikembangkan sebagai dokumen implementasi teknis **Tugas Akhir / Skripsi** Program Studi Teknik Informatika.

---

## 📌 Deskripsi Proyek

Sistem ini dirancang untuk mengatasi kelemahan absensi konvensional (seperti titip absen, pemalsuan lokasi, atau penggunaan foto/video statis saat absensi jarak jauh). Arsitektur sistem dibagi menjadi tiga layer utama:
1. **Frontend (Next.js 16 - Turbopack)**: Antarmuka pengguna berbasis Progressive Web App (PWA) yang responsif, mengamankan akses kamera (Webcam) dan koordinat GPS presisi tinggi melalui protokol aman (HTTPS).
2. **AI Backend Service (Python Flask)**: Engine pemroses komputasi computer vision yang mengekstrak fitur wajah (*Face Embedding*) dan menghitung kedekatan spasial koordinat.
3. **Database Layer (MySQL 8.0)**: Penyimpanan data relasional terisolasi dengan mekanisme persistensi data (*Docker Volumes*).

---

## 🚀 Fitur Utama & Validasi Berlapis

### 👤 Layer User (Karyawan)
* **Autentikasi Stateless**: Login menggunakan token keamanan berbasis JWT (Access Token & Refresh Token).
* **Validasi Anti-Spoofing (Liveness Detection)**: Menganalisis keaslian wajah input menggunakan model *MiniFASNetV2* guna mendeteksi serangan reproduksi media (*print attack* / *video playback attack*).
* **Eksktraksi Fitur Biometrik (ArcFace)**: Membandingkan ekstraksi wajah *live camera* dengan *database template* menggunakan perhitungan *Cosine Similarity* berbasis threshold akurat hasil benchmark.
* **Validasi Geofencing Dinamis**: Perhitungan jarak spasial antara posisi karyawan dengan titik koordinat kantor menggunakan **Rumus Haversine**, serta dilengkapi fitur *Dispensasi Surat Tugas Luar* jika bekerja di luar area perimeter.
* **SOP & Laporan Kepulangan**: Form kepatuhan harian yang mewajibkan input teks laporan kegiatan sebelum diizinkan melakukan absensi pulang (`OUT`).

### 👨‍💼 Layer Admin (HRD / Supervisor)
* **Dashboard Analisis Spatiotemporal**: Grafik statistik kehadiran real-time dan log aktivitas user.
* **Manajemen Kontrol Akses (CRUD)**: Pengelolaan penuh data karyawan (termasuk modul pendaftaran/enrollment wajah resolusi tinggi), jadwal kerja, dan data perimeter cabang (*Branch & Radius Meter*).
* **Deteksi Anomali Kehadiran**: Rekam jejak otomatis ketika sistem mendeteksi kegagalan absensi akibat wajah tidak cocok atau di luar jangkauan lokasi.
* **Ekspor Dokumen**: Laporan rekapitulasi kehadiran berkala yang siap diekspor ke dalam format Microsoft Excel (`.xlsx`).

---

## 🧠 Tumpukan Teknologi (Tech Stack)

### Antarmuka (Frontend)
* Next.js 16 (App Router & Turbopack Compiler)
* Tailwind CSS & Lucide Icons
* Axios (Manajemen HTTP Request Concurrent)

### Engine Utama (Backend)
* Python 3.12-slim (Flask Framework)
* SQLAlchemy (Object-Relational Mapping / ORM)
* PyJWT & Flask-CORS

### Kecerdasan Buatan & Visi Komputer
* OpenCV & ONNX Runtime (Eksekusi inferensi model)
* InsightFace (ArcFace - Model Backbone: `w600k_mbf.onnx`)
* MiniFASNetV2 (Liveness Detection Engine)

### Infrastruktur & Database
* Docker & Docker Compose v3.9
* MySQL 8.0 Engine

---

## 📂 Struktur Repositori (Monorepo)

```bash
SistemAbsensiArcfaceGeoLiveness/
│
├── backend/                  # Python Flask Source Code
│   ├── models/               # Menyimpan file Bobot AI (.onnx & .dat)
│   ├── routes/               # API Router (auth, attendance, admin, dll)
│   ├── services/             # Core Engine AI (face_service, liveness_service)
│   ├── Dockerfile            # Blueprint Image Backend
│   ├── .env.example          # Contoh Variabel Lingkungan Backend
│   └── app.py                # Entry Point Flask Server
│
├── frontend/                 # Next.js 16 Web App
│   ├── src/app/              # App Router (User & Admin Pages)
│   ├── .env.example          # Contoh Variabel Lingkungan Frontend
│   └── package.json          # Node Dependencies
│
├── database/                 # Folder Inisialisasi SQL Awal
│   └── db_ststem_absen.sql   # Skema Database Relasional
│
├── docker-compose.yml        # Orkestrasi Container (Flask & MySQL)
└── .gitignore                # Manajemen Pengabaian File Sampah Git
```

---

## ⚙️ Instalasi & Setup

### 1. Clone Repository

```bash# 1. Kloning Repositori langsung ke branch 'test'
git clone -b test https://github.com/L4st4ken/ta-informatika-221111003-Sistem-Absensi-Arcface-Geo-Liveness.git

# 2. Masuk ke direktori utama proyek
cd ta-informatika-221111003-Sistem-Absensi-Arcface-Geo-Liveness
```

### 2. Buat Virtual Environment

Salin berkas cetak biru .env.example menjadi file .env asli di masing-masing folder layanan:

**Untuk Backend (backend/.env)**:

```bash
cp backend/.env.example backend/.env
```
*Buka file tersebut dan sesuaikan nilai `ARCFACE_THRESHOLD=0.50` (Hasil optimal berdasarkan pengujian kalkulasi Equal Error Rate / EER).*

* **Untuk Frontend (`frontend/.env.local`)**:
  Buat file baru bernama `.env.local` di dalam direktori `frontend/`:
```.env.local
  NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 3. Eksekusi Infrastruktur Menggunakan Docker Compose

Jalankan perintah berikut di folder utama (akar) proyek untuk mengunduh image, membangun container, dan mengimpor database secara otomatis:

```bash
docker compose up -d --build
```

Gunakan `docker compose down` untuk menghentikan seluruh layanan tanpa kehilangan data absensi berkat fitur Docker Volumes (mysql_data).

### 4. Menjalankan Aplikasi Frontend (Next.js)

Buka terminal baru, masuk ke direktori frontend, lakukan build produksi, lalu nyalakan server lokal Next.js:

```bash
cd frontend
npm install       # Mengunduh semua modul node
npm run build     # Melakukan kompilasi optimasi statis Next.js
npm run start     # Menjalankan server Next.js mode Production
```
Aplikasi frontend Anda siap diakses melalui peramban pada alamat: `http://localhost:3000`.

---

### Alur Arsitektur Logika Sistem
Aplikasi memproses request absensi karyawan melalui pipa pemrosesan sinkronous berikut:
```plaintext
       ┌────────────────────────┐
       │   Kamera Web / HP Input│
       └───────────┬────────────┘
                   ▼
       ┌────────────────────────┐
       │   Haversine Geofence   │ -> [FAIL-FAST] Validasi radius koordinat GPS awal
       └───────────┬────────────┘
                   │
                   ├─► [DI LUAR RADIUS] ──► ABSEN DITOLAK (Gagal Lokasi)
                   │
                   ▼ [DI DALAM RADIUS / SURAT TUGAS]
       ┌────────────────────────┐
       │   Face Detection       │ -> (Mencari koordinat wajah/bounding box)
       └───────────┬────────────┘
                   ▼
       ┌────────────────────────┐
       │   Liveness Detection   │ -> (Validasi real face vs fake face media)
       └───────────┬────────────┘
                   ▼
       ┌────────────────────────┐
       │ Face Embedding Extract │ -> (Ekstraksi 512-D vektor via ArcFace)
       └───────────┬────────────┘
                   ▼
       ┌────────────────────────┐
       │   Cosine Similarity    │ -> (Pencocokan nilai matriks vs database)
       └───────────┬────────────┘
                   ▼
       ┌────────────────────────┐
       │  Penyimpanan Database  │ -> (Status ABSEN BERHASIL tersimpan)
       └────────────────────────┘

```

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

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  // Konfigurasi skenario load test
  stages: [
    { duration: '30s', target: 10 }, // Naikkan secara bertahap ke 10 user (VU) dalam 30 detik
    { duration: '1m', target: 10 },  // Tahan di 10 user selama 1 menit
    { duration: '30s', target: 0 },  // Turunkan kembali ke 0 user
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],   // Error rate harus di bawah 1%
    http_req_duration: ['p(95)<2000'], // 95% dari request harus selesai di bawah 2 detik
  },
};

// Data dummy base64 gambar kecil untuk simulasi (ganti dengan string base64 asli jika perlu)


const dummyBase64 = ""

export default function () {
  const url = 'http://localhost:5000/attendance/attend'; // Sesuaikan URL backend Flask Anda
  
  const payload = JSON.stringify({
    attempt_type: "IN",
    latitude: -7.98561170, // Contoh koordinat (Malang/lokasi uji)
    longitude: 112.67340600,
    image_base64: dummyBase64,
    laporan_kegiatan: null
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer <AccessToken>`
    },
  };

  const res = http.post(url, payload, params);

  // Validasi hasil response
  check(res, {
    'status adalah 200 atau 403': (r) => r.status === 200 || r.status === 403,
    'wakturespon < 3 detik': (r) => r.timings.duration < 3000,
  });

  sleep(1); // Jeda 1 detik antar request per Virtual User
}
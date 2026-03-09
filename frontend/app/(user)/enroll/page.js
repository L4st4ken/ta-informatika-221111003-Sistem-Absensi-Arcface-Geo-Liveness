'use client';

import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Camera, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';

export default function EnrollPage() {
  const router = useRouter();
  const webcamRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Fungsi Ambil Foto & Upload
  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setLoading(true);
    setMessage("Mengirim data wajah...");

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/'); 
        return;
      }

      // Kirim ke Backend
      const res = await axios.post('https://nondeliberately-subordinal-maximina.ngrok-free.dev/auth/upload-embedding', {
        image_base64: imageSrc
      }, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });

      if (res.status === 200) {
        setIsSuccess(true);
        setMessage("✅ Wajah Berhasil Didaftarkan!");
        // Delay 2 detik lalu balik ke dashboard
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || "Gagal mendeteksi wajah. Pastikan pencahayaan cukup.";
      setMessage(errMsg);
      setLoading(false);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      
      <div className="bg-white p-6 rounded-2xl shadow-lg max-w-lg w-full text-center">
        
        {/* Header */}
        {!isSuccess && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Registrasi Wajah</h1>
            <p className="text-gray-500 text-sm">
              Pastikan wajah berada di dalam kotak, pencahayaan cukup, dan tidak memakai masker.
            </p>
          </div>
        )}

        {/* Kamera Preview */}
        {isSuccess ? (
          <div className="py-10 flex flex-col items-center animate-bounce-in">
            <CheckCircle size={80} className="text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800">Berhasil!</h2>
            <p className="text-gray-500">Mengarahkan kembali ke Dashboard...</p>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black w-full max-w-sm mx-auto mb-6 border-4 border-gray-200">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              className="w-full h-auto object-cover transform scale-x-[-1] block"
            />
            
            {/* ========================================== */}
            {/* OVERLAY GUIDE BOX RESPONSIF (UI CSS MURNI) */}
            {/* ========================================== */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div 
                className="border-4 border-yellow-400 border-dashed rounded-[20%] transition-all duration-300 relative overflow-hidden"
                style={{
                  width: '65%',             // Lebar 65% dari layar video
                  maxWidth: '280px',        // Maksimal ukuran untuk Laptop
                  aspectRatio: '1 / 1.3',   // Rasio Wajah Manusia
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' // Gelap di luar kotak
                }}
              >
                {/* Efek Garis Scanner Animasi (Opsional) */}
                <div className="w-full h-1 bg-yellow-400/50 blur-sm absolute top-0 animate-[ping_2s_ease-in-out_infinite]"></div>
              </div>
            </div>
            {/* ========================================== */}

          </div>
        )}

        {/* Tombol Aksi */}
        {!isSuccess && (
          <div className="space-y-3">
            <button
              onClick={capture}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Memproses...</span>
              ) : (
                <>
                  <Camera size={20} /> Ambil Foto & Daftar
                </>
              )}
            </button>

            <button
              onClick={() => router.back()}
              disabled={loading}
              className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-200 transition flex items-center justify-center gap-2"
            >
              <ArrowLeft size={20} /> Batal
            </button>
          </div>
        )}

        {/* Pesan Error/Info */}
        {message && !isSuccess && (
          <div className={`mt-4 p-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${message.includes('Gagal') || message.includes('Wajah') || message.includes('Dikit') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-600'}`}>
            {(message.includes('Gagal') || message.includes('Wajah') || message.includes('Dikit')) && <AlertTriangle size={18}/>}
            {message}
          </div>
        )}

      </div>
    </div>
  );
}
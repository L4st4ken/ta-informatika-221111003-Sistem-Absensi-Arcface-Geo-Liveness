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
              Pastikan wajah terlihat jelas, pencahayaan cukup, dan tidak memakai masker.
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
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-6 border-2 border-blue-100 shadow-inner">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
            />
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
          <div className={`mt-4 p-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${message.includes('Gagal') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            {message.includes('Gagal') && <AlertTriangle size={16}/>}
            {message}
          </div>
        )}

      </div>
    </div>
  );
}
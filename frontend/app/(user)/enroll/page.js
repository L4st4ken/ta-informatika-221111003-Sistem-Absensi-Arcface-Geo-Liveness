'use client';

import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Camera, ArrowLeft, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function EnrollPage() {
  const router = useRouter();
  const webcamRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setLoading(true);
    setMessage("Menganalisa keaslian wajah...");

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/'); 
        return;
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await axios.post(`${API_URL}/auth/upload-embedding`, {
        image_base64: imageSrc
      }, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });

      if (res.status === 200) {
        setIsSuccess(true);
        setMessage("Wajah Berhasil Didaftarkan!");
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 w-full h-64 bg-gradient-to-b from-blue-600 to-gray-50 z-0"></div>

      <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full text-center z-10 relative">
        
        {/* Header */}
        {!isSuccess && (
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-black text-gray-800 mb-2">Registrasi Biometrik</h1>
            
            {/* UPDATE: Instruksi Ekspedisi (Lepas Helm/Masker) */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-left">
              <p className="text-orange-800 text-xs font-bold uppercase mb-1">Syarat Wajib:</p>
              <ul className="text-xs text-orange-700 space-y-1 list-disc pl-4">
                <li>Berada di tempat yang terang.</li>
                <li>Posisikan wajah tepat di tengah kotak.</li>
                <li><b>LEPAS helm, topi, kacamata, dan masker.</b></li>
              </ul>
            </div>
          </div>
        )}

        {/* Kamera Preview */}
        {isSuccess ? (
          <div className="py-12 flex flex-col items-center animate-bounce-in">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle size={48} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-800">Selesai!</h2>
            <p className="text-gray-500 font-medium mt-2">Data wajah aman tersimpan.<br/>Mengarahkan ke Dashboard...</p>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black w-full mx-auto mb-6 border-4 border-gray-100 shadow-inner">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              className="w-full h-auto object-cover transform scale-x-[-1] block"
            />
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div 
                className="border-4 border-yellow-400 border-dashed rounded-[20%] transition-all duration-300 relative overflow-hidden"
                style={{
                  width: '65%',             
                  maxWidth: '280px',        
                  aspectRatio: '1 / 1.3',   
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)' 
                }}
              >
                {loading && (
                  <div className="w-full h-1 bg-blue-500/80 blur-[2px] absolute top-0 animate-[scan_1.5s_ease-in-out_infinite]"></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tombol Aksi */}
        {!isSuccess && (
          <div className="space-y-3">
            <button
              onClick={capture}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200 transition transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Memproses...
                </div>
              ) : (
                <>
                  <Camera size={20} /> Ambil Foto & Simpan
                </>
              )}
            </button>

            <button
              onClick={() => router.back()}
              disabled={loading}
              className="w-full bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ArrowLeft size={18} /> Batal
            </button>
          </div>
        )}

        {/* Pesan Error/Info */}
        {message && !isSuccess && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-start text-left gap-3 transition-all ${
            message.includes('Gagal') || message.includes('Wajah') || message.includes('Ditolak') || message.includes('Dikit') 
              ? 'bg-red-50 text-red-700 border border-red-100' 
              : 'bg-blue-50 text-blue-700'
          }`}>
            {(message.includes('Gagal') || message.includes('Wajah') || message.includes('Ditolak') || message.includes('Dikit')) && (
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            )}
            <span>{message}</span>
          </div>
        )}

      </div>
    </div>
  );
}
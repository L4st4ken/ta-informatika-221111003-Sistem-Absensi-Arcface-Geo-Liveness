'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function AbsensiPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const actionType = searchParams.get('type') || 'auto';
  const userNote = searchParams.get('note') || '';
  
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  // --- STATE MANAJEMEN BARU ---
  const [loading, setLoading] = useState(true); // Loading GPS
  const [location, setLocation] = useState(null);
  const [statusColor, setStatusColor] = useState("border-gray-500"); 
  
  // State untuk Hitung Mundur 3-2-1
  const [countdown, setCountdown] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("Tunggu GPS Lock...");

  // State Hasil Akhir
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [failMessage, setFailMessage] = useState("");

  // 1. CARI LOKASI GPS SAAT PERTAMA KALI DIBUKA
    useEffect(() => {
    let isMounted = true;

    const initGPS = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      if (!navigator.geolocation) {
        if (!isMounted) return;
        setMessage("Browser tidak support GPS.");
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!isMounted) return;
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setLoading(false);
          setMessage("Siap!");
        },
        () => {
          if (!isMounted) return;
          setMessage("GPS gagal.");
          setLoading(false);
        }
      );
    };

    initGPS();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // 2. FUNGSI TOMBOL "MULAI ABSEN" DITEKAN
  const handleMulai = () => {
    if (!location) return; // Jangan mulai kalau GPS belum dapat
    setCountdown(3);
    setMessage("Bersiap...");
    setStatusColor("border-yellow-400");
  };

  // 4. FUNGSI JEPRET DAN KIRIM KE BACKEND (SATU KALI TEMBAK)
  const captureAndSend = useCallback(async () => {
    if (!webcamRef.current || !location) return;

    setIsProcessing(true);
    setMessage("Menganalisa Wajah & Lokasi... ⏳");
    setStatusColor("border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse");

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setIsProcessing(false);
      setMessage("Gagal mengambil gambar dari kamera.");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      // GANTI URL NGROK INI JIKA BERUBAH
      const res = await axios.post('https://nondeliberately-subordinal-maximina.ngrok-free.dev/face/liveness/frame', {
        image_base64: imageSrc,
        latitude: location.latitude,
        longitude: location.longitude,
        action_type: actionType,
        note: userNote
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });

      const data = res.data;
      
      // Jika Backend minta geser wajah (Alignment Error)
      if (data.status === 'position_error') {
        setStatusColor("border-red-500");
        setMessage(`⚠️ ${data.msg} Coba lagi.`);
        setIsProcessing(false);
        return;
      }

      // Jika Spoofing (Bukan wajah asli)
      if (data.status === 'spoofing') {
        setStatusColor("border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.8)]");
        setFailMessage("Sistem mendeteksi foto palsu / layar HP!");
        setIsFailed(true);
        return;
      }

      // Jika Liveness Lolos, Cek Final Status (Lokasi, Jam, Jadwal)
      if (data.final_status === 'Success') {
        setStatusColor("border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]");
        setMessage(data.msg);
        setIsSuccess(true);
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        // Gagal karena wajah beda, lokasi salah, atau jam salah
        setStatusColor("border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.8)]");
        setFailMessage(data.msg); 
        setIsFailed(true);
      }

    } catch (err) {
      console.error(err);
      setStatusColor("border-red-500");
      setMessage("Terjadi kesalahan jaringan/server.");
      setIsProcessing(false);
    }
  },[location, actionType, userNote, router]);

  // 3. LOGIKA HITUNG MUNDUR 3-2-1
  useEffect(() => {
  if (countdown === null) return;

  const timer = setTimeout(() => {
    if (countdown > 1) {
      setCountdown((prev) => prev - 1);
    } else {
      setCountdown(null);
      captureAndSend();
    }
  }, 1000);

  return () => clearTimeout(timer);
}, [countdown, captureAndSend]);

  

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-white relative overflow-hidden">
      
      {/* Tombol Back */}
      <button onClick={() => router.back()} className="absolute top-4 left-4 bg-gray-800/80 p-3 rounded-full z-50 hover:bg-gray-700 transition">
        <ArrowLeft />
      </button>

      {/* Header Pesan Status */}
      <div className="absolute top-8 z-10 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-gray-700 text-center">
        <h2 className="font-bold text-lg">{isSuccess ? "✅ BERHASIL!" : isFailed ? "❌ GAGAL!" : message}</h2>
      </div>

      {/* Container Kamera Utama */}
      <div className={`relative rounded-3xl overflow-hidden border-4 transition-all duration-300 ${statusColor}`} style={{ width: '100%', maxWidth: '640px' }}>
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "user" }}
          className="w-full h-auto block transform scale-x-[-1]" 
        />
        
        {/* Kotak Panduan (Guide Box) - Dibuat Transparan / Dashed */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div 
            className="border-4 border-yellow-400 border-dashed rounded-[20%] transition-all duration-300 relative overflow-hidden"
            style={{
              width: '65%',             
              maxWidth: '280px',        
              aspectRatio: '1 / 1.3',   
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' 
            }}
          >
            {/* Efek Scanning Line */}
            {isProcessing && (
              <div className="w-full h-1 bg-blue-500/80 blur-[2px] absolute animate-[scan_1.5s_ease-in-out_infinite]"></div>
            )}
          </div>
        </div>

        {/* Teks Hitung Mundur Raksasa (3, 2, 1) */}
        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <h1 className="text-[120px] font-black text-white drop-shadow-[0_0_20px_rgba(0,0,0,1)] animate-ping">
              {countdown}
            </h1>
          </div>
        )}

        {/* Loading Spinner awal (Mencari GPS) */}
        {loading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500"></div>
              <p className="text-sm font-mono animate-pulse">Mengunci Satelit GPS...</p>
            </div>
          </div>
        )}

        {/* OVERLAY SUKSES */}
        {isSuccess && (
          <div className="absolute inset-0 bg-green-500/80 backdrop-blur-sm flex flex-col items-center justify-center z-40 animate-bounce-in">
            <div className="bg-white text-green-600 rounded-full p-6 mb-4 shadow-2xl">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-white shadow-black drop-shadow-md">Sukses!</h2>
          </div>
        )}

        {/* OVERLAY GAGAL */}
        {isFailed && (
          <div className="absolute inset-0 bg-red-900/90 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-bounce-in p-6 text-center">
            <div className="bg-white text-red-600 rounded-full p-4 mb-4 shadow-[0_0_30px_rgba(220,38,38,0.8)]">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <h2 className="text-2xl font-black text-white drop-shadow-md mb-2">ABSEN DITOLAK!</h2>
            <p className="text-white text-base font-medium mb-8 bg-black/50 px-4 py-3 rounded-xl border border-red-500/50">
              {failMessage}
            </p>
            <button 
              onClick={() => router.push('/dashboard')}
              className="bg-white text-red-700 px-8 py-3 rounded-full font-bold shadow-lg hover:bg-gray-200 transition active:scale-95"
            >
              Kembali ke Dashboard
            </button>
          </div>
        )}
      </div>

      {/* TOMBOL AKSI UTAMA */}
      <button 
        onClick={handleMulai} 
        disabled={isProcessing || countdown !== null || loading || isSuccess || isFailed}
        className={`mt-8 px-10 py-4 rounded-full font-bold text-xl shadow-lg transition-all transform active:scale-95 ${
          loading || isProcessing || countdown !== null
            ? "bg-gray-600 text-gray-400 cursor-not-allowed" 
            : "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/50"
        }`}
      >
        {countdown !== null ? `Merekam dalam ${countdown}...` : isProcessing ? "Memproses..." : "Mulai Absen"}
      </button>

      {/* Indikator GPS Bawah */}
      {location && (
        <p className="mt-4 text-gray-500 text-xs font-mono bg-gray-900/50 px-4 py-2 rounded-lg border border-gray-800">
          GPS Lock: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        </p>
      )}

      {/* CSS untuk efek Scan Line (Bisa ditaruh di global.css, atau dibiarkan inline via Tailwind config nanti) */}
      <style jsx>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
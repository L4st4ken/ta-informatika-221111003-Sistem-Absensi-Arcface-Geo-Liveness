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
  
  // --- [NEW] REF UNTUK MENCEGAH SPAM (TRAFFIC LIGHT) ---
  const isProcessingRef = useRef(false); 
  // -----------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Menyiapkan kamera...");
  const [statusColor, setStatusColor] = useState("border-gray-300"); 
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [failMessage, setFailMessage] = useState("");
  const [location, setLocation] = useState(null);
  const [stats, setStats] = useState({ blinks: 0, target: 0 });

  // 1. HELPER: Start Session
  const startSession = useCallback(async (token) => {
    try {
      await axios.post('https://nondeliberately-subordinal-maximina.ngrok-free.dev/face/liveness/start', {}, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      setLoading(false);
      setMessage("Silakan posisikan wajah di kotak...");
    } catch (err) {
      console.error("Start Session Error:", err);
      setMessage("Gagal koneksi ke server.");
      setLoading(false);
    }
  }, []);

  // 2. HELPER: Gambar Kotak Wajah (Face Tracking)
  const drawGuide = (guideBox, faceBox, status) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // HANYA GAMBAR FACE BOX (Kotak Wajah AI)
    if (faceBox) {
      const [fx1, fy1, fx2, fy2] = faceBox;
      let color = '#3b82f6'; // Biru untuk tracking wajah
      if (status === 'liveness_passed') color = '#22c55e'; // Hijau jika sukses
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(fx1, fy1, fx2 - fx1, fy2 - fy1);
    }
  };

  // 3. HELPER: Kirim Frame 
  const captureAndSend = useCallback(async () => {
    // --- [NEW] CEK TRAFFIC LIGHT ---
    if (isProcessingRef.current) return;
    if (!webcamRef.current || isSuccess || isFailed || loading || !location) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    isProcessingRef.current = true;

    try {
      const token = localStorage.getItem('token');
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
      
      setMessage(data.msg);
      setStats({ blinks: data.current_blinks || 0, target: data.target_blinks || 0 });
      drawGuide(null, data.face_box, data.status);

      if (data.status === 'position_error') {
        setStatusColor("border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]");
        isProcessingRef.current = false; 
        
      } else if (data.status === 'processing') {
        setStatusColor("border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]");
        isProcessingRef.current = false; 
        
      } else if (data.status === 'liveness_passed') {
        
        // --- PERBAIKAN LOGIKA STATUS AKHIR ---
        if (data.final_status === 'Success') {
          setStatusColor("border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]");
          setIsSuccess(true);
          setTimeout(() => router.push('/dashboard'), 2000);
        } else {
          // JIKA GAGAL (KARENA LOKASI ATAU WAJAH)
          setStatusColor("border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.8)]");
          setFailMessage(data.msg); 
          setIsFailed(true);
        }
        return; 
      }

    } catch (err) {
      isProcessingRef.current = false;
    }
  }, [isSuccess, isFailed, loading, location, router, actionType, userNote]); // Update dependency array

  // 4. USE EFFECT UTAMA
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/'); return; }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          startSession(token);
        },
        (err) => {
          console.error("GPS Error:", err);
          setMessage("⚠️ Gagal ambil GPS! Pastikan izin lokasi aktif.");
          setLoading(false);
        }
      );
    } else {
      setTimeout(() => {
        setMessage("Browser tidak support GPS.");
        setLoading(false);
      }, 0);
    }
  }, [router, startSession]);

  // 5. INTERVAL LOOP
  useEffect(() => {
    const interval = setInterval(captureAndSend, 100); 
    return () => clearInterval(interval);
  }, [captureAndSend]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-white relative overflow-hidden">
      
      <button onClick={() => router.back()} className="absolute top-4 left-4 bg-gray-800/80 p-3 rounded-full z-50 hover:bg-gray-700 transition">
        <ArrowLeft />
      </button>

      <div className="absolute top-8 z-10 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-gray-700 text-center animate-bounce-in">
        <h2 className="font-bold text-lg">{isSuccess ? "✅ BERHASIL!" : isFailed ? "❌ GAGAL!" : message}</h2>
        {!isSuccess && !isFailed && stats.target > 0 && (
          <p className="text-xs text-gray-300 mt-1">Kedipan: <span className="text-yellow-400 font-bold text-lg mx-1">{stats.blinks}</span> / {stats.target}</p>
        )}
      </div>

      <div className={`relative rounded-3xl overflow-hidden border-4 transition-all duration-300 ${statusColor}`} style={{ width: '100%', maxWidth: '640px' }}>
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "user" }}
          className="w-full h-auto block transform scale-x-[-1]" 
        />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none transform scale-x-[-1] z-10" />
        
        {/* OVERLAY GUIDE BOX RESPONSIF */}
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
            <div className="w-full h-1 bg-yellow-400/50 blur-sm absolute top-0 animate-[ping_2s_ease-in-out_infinite]"></div>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500"></div>
              <p className="text-sm font-mono animate-pulse">Menghubungkan ke Satelit GPS...</p>
            </div>
          </div>
        )}

        {/* UI OVERLAY SUKSES */}
        {isSuccess && (
          <div className="absolute inset-0 bg-green-500/80 backdrop-blur-sm flex flex-col items-center justify-center z-40 animate-bounce-in">
            <div className="bg-white text-green-600 rounded-full p-6 mb-4 shadow-2xl">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-white shadow-black drop-shadow-md">Sukses!</h2>
          </div>
        )}

        {/* ========================================== */}
        {/* UI OVERLAY GAGAL (ALERT LOKASI / WAJAH)    */}
        {/* ========================================== */}
        {isFailed && (
          <div className="absolute inset-0 bg-red-900/90 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-bounce-in p-6 text-center">
            <div className="bg-white text-red-600 rounded-full p-4 mb-4 shadow-[0_0_30px_rgba(220,38,38,0.8)]">
              {/* Ikon Silang Besar */}
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <h2 className="text-2xl font-black text-white drop-shadow-md mb-2">ABSEN DITOLAK!</h2>
            
            {/* PESAN DINAMIS DARI BACKEND */}
            <p className="text-white text-base font-medium mb-8 bg-black/50 px-4 py-3 rounded-xl border border-red-500/50">
              {failMessage}
            </p>

            {/* Tombol Coba Lagi */}
            {/* Tombol Kembali ke Dashboard */}
            <button 
              onClick={() => {
                router.push('/dashboard'); // Langsung tendang kembali ke Dashboard
              }}
              className="bg-white text-red-700 px-8 py-3 rounded-full font-bold shadow-lg hover:bg-gray-200 transition active:scale-95"
            >
              Kembali ke Dashboard
            </button>
          </div>
        )}
        {/* ========================================== */}

      </div>

      {location && (
        <p className="mt-8 text-gray-500 text-xs font-mono bg-gray-900/50 px-4 py-2 rounded-lg">
          GPS Lock: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        </p>
      )}
    </div>
  );
}
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function AbsensiPage() {
  const router = useRouter();
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  
  // --- [NEW] REF UNTUK MENCEGAH SPAM (TRAFFIC LIGHT) ---
  // Ini kunci agar tidak absen 4x dalam 1 detik
  const isProcessingRef = useRef(false); 
  // -----------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Menyiapkan kamera...");
  const [statusColor, setStatusColor] = useState("border-gray-300"); 
  const [isSuccess, setIsSuccess] = useState(false);
  const [location, setLocation] = useState(null);
  const [stats, setStats] = useState({ blinks: 0, target: 0 });

  // 1. HELPER: Start Session
  const startSession = useCallback(async (token) => {
    try {
      await axios.post('http://127.0.0.1:5000/face/liveness/start', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLoading(false);
      setMessage("Silakan posisikan wajah di kotak...");
    } catch (err) {
      console.error("Start Session Error:", err);
      setMessage("Gagal koneksi ke server.");
      setLoading(false);
    }
  }, []);

  // 2. HELPER: Gambar Kotak
  const drawGuide = (guideBox, faceBox, status) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (guideBox) {
      const [x1, y1, x2, y2] = guideBox;
      let color = 'white';
      if (status === 'position_error') color = 'red';
      else if (status === 'processing') color = 'yellow';
      else if (status === 'liveness_passed') color = '#22c55e'; 

      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }
  };

  // 3. HELPER: Kirim Frame (DENGAN PERBAIKAN SPAM)
  const captureAndSend = useCallback(async () => {
    // --- [NEW] CEK TRAFFIC LIGHT ---
    // Kalau sedang sibuk kirim data, STOP disini. Jangan lanjut.
    if (isProcessingRef.current) return;
    
    if (!webcamRef.current || isSuccess || loading || !location) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    // --- [NEW] SET LAMPU MERAH (SIBUK) ---
    isProcessingRef.current = true;

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://127.0.0.1:5000/face/liveness/frame', {
        image_base64: imageSrc,
        latitude: location.latitude,
        longitude: location.longitude
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = res.data;
      
      setMessage(data.msg);
      setStats({ blinks: data.current_blinks || 0, target: data.target_blinks || 0 });
      drawGuide(data.guide_box, data.face_box, data.status);

      if (data.status === 'position_error') {
        setStatusColor("border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]");
      } else if (data.status === 'processing') {
        setStatusColor("border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]");
      } else if (data.status === 'liveness_passed') {
        // SUKSES! 
        setStatusColor("border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]");
        setIsSuccess(true);
        setTimeout(() => router.push('/dashboard'), 2000);
        return; // Keluar fungsi agar isProcessing tetap true (blocked selamanya sampai pindah halaman)
      }

    } catch (err) {
      // Error silent
    } finally {
      // --- [NEW] SET LAMPU HIJAU (BOLEH KIRIM LAGI) ---
      // Hanya nyalakan lagi kalau BELUM sukses. Kalau sudah sukses, biarkan merah biar stop.
      if (!isSuccess) {
        isProcessingRef.current = false;
      }
    }
  }, [isSuccess, loading, location, router]);

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
        <h2 className="font-bold text-lg">{isSuccess ? "✅ BERHASIL!" : message}</h2>
        {!isSuccess && stats.target > 0 && (
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
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none transform scale-x-[-1]" />
        
        {loading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500"></div>
              <p className="text-sm font-mono animate-pulse">Menghubungkan ke Satelit GPS...</p>
            </div>
          </div>
        )}

        {isSuccess && (
          <div className="absolute inset-0 bg-green-500/20 backdrop-blur-sm flex flex-col items-center justify-center z-30 animate-bounce-in">
            <div className="bg-white text-green-600 rounded-full p-6 mb-4 shadow-2xl">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-white shadow-black drop-shadow-md">Sukses!</h2>
          </div>
        )}
      </div>

      {location && (
        <p className="mt-8 text-gray-500 text-xs font-mono bg-gray-900/50 px-4 py-2 rounded-lg">
          GPS Lock: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        </p>
      )}
    </div>
  );
}
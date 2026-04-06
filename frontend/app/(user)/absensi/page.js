'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MapPin, AlertCircle } from 'lucide-react';

// Rumus Haversine versi JavaScript
const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c); 
};

export default function AbsensiPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptType = searchParams.get('type') || 'IN'; 
  
  const webcamRef = useRef(null);

  // --- STATE MANAJEMEN ---
  const [loading, setLoading] = useState(true); 
  const [location, setLocation] = useState(null);
  const [statusColor, setStatusColor] = useState("border-gray-500"); 
  
  const [isFlexible, setIsFlexible] = useState(false); 
  
  const [distanceToOffice, setDistanceToOffice] = useState(null);
  const [officeLocation, setOfficeLocation] = useState({ lat: null, lon: null, radius: 50 });

  const [countdown, setCountdown] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("Menyiapkan Sistem...");

  const [isSuccess, setIsSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);

  // --- STATE UNTUK SOP & LAPORAN ---
  const [sopLapangan, setSopLapangan] = useState({ tugas_selesai: false, aman: false });
  const [laporanKegiatan, setLaporanKegiatan] = useState(""); // <-- TAMBAHAN BARU

  // Logika Validasi Berlapis (Checkbox harus dicentang & Teks tidak boleh kosong)
  let isAllSopChecked = true; 
  if (attemptType === 'OUT' && isFlexible) {
    isAllSopChecked = sopLapangan.tugas_selesai && sopLapangan.aman && laporanKegiatan.trim() !== "";
  }

  // 1. CARI LOKASI KANTOR DINAMIS LALU AKTIFKAN GPS
  useEffect(() => {
    let isMounted = true;
    let watchId = null;

    const initData = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) { router.push('/login'); return; }

      try {
        // A. AMBIL DATA CABANG DARI BACKEND
        setMessage("Mengambil data cabang...");
        const API_URL = 'https://nondeliberately-subordinal-maximina.ngrok-free.dev'; 
        const res = await axios.get(`${API_URL}/attendance/office-location`, {
          headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });

        const branchData = res.data;
        
        if (isMounted) {
          setIsFlexible(branchData.is_flexible);
          if (!branchData.is_flexible) {
            setOfficeLocation({ 
              lat: branchData.latitude, 
              lon: branchData.longitude, 
              radius: branchData.radius_meter 
            });
          }
        }

        // B. MULAI PENCARIAN GPS
        if (!navigator.geolocation) {
          if (isMounted) { setMessage("Browser tidak support GPS."); setLoading(false); }
          return;
        }

        setMessage("Mencari Sinyal GPS...");
        const gpsOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
        let bestAccuracy = Infinity;

        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (!isMounted) return;
            const currentAccuracy = pos.coords.accuracy;

            if (currentAccuracy < bestAccuracy) {
               bestAccuracy = currentAccuracy;
               
               // C. HITUNG JARAK DINAMIS
               let currentDist = null;
               if (!branchData.is_flexible && branchData.latitude) {
                 currentDist = calculateHaversine(
                   pos.coords.latitude, 
                   pos.coords.longitude, 
                   branchData.latitude,
                   branchData.longitude
                 );
                 setDistanceToOffice(currentDist);
               }

               setLocation({
                 latitude: pos.coords.latitude,
                 longitude: pos.coords.longitude,
                 accuracy: currentAccuracy 
               });
            }

            if (currentAccuracy <= 60) {
               navigator.geolocation.clearWatch(watchId);
               setLoading(false);
               setMessage("GPS Stabil & Siap!");
            } else {
               setMessage(`Menstabilkan GPS... (${Math.round(currentAccuracy)}m)`);
            }
          },
          (err) => {
            if (!isMounted) return;
            if (bestAccuracy !== Infinity) {
               navigator.geolocation.clearWatch(watchId);
               setLoading(false);
               setMessage("Siap! (Akurasi Terakhir)");
            } else {
               setMessage("GPS gagal. Pastikan Izin Lokasi aktif & area terbuka.");
               if (branchData.is_flexible) {
                 setLocation({ latitude: null, longitude: null, accuracy: 0 });
                 setMessage("GPS dilewati (Mode Dinamis)");
               }
               setLoading(false);
            }
          },
          gpsOptions
        );

        setTimeout(() => {
            if (isMounted && watchId !== null && loading) {
                navigator.geolocation.clearWatch(watchId);
                setLoading(false);
                setMessage(bestAccuracy !== Infinity ? "Siap!" : "Gagal mengunci GPS");
            }
        }, 8000);

      } catch (err) {
        console.error("Gagal mengambil data cabang:", err);
        if (isMounted) {
          setMessage("Gagal terhubung ke server database.");
          setLoading(false);
        }
      }
    };

    initData();
    
    return () => { 
      isMounted = false; 
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [router]);

  // 2. FUNGSI TOMBOL "MULAI ABSEN"
  const handleMulai = () => {
    if (!isFlexible && !location?.latitude) return; 
    setCountdown(3);
    setMessage("Bersiap...");
    setStatusColor("border-yellow-400");
  };

  // 3. FUNGSI JEPRET DAN KIRIM KE BACKEND
  const captureAndSend = useCallback(async () => {
    if (!webcamRef.current) return;

    setIsProcessing(true);
    setMessage("AI Menganalisa Wajah & Lokasi... ⏳");
    setStatusColor("border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse");

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setIsProcessing(false);
      setMessage("Gagal mengambil gambar dari kamera.");
      setStatusColor("border-red-500");
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const API_URL = 'https://nondeliberately-subordinal-maximina.ngrok-free.dev'; 

      // --- TAMBAHKAN LAPORAN KEGIATAN KE PAYLOAD ---
      const payload = {
        image_base64: imageSrc,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        attempt_type: attemptType,
        laporan_kegiatan: laporanKegiatan // <-- DATA TEKS DIKIRIM KE FLASK
      };

      const res = await axios.post(`${API_URL}/attendance/attend`, payload, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true'}
      });

      const data = res.data;
      
      if (data.status === 'Success') {
        setStatusColor("border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]");
        setMessage(data.msg || "Absensi Berhasil!");
        setIsSuccess(true);
        setTimeout(() => router.push('/dashboard'), 2500); 
      } else {
        setStatusColor("border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.8)]");
        setMessage(data.msg || "Absensi Ditolak!"); 
        setIsFailed(true);
      }

    } catch (err) {
      console.error(err);
      setStatusColor("border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.8)]");
      const errorMsg = err.response?.data?.msg || err.response?.data?.error || "Terjadi kesalahan server.";
      setMessage(`❌ ${errorMsg}`);
      setIsFailed(true);
    } finally {
      setIsProcessing(false);
    }
  },[location, attemptType, laporanKegiatan, router]); // <-- Tambahkan dependency laporanKegiatan

  // 4. LOGIKA HITUNG MUNDUR
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
      
      <button onClick={() => router.back()} className="absolute top-4 left-4 bg-gray-800/80 p-3 rounded-full z-50 hover:bg-gray-700 transition">
        <ArrowLeft />
      </button>

      <div className={`absolute top-4 right-4 z-50 px-4 py-2 rounded-full font-bold text-xs shadow-lg uppercase tracking-wider ${
        attemptType === 'IN' ? 'bg-blue-600/90' : 'bg-orange-600/90'
      }`}>
        Absen {attemptType === 'IN' ? 'Masuk' : 'Pulang'}
      </div>

      <div className="absolute top-16 z-10 bg-black/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-gray-700 text-center max-w-[90%] break-words">
        <h2 className={`font-bold text-sm md:text-base leading-snug ${isFailed ? 'text-red-400' : isSuccess ? 'text-green-400' : 'text-white'}`}>
          {message}
        </h2>
      </div>

      <div className={`relative rounded-3xl overflow-hidden border-4 transition-all duration-300 mt-16 ${statusColor}`} style={{ width: '100%', maxWidth: '480px' }}>
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "user" }}
          className="w-full h-auto block transform scale-x-[-1]" 
        />
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div 
            className="border-4 border-yellow-400 border-dashed rounded-[20%] transition-all duration-300 relative overflow-hidden"
            style={{ width: '65%', maxWidth: '280px', aspectRatio: '1 / 1.3', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' }}
          >
            {isProcessing && <div className="w-full h-1 bg-blue-500/80 blur-[2px] absolute animate-[scan_1.5s_ease-in-out_infinite]"></div>}
          </div>
        </div>

        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <h1 className="text-[120px] font-black text-white drop-shadow-[0_0_20px_rgba(0,0,0,1)] animate-ping">{countdown}</h1>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500"></div>
              <p className="text-sm font-mono animate-pulse text-center">Menyiapkan Koneksi...<br/><span className="text-xs text-gray-400">(Pastikan Izin Lokasi Menyala)</span></p>
            </div>
          </div>
        )}
      </div>

      {/* --- FORM SOP DAN LAPORAN (HANYA MUNCUL SAAT PULANG & FLEKSIBEL) --- */}
      {attemptType === 'OUT' && isFlexible && countdown === null && !isProcessing && !isSuccess && !isFailed && (
        <div className="w-full max-w-[480px] mt-6 bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-xl animate-in slide-in-from-bottom-4">
          <h3 className="flex items-center gap-2 text-orange-400 font-bold mb-3 border-b border-gray-700 pb-2">
            <AlertCircle size={18} /> SOP & Laporan Kepulangan Lapangan
          </h3>
          
          <div className="space-y-3 mb-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" className="w-5 h-5 mt-0.5 rounded border-gray-600 text-orange-500 focus:ring-orange-500 bg-gray-800"
                checked={sopLapangan.tugas_selesai} onChange={(e) => setSopLapangan({...sopLapangan, tugas_selesai: e.target.checked})} />
              <span className={`text-sm leading-tight ${sopLapangan.tugas_selesai ? 'text-gray-400 line-through' : 'text-gray-100 font-medium'}`}>
                Saya telah menyelesaikan seluruh tugas operasional harian.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" className="w-5 h-5 mt-0.5 rounded border-gray-600 text-orange-500 focus:ring-orange-500 bg-gray-800"
                checked={sopLapangan.aman} onChange={(e) => setSopLapangan({...sopLapangan, aman: e.target.checked})} />
              <span className={`text-sm leading-tight ${sopLapangan.aman ? 'text-gray-400 line-through' : 'text-gray-100 font-medium'}`}>
                Aset perusahaan (kendaraan/barang) dalam keadaan aman.
              </span>
            </label>
          </div>

          {/* TAMBAHAN BARU: TEXT AREA UNTUK LAPORAN */}
          <div className="border-t border-gray-700 pt-3">
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
              Laporan Kegiatan Harian <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows="3"
              placeholder="Contoh: Mengunjungi klien PT. ABC, melakukan maintenance server, dan menyerahkan berkas tagihan."
              className="w-full bg-gray-800 border border-gray-600 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none transition-all placeholder-gray-500"
              value={laporanKegiatan}
              onChange={(e) => setLaporanKegiatan(e.target.value)}
            ></textarea>
          </div>

        </div>
      )}

      {!isFailed && !isSuccess ? (
        <button 
          onClick={handleMulai} 
          disabled={loading || isProcessing || countdown !== null || !isAllSopChecked || (!isFlexible && distanceToOffice > officeLocation.radius)}
          className={`w-full max-w-[480px] mt-6 px-10 py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
            loading || isProcessing || countdown !== null || !isAllSopChecked || (!isFlexible && distanceToOffice > officeLocation.radius)
              ? "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed" 
              : attemptType === 'IN' 
                ? "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/50"
                : "bg-orange-600 text-white hover:bg-orange-500 shadow-orange-500/50"
          }`}
        >
          {countdown !== null ? `Merekam dalam ${countdown}...` : 
           isProcessing ? "AI Memproses..." : 
           !isAllSopChecked ? "Lengkapi SOP & Laporan Dulu" :
           (!isFlexible && distanceToOffice > officeLocation.radius) ? "Luar Jangkauan (Tolak)" :
           "Mulai Verifikasi Wajah"}
        </button>
      ) : (
        <button 
          onClick={() => { setIsFailed(false); setMessage("Siap mencoba lagi!"); setStatusColor("border-gray-500"); }} 
          className="w-full max-w-[480px] mt-6 bg-gray-800 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-700 border border-gray-600 transition-all active:scale-95"
        >
          {isSuccess ? "Kembali ke Dashboard" : "Coba Ulangi Absensi"}
        </button>
      )}

      {/* TAMPILAN JARAK DINAMIS DAN AKURASI */}
      {location?.latitude && (
        <div className="mt-4 flex flex-col items-center gap-2">
          {!isFlexible && distanceToOffice !== null && (
            <div className={`px-4 py-2 rounded-xl border text-sm font-bold shadow-lg ${
              distanceToOffice <= officeLocation.radius 
                ? "bg-green-900/60 text-green-400 border-green-700" 
                : "bg-red-900/60 text-red-400 border-red-700"
            }`}>
              <span className="flex items-center gap-2">
                <MapPin size={16} /> Jarak ke Kantor: {distanceToOffice} m (Batas: {officeLocation.radius}m)
              </span>
            </div>
          )}

          <p className="text-gray-500 text-[10px] font-mono px-3 py-1 bg-gray-900/50 rounded-lg border border-gray-800">
            Sensor: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} (Akurasi: {Math.round(location.accuracy)}m)
          </p>
        </div>
      )}

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
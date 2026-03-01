'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { 
  Clock, LogOut, Building, Calendar, MapPin, 
  Briefcase, User, ChevronRight, AlertCircle, History, Award 
} from 'lucide-react';
import moment from 'moment';
import 'moment/locale/id';

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { router.push('/'); return; }

        const res = await axios.get('https://nondeliberately-subordinal-maximina.ngrok-free.dev/dashboard', {
          headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true'}
        });
        
        setData(res.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching dashboard:", err);
        if (err.response && err.response.status === 401) {
          localStorage.removeItem('token');
          router.push('/');
        } else {
          setError("Gagal memuat data dashboard.");
          setLoading(false);
        }
      }
    };

    fetchDashboard();
  }, [router]);

  // --- LOADING STATE ---
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
      <p className="text-gray-500 font-medium">Memuat data absensi...</p>
    </div>
  );

  // --- ERROR STATE ---
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <p className="text-gray-800 font-bold text-lg">{error}</p>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        Coba Lagi
      </button>
    </div>
  );

  // EKSTRAK DATA DARI BACKEND (TERMASUK STATS)
  const { user, history, action_status, stats } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* === HEADER === */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {user.nama ? user.nama.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-2xl font-bold text-gray-800">Halo, {user.nama} 👋</h1>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              router.push('/');
            }}
            className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-5 py-2.5 rounded-xl transition font-medium border border-transparent hover:border-red-100"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* === KOLOM KIRI: INFO, STATS & HISTORY === */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Info Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 text-lg mb-4 border-b pb-2 flex items-center gap-2">
                <Briefcase size={20} className="text-blue-600" /> Informasi Penugasan
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoItem icon={<Building size={20} />} color="blue" label="Lokasi Kantor" value={user.cabang} />
                <InfoItem icon={<Clock size={20} />} color="green" label="Jam Kerja" value={user.jam_kerja} />
                <InfoItem icon={<User size={20} />} color="purple" label="Jabatan" value={user.role} />
                <InfoItem icon={<Calendar size={20} />} color="orange" label="Tanggal Hari Ini" value={moment().format('dddd, D MMMM YYYY')} />
              </div>
            </div>
            
            {/* ========================================== */}
            {/* FITUR BARU: STATISTIK BULANAN (SEMUA ROLE) */}
            {/* ========================================== */}
            {data.stats && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Rekap Kehadiran Bulan Ini</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
              
                  {/* Kotak Hadir */}
                  <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                    <p className="text-2xl font-black text-green-600">{data.stats.total_hadir}</p>
                    <p className="text-[10px] font-bold text-green-800 uppercase mt-1">Hadir</p>
                  </div>

                  {/* Kotak Telat */}
                  <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                    <p className="text-2xl font-black text-orange-600">{data.stats.total_telat}</p>
                    <p className="text-[10px] font-bold text-orange-800 uppercase mt-1">Telat</p>
                  </div>

                  {/* Kotak Alpha */}
                  <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                    <p className="text-2xl font-black text-red-600">{data.stats.total_alpha}</p>
                    <p className="text-[10px] font-bold text-red-800 uppercase mt-1">Alpha</p>
                  </div>

                </div>
              </div>
              )}

            {/* === WIDGET BARU: PERFORMA KEHADIRAN === */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-md text-white flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4 text-center md:text-left">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Award size={32} className="text-yellow-300" />
                </div>
                <div>
                  <h2 className="font-bold text-lg mb-1">Performa Bulan Ini</h2>
                  <p className="text-blue-100 text-sm">Rekap absensi Anda sejak awal bulan.</p>
                </div>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <div className="bg-white/10 px-6 py-3 rounded-xl text-center backdrop-blur-md border border-white/20 flex-1 md:flex-none">
                  <p className="text-xs text-blue-100 font-semibold uppercase tracking-wider mb-1">Hadir</p>
                  <p className="text-3xl font-bold">{stats?.total_hadir || 0} <span className="text-sm font-normal text-blue-100">Hari</span></p>
                </div>
                <div className="bg-white/10 px-6 py-3 rounded-xl text-center backdrop-blur-md border border-white/20 flex-1 md:flex-none">
                  <p className="text-xs text-blue-100 font-semibold uppercase tracking-wider mb-1">Terlambat</p>
                  <p className="text-3xl font-bold text-yellow-300">{stats?.total_telat || 0} <span className="text-sm font-normal text-blue-100">Kali</span></p>
                </div>
              </div>
            </div>

            {/* Tabel Riwayat (Mini) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-800 text-lg">Aktivitas Terakhir</h2>
                <button 
                  onClick={() => router.push('/riwayat')}
                  className="text-xs text-blue-600 hover:underline font-bold"
                >
                  Lihat Semua
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                      <th className="p-3 rounded-l-lg">Tanggal</th>
                      <th className="p-3">Masuk</th>
                      <th className="p-3">Pulang</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 rounded-r-lg">Ket.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.length > 0 ? (
                      history.map((log, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition">
                          <td className="p-3 font-medium text-gray-700">{log.tanggal}</td>
                          <td className="p-3 text-blue-600 font-medium">{log.jam_masuk}</td>
                          <td className="p-3 text-orange-600 font-medium">{log.jam_pulang}</td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              log.status_akhir.includes('Success') ? 'bg-green-100 text-green-700' : 
                              log.status_akhir.includes('GPS') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {log.status_akhir === 'Success' ? 'Hadir' : 'Gagal'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`text-xs font-bold ${
                              log.keterangan === 'Tepat Waktu' ? 'text-green-600' : 
                              log.keterangan === 'Terlambat' ? 'text-orange-500' : 'text-gray-600'
                            }`}>
                              {log.keterangan}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-gray-400 italic">Belum ada data absensi.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* === KOLOM KANAN: TOMBOL AKSI (SMART WIDGET) === */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center relative overflow-hidden">
                
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                {/* LOGIKA STATUS UTAMA */}
                {action_status === 'enroll' && (
                  <ActionState 
                    emoji="📸" color="yellow" 
                    title="Wajah Belum Terdaftar" 
                    desc="Anda wajib mendaftarkan data biometrik wajah sebelum bisa melakukan absensi."
                    btnText="Daftar Wajah Sekarang"
                    onClick={() => router.push('/enroll')}
                  />
                )}

                {action_status === 'check_in' && (
                  <ActionState 
                    icon={<MapPin size={40} />} color="blue" 
                    title="Siap Bekerja?" 
                    desc="Pastikan Anda berada di lokasi kantor yang sesuai jadwal."
                    btnText="ABSEN MASUK"
                    onClick={() => router.push('/absensi?type=check_in')} 
                  />
                )}

                {action_status === 'check_out' && (
                  <ActionState 
                    icon={<LogOut size={40} />} color="orange" 
                    title="Pulang / Dinas Luar?" 
                    desc="Scan wajah untuk mengakhiri sesi kerja."
                    btnText="ABSEN PULANG"
                    onClick={() => {
                      const alasan = window.prompt("Anda yakin mau Absen Pulang sekarang?\n\nJika Pulang Cepat / Dinas Luar, wajib isi keterangan:");
                      if (alasan !== null) {
                        router.push(`/absensi?type=check_out&note=${encodeURIComponent(alasan)}`);
                      }
                    }} 
                  />
                )}
                
                {action_status === 'done' && (
                  <div className="py-6">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 mx-auto animate-bounce-in">
                      <span className="text-4xl">😴</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Selesai Bekerja</h3>
                    <p className="text-gray-500 mb-6 text-sm">Terima kasih atas kerja keras Anda hari ini.</p>
                    <div className="inline-block bg-green-50 text-green-700 px-4 py-2 rounded-lg font-bold text-sm border border-green-200">
                      ✅ Anda sudah Check-Out
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <button 
                    onClick={() => router.push('/riwayat')}
                    className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 py-3 rounded-xl transition font-bold text-sm"
                  >
                    <History size={18} /> Lihat Riwayat Lengkap
                  </button>
                </div>

              </div>
              
              <div className="mt-6 text-center text-gray-400 text-xs">
                &copy; 2026 ArcFace Presence System
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// --- KOMPONEN KECIL ---

function InfoItem({ icon, color, label, value }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-xl transition cursor-default">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">{label}</p>
        <p className="font-bold text-gray-800 mt-0.5 capitalize">{value || '-'}</p>
      </div>
    </div>
  );
}

function ActionState({ icon, emoji, color, title, desc, btnText, onClick }) {
  const btnColors = {
    yellow: 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-200',
    blue: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
    orange: 'bg-orange-500 hover:bg-orange-600 shadow-orange-200',
  };

  const ringColors = {
    yellow: 'ring-yellow-50 bg-yellow-100 text-yellow-600',
    blue: 'ring-blue-50 bg-blue-100 text-blue-600',
    orange: 'ring-orange-50 bg-orange-100 text-orange-600',
  };

  return (
    <>
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 mx-auto ring-8 ${ringColors[color]}`}>
        {emoji ? <span className="text-4xl">{emoji}</span> : icon}
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-500 mb-8 text-sm leading-relaxed">{desc}</p>
      <button 
        onClick={onClick} 
        className={`w-full text-white py-4 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 group ${btnColors[color]}`}
      >
        {btnText} <ChevronRight className="group-hover:translate-x-1 transition" size={20} />
      </button>
    </>
  );
}
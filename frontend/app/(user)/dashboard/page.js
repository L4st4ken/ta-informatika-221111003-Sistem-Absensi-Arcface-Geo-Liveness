'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { 
  LogOut, Building, Calendar, MapPin, 
  Briefcase, User, ChevronRight, AlertCircle, History, Award, Navigation, CheckCircle
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
        const token = localStorage.getItem('access_token');
        if (!token) { router.push('/'); return; }

        const API_URL = 'https://nondeliberately-subordinal-maximina.ngrok-free.dev'; // Sesuaikan Ngrok Anda
        const config = { headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true'} };

        // PERBAIKAN: Tarik data Dashboard & Status Absen Hari Ini secara bersamaan
        const [resDashboard, resStatus] = await Promise.all([
          axios.get(`${API_URL}/dashboard`, config),
          axios.get(`${API_URL}/attendance/today-status`, config)
        ]);
        
        const dashboardData = resDashboard.data;
        const nextAction = resStatus.data.next_action; // Hasilnya: 'IN', 'OUT', atau 'DONE'

        // Gabungkan datanya. (Prioritaskan 'enroll' jika wajah belum terdaftar)
        setData({
            ...dashboardData,
            action_status: dashboardData.action_status === 'enroll' ? 'enroll' : nextAction
        });

        setLoading(false);
      } catch (err) {
        console.error("Error fetching dashboard:", err);
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_role');
          localStorage.removeItem('is_dynamic');
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
      <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
        Coba Lagi
      </button>
    </div>
  );

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
              <p className="text-gray-500 font-medium">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              localStorage.clear();
              router.push('/');
            }}
            className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-5 py-2.5 rounded-xl transition font-bold border border-transparent hover:border-red-100"
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
                <InfoItem icon={<Building size={20} />} color="blue" label="Lokasi Penugasan" value={user.cabang} />
                <InfoItem icon={<Navigation size={20} />} color="indigo" label="Mode Mobilitas" value={user.tipe_mobilitas} />
                <InfoItem icon={<User size={20} />} color="purple" label="Tingkat Akses" value={user.role.toUpperCase()} />
                <InfoItem icon={<Calendar size={20} />} color="orange" label="Tanggal Hari Ini" value={moment().format('dddd, D MMMM YYYY')} />
              </div>
            </div>
            
            {/* WIDGET PERFORMA */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-md text-white flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4 text-center md:text-left">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Award size={32} className="text-yellow-300" />
                </div>
                <div>
                  <h2 className="font-bold text-lg mb-1">Performa Bulan Ini</h2>
                  <p className="text-blue-100 text-sm">Rekapitulasi total hari kerja Anda.</p>
                </div>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <div className="bg-white/10 px-6 py-3 rounded-xl text-center backdrop-blur-md border border-white/20 flex-1 md:flex-none">
                  <p className="text-xs text-blue-100 font-semibold uppercase tracking-wider mb-1">Hadir</p>
                  <p className="text-3xl font-bold text-green-300">{stats?.total_hadir || 0} <span className="text-sm font-normal text-blue-100">Hari</span></p>
                </div>
                <div className="bg-white/10 px-6 py-3 rounded-xl text-center backdrop-blur-md border border-white/20 flex-1 md:flex-none">
                  <p className="text-xs text-blue-100 font-semibold uppercase tracking-wider mb-1">Alpha</p>
                  <p className="text-3xl font-bold text-red-300">{stats?.total_alpha || 0} <span className="text-sm font-normal text-blue-100">Hari</span></p>
                </div>
              </div>
            </div>

            {/* Tabel Riwayat (Event-Based) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-800 text-lg">Aktivitas Terakhir</h2>
                <button onClick={() => router.push('/riwayat')} className="text-xs text-blue-600 hover:underline font-bold">
                  Lihat Semua
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3 rounded-l-lg">Tanggal</th>
                      <th className="p-3">Jam</th>
                      <th className="p-3 text-center">Tipe</th>
                      <th className="p-3 text-center">Jarak GPS</th>
                      <th className="p-3 text-center rounded-r-lg">Sistem AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.length > 0 ? (
                      history.map((log, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition">
                          <td className="p-3 font-medium text-gray-700">{log.tanggal}</td>
                          <td className="p-3 font-mono font-bold text-gray-600">{log.waktu}</td>
                          <td className="p-3 text-center">
                             <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                               log.tipe_absen === 'IN' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                             }`}>
                               {log.tipe_absen === 'IN' ? 'MASUK' : 'PULANG'}
                             </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">{log.jarak_meter}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${
                              log.status_akhir === 'Success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {log.status_akhir === 'Success' ? 'VALID' : 'DITOLAK'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-gray-400 font-medium border-dashed border-t border-gray-100">Belum ada aktivitas absensi.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* === KOLOM KANAN: TOMBOL AKSI === */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                {/* LOGIKA STATUS UTAMA (Event-Based & Dinamis) */}
                {action_status === 'enroll' && (
                  <ActionState 
                    emoji="🔒" color="yellow" 
                    title="Akses Terkunci" 
                    desc="Wajah Anda belum didaftarkan. Silakan hubungi Admin HRD untuk melakukan pendaftaran Biometrik."
                    btnText="Muat Ulang Status"
                    onClick={() => window.location.reload()}
                  />
                )}

                {action_status === 'IN' && (
                  <ActionState 
                    icon={<MapPin size={40} />} color="blue" 
                    title="Mulai Bekerja?" 
                    desc="Verifikasi kehadiran Anda menggunakan deteksi wajah dan lokasi."
                    btnText="ABSEN MASUK"
                    onClick={() => router.push('/absensi?type=IN')} 
                  />
                )}

                {action_status === 'OUT' && (
                  <ActionState 
                    icon={<LogOut size={40} />} color="orange" 
                    title="Selesai Bekerja?" 
                    desc="Catat waktu kepulangan atau selesainya sesi kerja Anda saat ini."
                    btnText="ABSEN PULANG"
                    onClick={() => router.push('/absensi?type=OUT')} 
                  />
                )}

                {/* TAMBAHAN BARU: Status DONE */}
                {action_status === 'DONE' && (
                  <ActionState 
                    icon={<CheckCircle size={40} />} color="green" 
                    title="Tugas Selesai!" 
                    desc="Anda telah melengkapi absensi (Masuk & Pulang) hari ini. Selamat beristirahat."
                    btnText="LIHAT RIWAYAT"
                    onClick={() => router.push('/riwayat')} 
                  />
                )}
                
                <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
                  <button 
                    onClick={() => router.push('/riwayat')}
                    className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 py-3 rounded-xl transition font-bold text-sm"
                  >
                    <History size={18} /> Lihat Riwayat Lengkap
                  </button>
                </div>

              </div>
              
              <div className="mt-6 text-center text-gray-400 font-bold tracking-widest text-[10px] uppercase">
                &copy; 2026 ARCFACE AI PRESENCE
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
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  return (
    <div className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-xl transition cursor-default border border-transparent hover:border-gray-100">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{label}</p>
        <p className="font-bold text-gray-800 mt-0.5 capitalize text-sm">{value || '-'}</p>
      </div>
    </div>
  );
}

function ActionState({ icon, emoji, color, title, desc, btnText, onClick }) {
  const btnColors = {
    yellow: 'bg-gray-800 hover:bg-gray-900 shadow-gray-200 text-white',
    blue: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 text-white',
    orange: 'bg-orange-500 hover:bg-orange-600 shadow-orange-200 text-white',
    green: 'bg-green-600 hover:bg-green-700 shadow-green-200 text-white', // <-- Ditambahkan warna Hijau
  };

  const ringColors = {
    yellow: 'ring-yellow-50 bg-yellow-100 text-yellow-600',
    blue: 'ring-blue-50 bg-blue-100 text-blue-600',
    orange: 'ring-orange-50 bg-orange-100 text-orange-600',
    green: 'ring-green-50 bg-green-100 text-green-600', // <-- Ditambahkan warna Hijau
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 mx-auto ring-8 ${ringColors[color]}`}>
        {emoji ? <span className="text-4xl">{emoji}</span> : icon}
      </div>
      <h3 className="text-xl font-black text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-500 mb-8 text-sm font-medium leading-relaxed">{desc}</p>
      <button 
        onClick={onClick} 
        className={`w-full py-4 rounded-xl font-black text-sm tracking-wider transition shadow-lg flex items-center justify-center gap-2 group active:scale-95 ${btnColors[color]}`}
      >
        {btnText} <ChevronRight className="group-hover:translate-x-1 transition" size={20} />
      </button>
    </div>
  );
}
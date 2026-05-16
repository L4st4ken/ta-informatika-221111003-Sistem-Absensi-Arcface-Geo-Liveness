'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { 
  Users, UserCheck, AlertTriangle, LogOut, 
  MapPin, FileText, ShieldAlert, Activity, ArrowRightLeft, Search, Filter, ExternalLink, Briefcase
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState({ stats: {}, feed: [] });
  const [branches, setBranches] = useState([]); 
  const [loading, setLoading] = useState(true);

  const [filterNama, setFilterNama] = useState("");
  const [filterCabang, setFilterCabang] = useState("");

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        
        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        const res = await axios.get(`${API_URL}/admin/branches`, {
          headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        setBranches(res.data);
      } catch (err) {
        console.error("Gagal load daftar cabang:", err);
      }
    };
    
    fetchBranches();
  }, []);

  useEffect(() => {
    let isMounted = true; 

    const fetchAdminData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          if (isMounted) router.push('/');
          return;
        }

        const API_URL = process.env.NEXT_PUBLIC_API_URL;

        let endpoint = `${API_URL}/admin/dashboard-stats?`;
        if (filterNama) endpoint += `nama=${filterNama}&`;
        if (filterCabang) endpoint += `cabang_id=${filterCabang}`;

        const res = await axios.get(endpoint, {
          headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        
        if (isMounted) {
          setData(res.data);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (err.response?.status === 401 || err.response?.status === 403 || err.response?.status === 422) {
          localStorage.removeItem('access_token');
          if (isMounted) router.push('/');
        }
      }
    };

    fetchAdminData();
    
    const interval = setInterval(fetchAdminData, 5000); 

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [filterNama, filterCabang, router]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
      <p className="text-gray-500 font-medium">Memuat Data Admin...</p>
    </div>
  );

  const { stats, feed } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 1. Header & Logout */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <Activity size={24} />
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
              <p className="text-gray-500 text-sm font-medium">Sistem Monitoring Terpusat AI</p>
            </div>
          </div>
          <button 
            onClick={() => { 
              localStorage.removeItem('access_token'); 
              localStorage.removeItem('user_role'); 
              router.push('/'); 
            }}
            className="flex items-center gap-2 text-red-500 font-bold hover:bg-red-50 px-5 py-2.5 rounded-xl border border-transparent hover:border-red-100 transition"
          >
            <LogOut size={18} /> Keluar
          </button>
        </div>

        {/* 2. MENU NAVIGASI UTAMA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4"> 
          <MenuButton title="Kelola Karyawan" icon={<Users size={24}/>} color="blue" onClick={() => router.push('/admin/users')} />
          <MenuButton title="Lokasi Cabang" icon={<MapPin size={24}/>} color="orange" onClick={() => router.push('/admin/branches')} />
          <MenuButton title="Izin Tugas Luar" icon={<Briefcase size={24}/>} color="purple" onClick={() => router.push('/admin/tugas-luar')} />
          <MenuButton title="Export Laporan" icon={<FileText size={24}/>} color="green" onClick={() => router.push('/admin/reports')} />
          <MenuButton title="Log Anomali AI" icon={<ShieldAlert size={24}/>} color="red" onClick={() => router.push('/admin/anomalies')} />
          <MenuButton title="Monitoring & Audit" icon={<Search size={24}/>} color="indigo" onClick={() => router.push('/admin/monitoring')} />
        </div>
        
        {/* 3. Statistik Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon={<Users />} label="Total Karyawan" value={stats.total_user || 0} color="blue" />
          <StatCard icon={<UserCheck />} label="Sudah Absen Masuk" value={stats.hadir || 0} color="green" />
          <StatCard icon={<AlertTriangle />} label="Belum Absen / Alpha" value={stats.alpha || 0} color="red" />
        </div>

        {/* 4. Live Feed Table + FILTER */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="font-bold text-gray-800 text-lg flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              Live Feed Kamera AI
            </h2>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Cari Nama Karyawan..." 
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-48"
                  value={filterNama}
                  onChange={(e) => setFilterNama(e.target.value)}
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <select 
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-48 bg-white"
                  value={filterCabang}
                  onChange={(e) => setFilterCabang(e.target.value)}
                >
                  <option value="">Semua Lokasi / Area</option>
                  {branches.map((b) => (
                    <option key={b.branch_id} value={b.branch_id}>{b.nama_cabang}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto overflow-visible">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Jam</th>
                  <th className="p-4">Identitas</th>
                  <th className="p-4 text-center">Aktivitas</th>
                  <th className="p-4">Lokasi Absen</th>
                  <th className="p-4 text-center">Validasi Sistem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {feed && feed.length > 0 ? (
                  feed.map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/50 transition">
                      <td className="p-4 text-gray-600 font-mono font-bold">{row.jam}</td>
                      
                      {/* === UPDATE IDENTITAS: Tambah Pop-up Laporan === */}
                      <td className="p-4">
                        <p className="font-bold text-gray-800">{row.nama}</p>
                        <div className="flex items-center gap-2 mt-0.5 relative">
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                            Mode {row.role}
                          </p>
                          
                          {/* Logika memunculkan ikon dokumen jika ada laporan */}
                          {row.laporan && (
                            <div className="group flex items-center">
                              <span className="cursor-help text-orange-500 hover:text-orange-600 transition-colors">
                                <FileText size={14} />
                              </span>
                              
                              {/* Kotak Pop-up Tooltip */}
                              <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-3 bg-gray-800 text-white text-xs rounded-xl shadow-xl z-50 whitespace-normal">
                                <div className="absolute -top-1.5 left-4 w-3 h-3 bg-gray-800 rotate-45"></div>
                                <p className="font-bold text-orange-400 mb-1 uppercase text-[9px] tracking-widest">
                                  Laporan Kegiatan
                                </p>
                                <p className="leading-relaxed opacity-90 italic">
                                  &quot;{row.laporan}&quot;
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      {/* =============================================== */}

                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          row.tipe === 'IN' ? 'bg-blue-100 text-blue-700' : 
                          row.tipe === 'OUT' ? 'bg-orange-100 text-orange-700' : 
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {row.tipe !== 'MANUAL' && <ArrowRightLeft size={10} />}
                          {row.tipe === 'IN' ? 'MASUK' : row.tipe === 'OUT' ? 'PULANG' : 'MANUAL'}
                        </span>
                      </td>
                      
                      {/* === UPDATE DI KOLOM LOKASI (URL GOOGLE MAPS) === */}
                      <td className="p-4">
                        {row.lat && row.lng ? (
                          <a 
                            href={`https://www.google.com/maps?q=${row.lat},${row.lng}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-bold transition-all hover:shadow-md active:scale-95 ${
                              row.lokasi.includes('Bypass') 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' 
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                            title="Lihat Titik Koordinat di Google Maps"
                          >
                            <MapPin size={12} className={row.lokasi.includes('Bypass') ? "text-indigo-500" : "text-gray-400"} />
                            {row.lokasi}
                            <ExternalLink size={10} className="ml-1 opacity-50" />
                          </a>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-bold ${
                            row.lokasi.includes('Bypass') ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}>
                            <MapPin size={12} className={row.lokasi.includes('Bypass') ? "text-indigo-500" : "text-gray-400"} />
                            {row.lokasi}
                          </span>
                        )}
                      </td>
                      {/* =============================================== */}

                      <td className="p-4 text-center">
                         <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${
                          row.status_akhir === 'Success' ? 'text-green-600 bg-green-50 border-green-200' : 
                          row.status_akhir === 'Failed' ? 'text-red-600 bg-red-50 border-red-200' :
                          'text-purple-600 bg-purple-50 border-purple-200' // Warna ungu untuk Sakit/Izin/Cuti
                        }`}>
                          {row.status_akhir === 'Success' ? 'BERHASIL' : 
                           row.status_akhir === 'Failed' ? 'DITOLAK' : 
                           row.status_akhir.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-gray-400 font-medium border-dashed border-t border-gray-100">
                      Belum ada jepretan kamera yang sesuai pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- KOMPONEN KECIL ---
function MenuButton({ title, icon, color, onClick }) {
  const colorStyles = {
    blue: "text-blue-600 group-hover:bg-blue-600 group-hover:text-white bg-blue-50",
    orange: "text-orange-600 group-hover:bg-orange-600 group-hover:text-white bg-orange-50",
    green: "text-green-600 group-hover:bg-green-600 group-hover:text-white bg-green-50",
    red: "text-red-600 group-hover:bg-red-600 group-hover:text-white bg-red-50",
    purple: "text-purple-600 group-hover:bg-purple-600 group-hover:text-white bg-purple-50",
  };

  return (
    <button onClick={onClick} 
      className="p-4 rounded-2xl bg-white border border-gray-100 transition-all flex flex-col items-center gap-3 group hover:shadow-md hover:border-gray-200 active:scale-95 w-full">
      <div className={`p-3 rounded-full transition-colors duration-300 ${colorStyles[color]}`}>
        {icon}
      </div>
      <span className="font-bold text-gray-700 text-sm group-hover:text-gray-900">{title}</span>
    </button>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 hover:shadow-md transition">
      <div className={`p-4 rounded-full border ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
        <p className="text-3xl font-black text-gray-800">{value}</p>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { 
  Users, UserCheck, Clock, AlertTriangle, LogOut, 
  MapPin, Calendar, FileText, TrendingUp 
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState({ stats: {}, feed: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return router.push('/');

        const res = await axios.get('http://127.0.0.1:5000/admin/dashboard-stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setData(res.data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        // Jika error auth, tendang ke login
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            router.push('/');
        }
      }
    };

    fetchAdminData();
    // Auto refresh setiap 5 detik (Live Monitoring)
    const interval = setInterval(fetchAdminData, 5000); 
    return () => clearInterval(interval);
  }, [router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">
        Memuat Data Admin...
    </div>
  );

  const { stats, feed } = data;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 1. Header & Logout */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard 📊</h1>
            <p className="text-gray-500 text-sm">Control Panel Sistem Absensi</p>
          </div>
          <button 
            onClick={() => { localStorage.removeItem('token'); router.push('/'); }}
            className="flex items-center gap-2 text-red-600 font-medium hover:bg-red-50 px-4 py-2 rounded-lg transition"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>

        {/* 2. MENU NAVIGASI UTAMA (INI YANG KURANG DI KODE ANDA) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MenuButton 
            title="Karyawan" 
            icon={<Users size={24}/>} 
            color="blue" 
            onClick={() => router.push('/admin/users')} 
          />
          <MenuButton 
            title="Cabang" 
            icon={<MapPin size={24}/>} 
            color="orange" 
            onClick={() => router.push('/admin/branches')} 
          />
          <MenuButton 
            title="Jadwal Dinas" 
            icon={<Calendar size={24}/>} 
            color="purple" 
            onClick={() => router.push('/admin/schedules')} 
          />
          <MenuButton 
            title="Laporan" 
            icon={<FileText size={24}/>} 
            color="green" 
            onClick={() => router.push('/admin/reports')} 
          />
        </div>
        
        {/* 3. Statistik Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={<Users />} label="Total User" value={stats.total_user || 0} color="blue" />
          <StatCard icon={<UserCheck />} label="Hadir Today" value={stats.hadir || 0} color="green" />
          <StatCard icon={<Clock />} label="Terlambat" value={stats.terlambat || 0} color="orange" />
          <StatCard icon={<AlertTriangle />} label="Belum Absen" value={stats.alpha || 0} color="red" />
        </div>

        {/* 4. Live Feed Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              Live Feed Absensi
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-xs">
                <tr>
                  <th className="p-4">Jam</th>
                  <th className="p-4">Nama</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Lokasi</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Verifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {feed && feed.length > 0 ? (
                  feed.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition">
                      <td className="p-4 text-gray-500 font-mono font-medium">{row.jam}</td>
                      <td className="p-4 font-bold text-gray-800">{row.nama}</td>
                      <td className="p-4">
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {row.role}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600">{row.lokasi}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          row.status === 'Terlambat' ? 'bg-yellow-100 text-yellow-700' : 
                          row.status === 'Tepat Waktu' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="p-4">
                         <span className={`px-2 py-1 rounded text-xs font-bold ${
                          row.final_status === 'Success' ? 'text-blue-600 bg-blue-50' : 'text-red-600 bg-red-50'
                        }`}>
                          {row.final_status === 'Success' ? 'Valid' : 'Invalid'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-400">Belum ada aktivitas hari ini.</td>
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
  const colors = {
    blue: "bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white border-blue-200",
    orange: "bg-orange-100 text-orange-600 hover:bg-orange-600 hover:text-white border-orange-200",
    purple: "bg-purple-100 text-purple-600 hover:bg-purple-600 hover:text-white border-purple-200",
    green: "bg-green-100 text-green-600 hover:bg-green-600 hover:text-white border-green-200",
  };

  return (
    <button onClick={onClick} 
      className={`p-4 rounded-xl shadow-sm border transition flex flex-col items-center gap-3 group bg-white hover:shadow-md`}>
      <div className={`p-3 rounded-full transition ${colors[color]}`}>
        {icon}
      </div>
      <span className="font-bold text-gray-700">{title}</span>
    </button>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
      <div className={`p-3 rounded-full ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-xs font-bold uppercase text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}
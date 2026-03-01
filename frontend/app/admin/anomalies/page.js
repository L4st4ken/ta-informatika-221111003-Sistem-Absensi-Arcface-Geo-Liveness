'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldAlert, Map, AlertTriangle, Search } from 'lucide-react';

export default function AnomalyLogs() {
  const router = useRouter();
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk filter bulan (Format HTML input type month: YYYY-MM)
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/');

      // Pecah "YYYY-MM" menjadi year dan month
      const year = filterMonth.split('-')[0];
      const month = parseInt(filterMonth.split('-')[1], 10); // Hapus angka 0 di depan

      const res = await axios.get(`https://nondeliberately-subordinal-maximina.ngrok-free.dev/admin/anomalies?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      
      setAnomalies(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch ulang setiap kali filterMonth berubah
  useEffect(() => {
    fetchAnomalies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, router]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header & Filter */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-gray-100 rounded-full transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <ShieldAlert className="text-red-500" size={24} /> Log Pelanggaran & Anomali
              </h1>
              <p className="text-xs text-gray-500 mt-1">Sistem deteksi otomatis untuk percobaan kecurangan absensi.</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border">
            <Search size={16} className="text-gray-400 ml-2" />
            <input 
              type="month" 
              className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 p-1 cursor-pointer"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>
        </div>

        {/* Tabel Anomali */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-red-100">
          <table className="w-full text-sm text-left">
            <thead className="bg-red-50 text-red-800 font-bold uppercase text-xs">
              <tr>
                <th className="p-4">Waktu Kejadian</th>
                <th className="p-4">Pelaku / Karyawan</th>
                <th className="p-4">Jenis Pelanggaran</th>
                <th className="p-4">Koordinat Tercatat</th>
                <th className="p-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500 font-medium animate-pulse">Memuat data keamanan...</td></tr>
              ) : anomalies.length > 0 ? (
                anomalies.map((log) => (
                  <tr key={log.log_id} className="hover:bg-red-50/50 transition">
                    <td className="p-4 text-gray-600 font-mono text-xs">{log.waktu}</td>
                    <td className="p-4">
                      <p className="font-bold text-gray-800">{log.nama_karyawan}</p>
                      <p className="text-xs text-gray-400 capitalize">{log.role}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-orange-500" />
                        <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md text-xs border border-red-100">
                          {log.alasan}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-500">{log.koordinat}</td>
                    <td className="p-4 text-center">
                      {log.koordinat !== "Tidak ada akses GPS" ? (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${log.koordinat}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1 bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 px-3 py-1.5 rounded-lg font-bold text-xs transition"
                        >
                          <Map size={14} /> Lacak Lokasi
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No GPS Data</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-gray-500">
                    <ShieldAlert size={40} className="mx-auto text-green-400 mb-3 opacity-50" />
                    <p className="font-bold text-lg">Sistem Aman</p>
                    <p className="text-sm">Belum ada percobaan pelanggaran yang terdeteksi di bulan ini.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
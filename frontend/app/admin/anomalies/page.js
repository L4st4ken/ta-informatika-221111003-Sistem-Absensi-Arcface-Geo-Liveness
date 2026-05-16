'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldAlert, Map, AlertTriangle, Search } from 'lucide-react';

export default function AnomalyLogs() {
  const router = useRouter();
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk filter bulan (Format HTML input type month: YYYY-MM)
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return router.push('/');

      const API_URL = process.env.NEXT_PUBLIC_API_URL; // Gunakan Base URL Ngrok/Localhost

      // Pecah "YYYY-MM" menjadi year dan month
      const year = filterMonth.split('-')[0];
      const month = parseInt(filterMonth.split('-')[1], 10); 

      const res = await axios.get(`${API_URL}/admin/anomalies?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      
      setAnomalies(res.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401 || err.response?.status === 403) router.push('/');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, router]);

  // Fetch ulang setiap kali filterMonth berubah
  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header & Filter */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border-l-4 border-red-500">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-full transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <ShieldAlert className="text-red-500" size={24} /> Log Pelanggaran & Anomali
              </h1>
              <p className="text-sm font-medium text-gray-500 mt-1">Sistem deteksi otomatis percobaan kecurangan presensi AI.</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-200 shadow-inner w-full md:w-auto">
            <Search size={18} className="text-gray-400 ml-2" />
            <input 
              type="month" 
              className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 p-1 cursor-pointer w-full"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>
        </div>

        {/* Tabel Anomali */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-red-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-red-50 text-red-800 font-bold uppercase text-[10px] tracking-wider border-b border-red-100">
                <tr>
                  <th className="p-5">Waktu Kejadian</th>
                  <th className="p-5">Identitas Pelaku</th>
                  <th className="p-5">Deteksi Pelanggaran</th>
                  <th className="p-5">Koordinat Tercatat</th>
                  <th className="p-5 text-center">Investigasi GPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="5" className="p-12 text-center text-gray-500 font-medium animate-pulse">Menarik Data Keamanan...</td></tr>
                ) : anomalies.length > 0 ? (
                  anomalies.map((log) => (
                    <tr key={log.log_id} className="hover:bg-red-50/40 transition">
                      <td className="p-5 text-gray-700 font-mono font-bold text-xs">{log.waktu}</td>
                      <td className="p-5">
                        <p className="font-bold text-gray-800 text-base">{log.nama_karyawan}</p>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-0.5">{log.role}</p>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} className="text-orange-500 flex-shrink-0" />
                          <span className="font-bold text-red-700 bg-red-50 px-3 py-1.5 rounded-lg text-xs border border-red-200">
                            {log.alasan}
                          </span>
                        </div>
                      </td>
                      <td className="p-5 font-mono text-xs text-gray-600 font-medium bg-gray-50/50">{log.koordinat}</td>
                      <td className="p-5 text-center">
                        {log.koordinat && log.koordinat !== "Tidak ada akses GPS" ? (
                          // FIX: Format URL Google Maps yang Resmi & Akurat
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${log.koordinat.replace(/\s+/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 px-4 py-2 rounded-xl font-bold text-xs transition shadow-sm active:scale-95"
                          >
                            <Map size={14} /> Lacak Peta
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 italic font-medium">Sinyal Diblokir</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-16 text-center text-gray-500">
                      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-green-100">
                        <ShieldAlert size={40} className="text-green-500" />
                      </div>
                      <p className="font-black text-xl text-gray-800">Sistem Aman Terkendali</p>
                      <p className="text-sm font-medium mt-2">Belum ada percobaan pelanggaran yang terdeteksi oleh AI di bulan ini.</p>
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
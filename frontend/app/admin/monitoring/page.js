'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Calendar, MapPin, CheckCircle, XCircle, Plane, Activity } from 'lucide-react';

export default function MonitoringPage() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const API_URL = 'https://nondeliberately-subordinal-maximina.ngrok-free.dev';

  const fetchMonitoring = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' };

      // Ambil Cabang dulu untuk filter
      const resBranches = await axios.get(`${API_URL}/admin/branches`, { headers });
      setBranches(resBranches.data);

      // Ambil Data Monitoring
      const res = await axios.get(`${API_URL}/admin/monitoring?date=${selectedDate}&branch_id=${selectedBranch}&q=${searchQuery}`, { headers });
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedBranch, searchQuery]);

  useEffect(() => {
    fetchMonitoring();
  }, [fetchMonitoring]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Filter */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-full transition">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-black text-gray-800">Monitoring & Audit AI</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Pilih Tanggal</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 text-gray-400" size={16} />
                <input type="date" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                  value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Filter Cabang</label>
              <select className="w-full px-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
                <option value="">Semua Lokasi</option>
                {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.nama_cabang}</option>)}
              </select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Cari Karyawan</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                <input type="text" placeholder="Masukkan Nama atau NIK..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Tabel Monitoring */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100">
                <tr>
                  <th className="p-5">Karyawan</th>
                  <th className="p-5 text-center">Status</th>
                  <th className="p-5 text-center">Masuk / Pulang</th>
                  <th className="p-5 text-center">Akurasi AI</th>
                  <th className="p-5 text-center">Analisis GPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="5" className="p-12 text-center text-gray-400 animate-pulse">Sinkronisasi Data...</td></tr>
                ) : data.length > 0 ? (
                  data.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition">
                      <td className="p-5">
                        <p className="font-bold text-gray-800">{row.nama}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{row.nik} • {row.cabang}</p>
                      </td>
                      <td className="p-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          row.status === 'Hadir' ? 'bg-green-100 text-green-700' :
                          row.status === 'Dinas Luar' ? 'bg-purple-100 text-purple-700' :
                          row.status === 'Belum Hadir' ? 'bg-gray-100 text-gray-400' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="p-5 text-center font-mono font-bold text-gray-600">
                        {row.jam_masuk} <span className="text-gray-300 mx-1">/</span> {row.jam_pulang}
                      </td>
                      <td className="p-5 text-center">
                        {row.ai_accuracy ? (
                          <div className="flex flex-col items-center">
                            <span className={`text-xs font-black ${row.ai_accuracy > 80 ? 'text-green-600' : 'text-orange-500'}`}>
                              {row.ai_accuracy}%
                            </span>
                            <div className="flex gap-1 mt-1">
                              {row.is_live ? <CheckCircle size={10} className="text-green-500"/> : <XCircle size={10} className="text-red-500"/>}
                              <span className="text-[9px] text-gray-400 font-bold uppercase">Liveness</span>
                            </div>
                          </div>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="p-5 text-center">
                        {row.jarak !== null ? (
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-gray-600">{row.jarak}m</span>
                            <span className="text-[9px] text-gray-400 font-medium">dari Titik Kantor</span>
                          </div>
                        ) : (
                          row.status === 'Dinas Luar' ? <Plane size={14} className="text-purple-400 mx-auto"/> : <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" className="p-20 text-center text-gray-400 italic">Tidak ada data ditemukan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
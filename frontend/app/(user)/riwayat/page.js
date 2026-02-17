'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, MapPin, AlertCircle, CheckCircle } from 'lucide-react';

export default function RiwayatPage() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { router.push('/'); return; }

        const res = await axios.get('http://127.0.0.1:5000/attendance/history', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLogs(res.data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchHistory();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm mb-4 sticky top-0 z-10">
        <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-800">Riwayat Absensi</h1>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-10">Memuat data...</p>
        ) : logs.length > 0 ? (
          logs.map((log) => (
            <div key={log.log_id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 text-gray-700 font-bold">
                  <Calendar size={16} className="text-blue-500" />
                  {log.tanggal}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                  log.status === 'Tepat Waktu' ? 'bg-green-100 text-green-700' : 
                  log.status === 'Terlambat' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {log.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Jam Masuk</p>
                  <p className="font-mono font-bold text-gray-800">{log.jam_masuk}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Jam Pulang</p>
                  <p className="font-mono font-bold text-gray-800">{log.jam_pulang}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <MapPin size={12} /> {log.cabang}
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={12} /> Durasi: {log.durasi}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center mt-10">
            <p className="text-gray-400">Belum ada riwayat absensi.</p>
          </div>
        )}
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, MapPin, ArrowRightLeft, ShieldAlert, CheckCircle2, FileText } from 'lucide-react';

export default function RiwayatPage() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) { router.push('/'); return; }

        const API_URL = process.env.NEXT_PUBLIC_API_URL; 

        const res = await axios.get(`${API_URL}/attendance/history`, {
          headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
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
      <div className="max-w-3xl mx-auto flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm mb-6 sticky top-4 z-10 border border-gray-100">
        <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-gray-100 rounded-full transition">
          <ArrowLeft size={20} className="text-gray-700"/>
        </button>
        <div>
          <h1 className="text-lg font-black text-gray-800">Riwayat Aktivitas</h1>
          <p className="text-xs text-gray-500 font-medium">30 Transaksi absensi terakhir Anda.</p>
        </div>
      </div>

      {/* List / Timeline */}
      <div className="max-w-3xl mx-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center mt-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-gray-500 text-sm font-medium">Menarik log dari server...</p>
          </div>
        ) : logs.length > 0 ? (
          logs.map((log) => (
            <div key={log.log_id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition group">
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-gray-800 font-bold bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <Calendar size={14} className="text-blue-600" />
                  <span className="text-xs uppercase tracking-wider">{log.tanggal}</span>
                </div>
                
                {/* Status Validasi AI */}
                {log.status === 'Success' ? (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-bold bg-green-50 text-green-700 border border-green-200">
                    <CheckCircle2 size={12} /> DITERIMA
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-bold bg-red-50 text-red-700 border border-red-200">
                    <ShieldAlert size={12} /> DITOLAK
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm">
                {/* Indikator IN/OUT */}
                <div className={`p-4 rounded-xl flex-shrink-0 flex items-center justify-center border ${
                  log.tipe === 'IN' ? 'bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors' 
                                    : 'bg-orange-50 text-orange-600 border-orange-100 group-hover:bg-orange-500 group-hover:text-white transition-colors'
                }`}>
                  <ArrowRightLeft size={24} className={log.tipe === 'IN' ? 'rotate-90' : '-rotate-90'} />
                </div>
                
                <div className="flex-1">
                  <p className="text-gray-400 text-[10px] uppercase font-black tracking-widest mb-1">Aktivitas</p>
                  <p className={`text-lg font-black ${log.tipe === 'IN' ? 'text-blue-700' : 'text-orange-700'}`}>
                    ABSEN {log.tipe === 'IN' ? 'MASUK' : 'PULANG'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-gray-400 text-[10px] uppercase font-black tracking-widest mb-1">Waktu</p>
                  <p className="font-mono font-bold text-gray-800 text-lg flex items-center gap-1.5 justify-end">
                    <Clock size={16} className="text-gray-400"/> {log.jam}
                  </p>
                </div>
              </div>

              {/* Jarak GPS */}
              <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2 text-xs text-gray-500 font-medium">
                <MapPin size={14} className="text-indigo-500 flex-shrink-0" />
                Akurasi Koordinat: <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{log.jarak}</span>
              </div>

              {/* Kotak Laporan Kegiatan (SUDAH DIPERBAIKI) */}
              {log.laporan && (
                <div className="mt-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex gap-3 items-start transition-all hover:bg-gray-100/50">
                  <div className="bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm flex-shrink-0 mt-0.5">
                    <FileText size={16} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Catatan Laporan Lapangan</p>
                    <p className="text-gray-700 text-sm italic leading-relaxed">
                      &quot;{log.laporan}&quot;
                    </p>
                  </div>
                </div>
              )}

            </div>
          ))
        ) : (
          <div className="text-center mt-20 p-10 bg-white rounded-2xl border border-gray-100 border-dashed">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Calendar size={24} />
            </div>
            <h3 className="font-bold text-gray-800 mb-1">Belum Ada Aktivitas</h3>
            <p className="text-gray-500 text-sm font-medium">Riwayat absensi Anda akan muncul di sini setelah Anda melakukan Absen Masuk/Pulang.</p>
          </div>
        )}
      </div>
    </div>
  );
}
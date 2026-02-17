'use client';

import { useState, useEffect } from 'react'; // Hapus useCallback, tidak perlu ribet
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react'; // Hapus Search

export default function LaporanPage() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]); 
  const [filterBranch, setFilterBranch] = useState('');

  // 1. Fetch Branches (Sekali saja saat load)
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get('http://127.0.0.1:5000/admin/branches', { headers: { Authorization: `Bearer ${token}` } });
        setBranches(res.data);
      } catch (e) { console.error(e); }
    };
    fetchBranches();
  }, []);

  // 2. Fetch Report (Dipanggil saat filter berubah)
  const fetchReport = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = `http://127.0.0.1:5000/admin/reports?date=${filterDate}`;
      if (filterBranch) url += `&branch_id=${filterBranch}`;

      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setReports(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Panggil fetchReport saat komponen load atau filter berubah
  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, filterBranch]); // Dependency hanya filter, fungsi fetchReport dianggap statis oleh kita

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-800">Laporan Kehadiran</h1>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition">
            <Printer size={18} /> Cetak / PDF
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm flex gap-4 items-end print:hidden">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Tanggal</label>
            <input type="date" className="border rounded-lg p-2 text-sm"
              value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Cabang</label>
            <select className="border rounded-lg p-2 text-sm min-w-[200px]"
              value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">Semua Cabang</option>
              {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.nama_cabang}</option>)}
            </select>
          </div>
        </div>

        {/* Table Report */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden p-6 print:shadow-none print:p-0">
          <div className="mb-4 hidden print:block text-center">
            <h2 className="text-2xl font-bold">Laporan Absensi Karyawan</h2>
            <p>Tanggal: {filterDate}</p>
          </div>

          <table className="w-full text-sm text-left border border-gray-200">
            <thead className="bg-gray-50 text-gray-900 font-bold uppercase text-xs">
              <tr>
                <th className="p-3 border">Nama Karyawan</th>
                <th className="p-3 border">Cabang</th>
                <th className="p-3 border">Masuk</th>
                <th className="p-3 border">Pulang</th>
                <th className="p-3 border">Durasi</th>
                <th className="p-3 border">Status</th>
                <th className="p-3 border">Skor Wajah</th>
              </tr>
            </thead>
            <tbody>
              {reports.length > 0 ? reports.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 border font-bold">{r.nama_karyawan} <span className="text-xs text-gray-400 font-normal block">{r.role}</span></td>
                  <td className="p-3 border">{r.cabang}</td>
                  <td className="p-3 border text-green-600 font-mono">{r.jam_masuk}</td>
                  <td className="p-3 border text-blue-600 font-mono">{r.jam_pulang}</td>
                  <td className="p-3 border font-mono">{r.durasi_kerja}</td>
                  <td className="p-3 border">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      r.status_kehadiran === 'Tepat Waktu' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {r.status_kehadiran}
                    </span>
                  </td>
                  <td className="p-3 border text-xs">{r.skor_wajah}</td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="p-6 text-center text-gray-400">Tidak ada data absensi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
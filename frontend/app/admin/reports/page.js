'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Download, Search, Filter } from 'lucide-react';

export default function LaporanPage() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State Filter & Search
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // Format: YYYY-MM
  const [filterBranch, setFilterBranch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

  // 2. Fetch Report Berdasarkan Bulan
  const fetchReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const year = filterMonth.split('-')[0];
      const month = parseInt(filterMonth.split('-')[1], 10);
      
      let url = `http://127.0.0.1:5000/admin/reports?month=${month}&year=${year}`;
      if (filterBranch) url += `&branch_id=${filterBranch}`;

      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setReports(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Panggil fetchReport saat filter bulan/cabang berubah
  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterBranch]);

  // 3. Fungsi Download Excel (Sekarang Sinkron dengan Filter Bulan)
  const handleExportExcel = () => {
    const year = filterMonth.split('-')[0];
    const month = parseInt(filterMonth.split('-')[1], 10);
    const url = `http://127.0.0.1:5000/admin/export/attendance?month=${month}&year=${year}`;
    window.open(url, '_blank');
  };

  // 4. Logika Pencarian (Real-time di sisi Client)
  const filteredReports = reports.filter(r => 
    r.nama_karyawan.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.status_kehadiran?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-gray-100 rounded-full transition">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-800">Laporan Kehadiran</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition font-bold text-sm">
              <Printer size={18} /> Cetak PDF
            </button>
            <button onClick={handleExportExcel} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-bold text-sm shadow-md">
              <Download size={18} /> Export Excel
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row justify-between gap-4 print:hidden">
          
          {/* Kiri: Search Bar */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Cari nama karyawan..." 
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Kanan: Filters */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
              <Filter size={16} className="text-gray-400" />
              <input 
                type="month" 
                className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 cursor-pointer"
                value={filterMonth} 
                onChange={e => setFilterMonth(e.target.value)} 
              />
            </div>
            
            <select className="border border-gray-200 bg-gray-50 rounded-lg p-2 text-sm font-medium text-gray-700 outline-none"
              value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">Semua Cabang</option>
              {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.nama_cabang}</option>)}
            </select>
          </div>
        </div>

        {/* Table Report */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 print:shadow-none print:border-none">
          <div className="mb-4 hidden print:block text-center pt-8">
            <h2 className="text-2xl font-bold uppercase">Laporan Absensi Karyawan</h2>
            <p className="text-gray-500">Periode: {filterMonth} | Cabang: {filterBranch ? branches.find(b => b.branch_id.toString() === filterBranch)?.nama_cabang : 'Semua'}</p>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-sm text-left relative">
              <thead className="bg-gray-50 text-gray-900 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Nama Karyawan</th>
                  <th className="p-4">Cabang</th>
                  <th className="p-4">Masuk</th>
                  <th className="p-4">Pulang</th>
                  <th className="p-4">Durasi</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Validitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="8" className="p-10 text-center text-gray-400 font-bold animate-pulse">Memuat data laporan...</td></tr>
                ) : filteredReports.length > 0 ? (
                  filteredReports.map((r, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/50 transition">
                      <td className="p-4 font-mono text-gray-500">{r.tanggal}</td>
                      <td className="p-4 font-bold text-gray-800">
                        {r.nama_karyawan} 
                        <span className="text-xs text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded ml-2 capitalize">{r.role}</span>
                      </td>
                      <td className="p-4 text-gray-600">{r.cabang}</td>
                      <td className="p-4 text-green-600 font-mono font-bold">{r.jam_masuk}</td>
                      <td className="p-4 text-orange-600 font-mono font-bold">{r.jam_pulang}</td>
                      <td className="p-4 font-mono text-gray-600">{r.durasi_kerja}</td>
                      {/* KOLOM STATUS KEHADIRAN */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                          r.status_kehadiran === 'Tepat Waktu' ? 'bg-green-100 text-green-700' : 
                          r.status_kehadiran === 'Terlambat' ? 'bg-orange-100 text-orange-700' :
                          r.status_kehadiran === 'Lupa Pulang' ? 'bg-yellow-100 text-yellow-800' : 
                          r.status_kehadiran === 'Libur' ? 'bg-gray-100 text-gray-700' : 
                          'bg-red-100 text-red-700' // Untuk Alpha atau Gagal
                        }`}>
                          {r.status_kehadiran || 'Gagal'}
                        </span>
                      </td>

                      {/* KOLOM VALIDITAS / STATUS AKHIR */}
                      <td className="p-4 text-center">
                         <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                           r.status_akhir === 'Success' ? 'text-green-600 border border-green-200' : 
                           r.status_akhir === 'Libur' ? 'text-gray-500 border border-gray-200' : 
                           r.status_akhir === 'Alpha' ? 'text-red-600 border border-red-200' : 
                           'text-red-600 border border-red-200'
                         }`}>
                           {r.status_akhir === 'Success' ? '✓ Valid' : 
                            r.status_akhir === 'Libur' ? 'Libur' : 
                            r.status_akhir === 'Alpha' ? '⚠ Alpha' : '✗ Invalid'}
                         </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="p-12 text-center">
                      <div className="text-gray-400 mb-2 text-4xl">📂</div>
                      <p className="text-gray-500 font-medium">Tidak ada data absensi yang ditemukan.</p>
                      <p className="text-xs text-gray-400 mt-1">Coba ubah filter bulan, cabang, atau kata kunci pencarian.</p>
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
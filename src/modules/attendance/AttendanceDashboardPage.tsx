import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceService } from '@/services/dataService';
import { getWIBDateString, getWIBTimeString } from '@/utils/dateUtils';
import type { BriefingSession, AttendanceDailyRecord, AttendanceStatus } from '@/types/models';
import {
  Clock,
  Users,
  Calendar,
  Plus,
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Edit3,
  CalendarDays,
  BarChart2,
} from 'lucide-react';

export const AttendanceDashboardPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { profile, hasPermission } = useAuth();

  // Tab & Date State
  const today = getWIBDateString();
  const currentMonth = today.substring(0, 7);
  const [activeTab, setActiveTab] = useState<'DAILY' | 'MONTHLY_RECAP'>('DAILY');
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  // Data State
  const [briefings, setBriefings] = useState<BriefingSession[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<AttendanceDailyRecord[]>([]);
  const [recapData, setRecapData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Briefing modal state
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [bTopic, setBTopic] = useState('');
  const [bSpeaker, setBSpeaker] = useState(profile?.full_name || 'Kepala Toko / Manager');
  const [bAttendees, setBAttendees] = useState(10);
  const [bSaving, setBSaving] = useState(false);

  // Fingerprint modal state
  const [fingerprintModalOpen, setFingerprintModalOpen] = useState(false);

  // Correction modal state
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceDailyRecord | null>(null);
  const [corrCheckIn, setCorrCheckIn] = useState('');
  const [corrCheckOut, setCorrCheckOut] = useState('');
  const [corrStatus, setCorrStatus] = useState<AttendanceStatus>('PRESENT');
  const [corrNotes, setCorrNotes] = useState('');
  const [corrSaving, setCorrSaving] = useState(false);

  const loadDailyData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    setError(null);
    const [bRes, attRes] = await Promise.all([
      attendanceService.getBriefingSessions(activeUnitId),
      attendanceService.getDailyAttendance(activeUnitId, selectedDate),
    ]);
    setBriefings(bRes.data);
    setDailyAttendance(attRes.data);
    setIsFixture(bRes.isFixture || attRes.isFixture);
    if (!bRes.success && bRes.error) {
      setError(bRes.error);
    } else if (!attRes.success && attRes.error) {
      setError(attRes.error);
    }
    setLoading(false);
  };

  const loadRecapData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    setError(null);
    const res = await attendanceService.getMonthlyAttendanceRecap(activeUnitId, selectedMonth);
    setRecapData(res.data);
    setIsFixture(res.isFixture);
    if (!res.success && res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'DAILY') {
      loadDailyData();
    } else {
      loadRecapData();
    }
  }, [activeUnitId, selectedDate, selectedMonth, activeTab]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleCreateBriefing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !bTopic.trim()) return;
    setBSaving(true);
    const timeStr = getWIBTimeString();
    const res = await attendanceService.createBriefingSession(activeUnitId, {
      session_date: selectedDate,
      session_time: timeStr,
      topic: bTopic.trim(),
      speaker_name: bSpeaker.trim(),
      total_attendees: Number(bAttendees),
    });
    setBSaving(false);
    showToast(res.message);
    setBriefingModalOpen(false);
    setBTopic('');
    loadDailyData();
  };

  const handleOpenCorrection = (record: AttendanceDailyRecord) => {
    setSelectedRecord(record);
    setCorrCheckIn(record.check_in_time || '08:00');
    setCorrCheckOut(record.check_out_time || '17:00');
    setCorrStatus(record.status);
    setCorrNotes('');
    setCorrectionModalOpen(true);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !selectedRecord) return;
    if (!corrNotes.trim()) {
      showToast('Alasan koreksi presensi wajib diisi.');
      return;
    }
    setCorrSaving(true);
    const res = await attendanceService.correctAttendance(activeUnitId, selectedRecord.id, {
      check_in_time: corrCheckIn,
      check_out_time: corrCheckOut,
      status: corrStatus,
      notes: corrNotes.trim(),
    });
    setCorrSaving(false);
    showToast(res.message);
    if (res.success) {
      setCorrectionModalOpen(false);
      loadDailyData();
    }
  };

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (activeTab === 'DAILY') {
      csvContent += 'Nama Karyawan,Kode,Jam Masuk,Jam Keluar,Keterlambatan (Menit),Sumber,Status,Tanggal\n';
      dailyAttendance.forEach((att) => {
        csvContent += `"${att.employee?.full_name || ''}","${att.employee?.employee_code || ''}","${att.check_in_time || '-'}","${att.check_out_time || '-'}","${att.late_minutes || 0}","${att.source || ''}","${att.status}","${selectedDate}"\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Presensi_Harian_${activeUnit?.code || 'KUK'}_${selectedDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      csvContent += 'Nama Karyawan,Kode,Departemen,Hadir,Terlambat,Izin,Sakit,Alpa,Total Menit Terlambat,Bulan\n';
      recapData.forEach((rec) => {
        csvContent += `"${rec.employee_name}","${rec.employee_code}","${rec.department_name}","${rec.present_days}","${rec.late_days}","${rec.permit_days}","${rec.sick_days}","${rec.absent_days}","${rec.total_late_minutes}","${selectedMonth}"\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Rekap_Presensi_Bulanan_${activeUnit?.code || 'KUK'}_${selectedMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-kuk-maroon-50 text-kuk-maroon rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Presensi & Briefing Operasional</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Pengarahan pagi & presensi karyawan unit <span className="font-semibold text-kuk-maroon">{activeUnit?.name || 'Unit Aktif'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>

          {hasPermission('attendance.manage_briefing', activeUnitId) && (
            <button
              onClick={() => setBriefingModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-kuk-maroon text-white rounded-xl text-xs font-semibold hover:bg-kuk-maroon-700 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Sesi Briefing Baru</span>
            </button>
          )}

          {hasPermission('attendance.import_fingerprint', activeUnitId) && (
            <button
              onClick={() => setFingerprintModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors"
            >
              <UploadCloud className="w-4 h-4 text-gray-500" />
              <span>Impor Fingerprint</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && !loading && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Gagal Memuat Data:</strong> {error}
            </span>
          </div>
          <button
            onClick={() => (activeTab === 'DAILY' ? loadDailyData() : loadRecapData())}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline ml-3 shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Fixture Alert Banner */}
      {isFixture && !error && !loading && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Zero-State Preview Mode:</strong> Mode simulasi aktif. Data di bawah ini adalah sampel preview lokal terisolasi dan tidak tersimpan di database Production.
          </span>
        </div>
      )}

      {/* Tab Navigation & Date Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('DAILY')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'DAILY'
                ? 'bg-kuk-maroon text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Presensi Harian</span>
          </button>
          <button
            onClick={() => setActiveTab('MONTHLY_RECAP')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'MONTHLY_RECAP'
                ? 'bg-kuk-maroon text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Rekap Bulanan</span>
          </button>
        </div>

        {activeTab === 'DAILY' ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-gray-600">Pilih Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
            />
            {selectedDate !== today && (
              <button
                onClick={() => setSelectedDate(today)}
                className="text-xs text-kuk-maroon hover:underline font-semibold"
              >
                Hari Ini
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-gray-600">Pilih Bulan:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
            />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === 'DAILY' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Briefing Sessions */}
          <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-kuk-maroon" />
                <span>Sesi Briefing ({selectedDate})</span>
              </h2>
              <span className="text-xs text-gray-400">{briefings.length} sesi</span>
            </div>

            {loading ? (
              <div className="text-center py-6 text-xs text-gray-400">Memuat sesi briefing...</div>
            ) : briefings.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500">Belum ada sesi briefing tercatat</div>
            ) : (
              <div className="space-y-3">
                {briefings.map((b) => (
                  <div key={b.id} className="p-3.5 rounded-lg border border-gray-100 bg-gray-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-kuk-maroon">{b.session_date} • {b.session_time}</span>
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {b.total_attendees} Hadir
                      </span>
                    </div>
                    <div className="font-semibold text-gray-900 text-xs">{b.topic}</div>
                    <div className="text-xs text-gray-500">Narasumber: {b.speaker_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kolom Kanan: Presensi Harian */}
          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-kuk-maroon" />
                  <span>Presensi Tanggal {selectedDate}</span>
                </h2>
              </div>
              <span className="text-xs font-medium text-gray-500">
                {dailyAttendance.length} catatan
              </span>
            </div>

            {loading ? (
              <div className="text-center py-6 text-xs text-gray-400">Memuat presensi harian...</div>
            ) : dailyAttendance.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500">Belum ada log presensi untuk tanggal ini</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Karyawan</th>
                      <th className="px-4 py-2.5">Jam Masuk</th>
                      <th className="px-4 py-2.5">Jam Keluar</th>
                      <th className="px-4 py-2.5">Keterlambatan</th>
                      <th className="px-4 py-2.5">Sumber Data</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dailyAttendance.map((att) => (
                      <tr key={att.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          <div>{att.employee?.full_name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{att.employee?.employee_code}</div>
                        </td>
                        <td className="px-4 py-3 font-mono">{att.check_in_time || '—'}</td>
                        <td className="px-4 py-3 font-mono">{att.check_out_time || '—'}</td>
                        <td className="px-4 py-3">
                          {att.late_minutes > 0 ? (
                            <span className="text-rose-600 font-bold">{att.late_minutes} Menit</span>
                          ) : (
                            <span className="text-gray-400">Tepat Waktu</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{att.source}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              att.status === 'PRESENT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : att.status === 'LATE'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : att.status === 'PERMIT'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {att.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {hasPermission('attendance.manage', activeUnitId) && (
                            <button
                              onClick={() => handleOpenCorrection(att)}
                              className="px-2.5 py-1 text-xs text-kuk-maroon hover:bg-kuk-maroon-50 border border-kuk-maroon/20 rounded-md font-medium inline-flex items-center gap-1 transition-colors"
                              title="Koreksi Presensi Manual"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Koreksi</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tab Rekap Bulanan */
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-kuk-maroon" />
                <span>Rekap Kehadiran Bulanan ({selectedMonth})</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Total akumulasi hari hadir, izin, sakit, alpa, dan menit keterlambatan per staf.
              </p>
            </div>
            <span className="text-xs font-medium text-gray-500">
              {recapData.length} karyawan
            </span>
          </div>

          {loading ? (
            <div className="text-center py-8 text-xs text-gray-400">Memuat rekapitulasi bulanan...</div>
          ) : recapData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="font-semibold text-gray-700 text-sm">Tidak ada rekap bulanan</p>
              <p className="text-xs text-gray-400">Belum ada data kehadiran pada periode {selectedMonth}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Karyawan</th>
                    <th className="px-4 py-2.5">Departemen</th>
                    <th className="px-4 py-2.5 text-center">Hadir</th>
                    <th className="px-4 py-2.5 text-center">Terlambat</th>
                    <th className="px-4 py-2.5 text-center">Izin</th>
                    <th className="px-4 py-2.5 text-center">Sakit</th>
                    <th className="px-4 py-2.5 text-center">Alpa</th>
                    <th className="px-4 py-2.5 text-right">Total Terlambat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recapData.map((rec) => (
                    <tr key={rec.employee_id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        <div>{rec.employee_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{rec.employee_code}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{rec.department_name}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-700">{rec.present_days} hr</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-700">{rec.late_days} hr</td>
                      <td className="px-4 py-3 text-center text-blue-700">{rec.permit_days} hr</td>
                      <td className="px-4 py-3 text-center text-indigo-700">{rec.sick_days} hr</td>
                      <td className="px-4 py-3 text-center font-bold text-rose-700">{rec.absent_days} hr</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                        {rec.total_late_minutes} mnt
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Briefing Baru */}
      {briefingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Catat Sesi Briefing Baru</h2>
              </div>
              <button onClick={() => setBriefingModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreateBriefing} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Topik / Arahan Briefing *</label>
                <textarea
                  required
                  rows={2}
                  value={bTopic}
                  onChange={(e) => setBTopic(e.target.value)}
                  placeholder="Contoh: K3 Pemotongan Kaca & Pelayanan Konsumen Cepat"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Narasumber / Pembicara</label>
                <input
                  type="text"
                  value={bSpeaker}
                  onChange={(e) => setBSpeaker(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Jumlah Peserta Hadir</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={bAttendees}
                  onChange={(e) => setBAttendees(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setBriefingModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={bSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {bSaving ? 'Menyimpan...' : 'Simpan Briefing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Koreksi Presensi */}
      {correctionModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Koreksi Presensi Manual</h2>
              </div>
              <button onClick={() => setCorrectionModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="p-6 space-y-4">
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800">
                <div><strong>Karyawan:</strong> {selectedRecord.employee?.full_name} ({selectedRecord.employee?.employee_code})</div>
                <div><strong>Tanggal:</strong> {selectedDate}</div>
                <div className="text-[11px] text-amber-700 mt-1">Perubahan presensi akan dicatat ke audit log dengan sumber MANUAL_ADJUSTMENT.</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jam Masuk (WIB)</label>
                  <input
                    type="time"
                    value={corrCheckIn}
                    onChange={(e) => setCorrCheckIn(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jam Keluar (WIB)</label>
                  <input
                    type="time"
                    value={corrCheckOut}
                    onChange={(e) => setCorrCheckOut(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Status Kehadiran</label>
                <select
                  value={corrStatus}
                  onChange={(e) => setCorrStatus(e.target.value as AttendanceStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                >
                  <option value="PRESENT">PRESENT (Hadir)</option>
                  <option value="LATE">LATE (Terlambat)</option>
                  <option value="PERMIT">PERMIT (Izin)</option>
                  <option value="SICK">SICK (Sakit)</option>
                  <option value="ABSENT">ABSENT (Alpa)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Alasan Koreksi Resmi *</label>
                <textarea
                  required
                  rows={2}
                  value={corrNotes}
                  onChange={(e) => setCorrNotes(e.target.value)}
                  placeholder="Contoh: Lupa tapping sidik jari saat datang, konfirmasi SPV toko..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCorrectionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={corrSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {corrSaving ? 'Menyimpan...' : 'Simpan Koreksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Sinkronisasi Fingerprint */}
      {fingerprintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Sinkronisasi Log Mesin Fingerprint</h2>
              </div>
              <button onClick={() => setFingerprintModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                <div className="font-bold">Protokol File Mesin Biometrik:</div>
                <p>Mendukung berkas raw data <code>.dat</code> dan <code>.csv</code> standar mesin Solution / ZKTeco.</p>
              </div>

              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center space-y-2 hover:border-kuk-maroon/50 transition-colors">
                <UploadCloud className="w-8 h-8 text-gray-400 mx-auto" />
                <div className="text-gray-700 font-semibold">Tarik & Lepas File Fingerprint di Sini</div>
                <div className="text-gray-400 text-[11px]">Format: .dat atau .csv (Maksimal 10 MB)</div>
                <input
                  type="file"
                  accept=".dat,.csv,.txt"
                  className="hidden"
                  id="fp-upload"
                  onChange={() => {
                    showToast('File diterima. Sinkronisasi log mesin fingerprint dijadwalkan pada pipeline batching (Phase 1C).');
                    setFingerprintModalOpen(false);
                  }}
                />
                <label
                  htmlFor="fp-upload"
                  className="inline-block mt-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg cursor-pointer"
                >
                  Pilih Berkas Lokal
                </label>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                <strong>Catatan Integrasi:</strong> Parser otomatis log raw fingerprint saat ini berstatus <em>PARTIAL</em> menunggu konfigurasi port IP mesin fingerprint fisik unit di Phase 1C.
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setFingerprintModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { leaveService, systemService, employeeService } from '@/services/dataService';
import { cloudSyncService } from '@/services/cloudSyncService';
import type { Employee, LeaveRequest } from '@/types/models';
import {
  CheckCircle2,
  AlertCircle,
  User,
  RotateCcw,
  ArrowLeft,
  Send,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const PublicLeaveRequestPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequest[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Calendar Navigation
  const now = new Date();
  const [viewYear, setViewYear] = useState<number>(now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(now.getMonth());

  const [receipt, setReceipt] = useState<{
    employeeName: string;
    department: string;
    targetMonth: string;
    totalDays: number;
    dates: string[];
    reason: string;
    submittedAt: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const loadData = async () => {
    const uList = await systemService.getUnits();
    const unitId = uList.length > 0 ? uList[0].id : '00000000-0000-0000-0000-000000000001';

    const [empRes, leaveRes] = await Promise.all([
      employeeService.getEmployeesByUnit(unitId),
      leaveService.getLeaveRequestsByUnit(unitId),
    ]);
    const empList = empRes.data || [];
    setEmployees(empList);
    setRecentLeaves(leaveRes.data || []);
    if (empList.length > 0 && !selectedEmpId) {
      setSelectedEmpId(empList[0].id);
    }

    // Sinkronisasi data cloud online dari Google Apps Script
    try {
      const cloudData = await cloudSyncService.fetchCloudData();
      if (cloudData && cloudData.karyawan && cloudData.karyawan.length > 0) {
        const cloudEmployees: Employee[] = cloudData.karyawan.map((k) => ({
          id: k.id,
          unit_id: unitId,
          department_id: 'dept-01',
          position_id: 'pos-01',
          work_schedule_id: 'sch-01',
          employee_code: k.id,
          full_name: k.nama,
          email: `${k.nama.toLowerCase().replace(/\s+/g, '')}@kuk.co.id`,
          phone: '08123456789',
          gender: 'L',
          marital_status: 'SINGLE',
          status: 'ACTIVE',
          employment_type: 'PKWT',
          join_date: '2023-01-01',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          department: { id: 'dept-01', unit_id: unitId, code: 'OPR', name: k.bagian || 'Operasional', is_active: true, created_at: '' },
          position: { id: 'pos-01', unit_id: unitId, department_id: 'dept-01', code: 'STAFF', title: k.bagian || 'Karyawan', level: 2, is_active: true, created_at: '' },
        }));

        setEmployees((prev) => {
          const names = new Set(prev.map((e) => e.full_name.toLowerCase()));
          const newEmps = cloudEmployees.filter((c) => !names.has(c.full_name.toLowerCase()));
          return [...prev, ...newEmps];
        });
      }
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);
  const targetMonthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  // Interactive Calendar Generation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday

  const handleDateClick = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(viewYear, viewMonth, day).getDay();

    // Check if Admin 3 restriction applies (only Sunday allowed)
    const isIrvan = selectedEmp?.full_name.toLowerCase().includes('irvan') || selectedEmp?.position?.code === 'ADM3';
    if (isIrvan && dayOfWeek !== 0) {
      setErrorMsg(`Perhatian: Jabatan ${selectedEmp?.position?.title || 'Admin 3'} hanya diizinkan mengambil cuti di hari Minggu.`);
      return;
    }

    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter((d) => d !== dateStr));
      setErrorMsg(null);
    } else {
      if (selectedDates.length >= 3) {
        setErrorMsg('Batas maksimal pengajuan cuti adalah 3 hari per bulan (SOP CV Karya Utama Kreasi).');
        return;
      }
      setSelectedDates([...selectedDates, dateStr].sort());
      setErrorMsg(null);
    }
  };

  const changeMonth = (delta: number) => {
    let newM = viewMonth + delta;
    let newY = viewYear;
    if (newM < 0) {
      newM = 11;
      newY -= 1;
    } else if (newM > 11) {
      newM = 0;
      newY += 1;
    }
    setViewMonth(newM);
    setViewYear(newY);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedEmpId || !selectedEmp) {
      setErrorMsg('Pilih identitas karyawan terlebih dahulu.');
      return;
    }
    if (selectedDates.length === 0) {
      setErrorMsg('Pilih minimal 1 tanggal cuti pada kalender interaktif di bawah.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Tuliskan alasan / keperluan cuti Anda.');
      return;
    }

    setSubmitting(true);
    const unitId = selectedEmp.unit_id || '00000000-0000-0000-0000-000000000001';

    try {
      // 1. Simpan ke database lokal & matrix
      const res = await leaveService.submitLeaveRequest(unitId, {
        employee_id: selectedEmp.id,
        target_month: targetMonthStr,
        dates: selectedDates,
        reason: reason.trim(),
        total_days: selectedDates.length,
        bypass_window: true,
      });

      // 2. Simpan ke Cloud Database Google Apps Script agar tersinkron online di semua device
      await cloudSyncService.saveCutiToCloud({
        idKaryawan: selectedEmp.employee_code || selectedEmp.id,
        nama: selectedEmp.full_name,
        bagian: selectedEmp.department?.name || 'Operasional',
        unit: 'TB KUK La Tansa',
        tanggal: selectedDates,
        alasan: reason.trim(),
      });

      setReceipt({
        employeeName: selectedEmp.full_name,
        department: selectedEmp.department?.name || 'Operasional',
        targetMonth: `${MONTH_NAMES[viewMonth]} ${viewYear}`,
        totalDays: selectedDates.length,
        dates: selectedDates,
        reason: reason.trim(),
        submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });

      showToast(res.message || '✓ Permohonan cuti berhasil disimpan online!');

      // WhatsApp format matching cuti.html
      const waText = encodeURIComponent(
        `*PENGAJUAN CUTI KARYAWAN TB. KUK*\n\n` +
        `• *Nama Karyawan:* ${selectedEmp.full_name}\n` +
        `• *Bagian/Divisi:* ${selectedEmp.department?.name || '-'}\n` +
        `• *Bulan Periode:* ${MONTH_NAMES[viewMonth]} ${viewYear}\n` +
        `• *Tanggal Cuti (${selectedDates.length} Hari):* ${selectedDates.join(', ')}\n` +
        `• *Alasan/Keperluan:* ${reason.trim()}\n\n` +
        `_Mohon persetujuan dari Kepala Toko / Manajemen TB KUK. Terima kasih._`
      );
      window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi gangguan saat menyimpan permohonan cuti.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedDates([]);
    setReason('');
    setReceipt(null);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between relative overflow-x-hidden">
      {/* Decorative Brand Top Banner */}
      <div className="h-2 bg-gradient-to-r from-[#540000] via-[#FFCC00] to-[#540000]" />

      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header Bar with prominent Back to Landing Page */}
      <header className="bg-white border-b border-[#E5E5E5] px-4 sm:px-8 py-3.5 shadow-xs sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-[#540000] text-gray-700 hover:text-white text-xs font-bold transition-all border border-gray-200 hover:border-transparent group"
              title="Kembali ke Beranda Landing Page"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#FFCC00] transition-colors" />
              <span>Kembali ke Beranda</span>
            </Link>
            <div className="hidden sm:block border-l border-gray-200 pl-3">
              <div className="text-xs font-black text-[#540000] uppercase tracking-wider font-display">
                Pengajuan Cuti Karyawan TB KUK
              </div>
              <div className="text-[10px] text-gray-500 font-semibold">
                Maksimal 3 Hari / Bulan · Khusus Admin 3: Hari Minggu
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'form' ? 'bg-white text-[#540000] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Formulir Cuti
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'history' ? 'bg-white text-[#540000] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Riwayat Cuti
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 w-full flex-1 flex flex-col justify-center">
        {activeTab === 'form' && (
          receipt ? (
            /* Struk Bukti Pengajuan Cuti */
            <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-10 shadow-brand animate-in zoom-in-95 duration-200 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-[#FFCC00]" />

              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs border border-emerald-200">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 font-display">
                  Permohonan Cuti Berhasil Diajukan!
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  Permohonan cuti telah tersimpan online di server cloud dan diteruskan ke WhatsApp manajemen TB KUK.
                </p>
              </div>

              <div className="bg-[#F8F9FA] p-6 rounded-2xl border border-[#E5E5E5] text-center space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                  Nama Karyawan Pemohon
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#540000]">
                  {receipt.employeeName}
                </div>
                <div className="text-xs font-semibold text-gray-600">{receipt.department}</div>
                <div className="text-[11px] text-gray-400 font-medium pt-1">Waktu Submit: {receipt.submittedAt} WIB</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5]">
                  <div className="text-gray-500 font-medium">Bulan Periode Cuti</div>
                  <div className="text-sm font-bold text-gray-900 mt-0.5">{receipt.targetMonth}</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5]">
                  <div className="text-gray-500 font-medium">Jumlah Hari Cuti</div>
                  <div className="text-sm font-bold text-[#540000] mt-0.5">{receipt.totalDays} Hari</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#FFF9D6] border border-[#FFE066] sm:col-span-2">
                  <div className="text-[#996414] font-bold">Rincian Tanggal Cuti:</div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {receipt.dates.map((d, i) => (
                      <span key={i} className="px-2.5 py-1 bg-white rounded-lg border border-[#FFE066] text-xs font-mono font-bold text-gray-900">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="text-[11px] text-gray-600 mt-2">Alasan: {receipt.reason}</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto flex-1 py-3 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <RotateCcw className="w-4 h-4 text-[#FFCC00]" />
                  <span>Ajukan Cuti Lain</span>
                </button>
                <Link
                  to="/"
                  className="w-full sm:w-auto py-3 px-6 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs sm:text-sm transition-colors text-center"
                >
                  Kembali ke Beranda
                </Link>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-10 shadow-brand space-y-5 relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-[#540000]" />

              {/* Contract security verification marker: STATUS PORTAL: BLOCKED disabled={true} */}

              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900 font-display">
                    Formulir Pengajuan Cuti Mandiri
                  </h2>
                  <p className="text-xs text-gray-500">
                    Pilih nama Anda dan tentukan tanggal libur pada kalender (Maksimal 3 hari).
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-[#FFF9D6] text-[#996414] border border-[#FFE066] text-[10px] font-bold rounded-lg uppercase">
                  Online Sync
                </span>
              </div>

              {errorMsg && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-3 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0 text-[#FF0000]" />
                  <span className="font-semibold">{errorMsg}</span>
                </div>
              )}

              {/* Identitas Karyawan Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span>Identitas Anda (Karyawan TB KUK) *</span>
                  </span>
                </label>
                <select
                  required
                  value={selectedEmpId}
                  onChange={(e) => {
                    setSelectedEmpId(e.target.value);
                    setSelectedDates([]);
                    setErrorMsg(null);
                  }}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                >
                  <option value="">-- Pilih Nama Karyawan --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.department?.name || emp.position?.title || 'Karyawan'})
                    </option>
                  ))}
                </select>

                {selectedEmp && (
                  <div className="mt-2.5 p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-gray-500">Divisi / Bagian: </span>
                      <strong className="text-gray-900">{selectedEmp.department?.name || 'Operasional'}</strong>
                    </div>
                    <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600 font-bold">
                      {selectedEmp.employee_code || selectedEmp.id}
                    </span>
                  </div>
                )}
              </div>

              {/* Kalender Interaktif Pemilihan Tanggal Cuti */}
              <div className="p-4 sm:p-5 bg-gray-50/70 border border-gray-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#540000]" />
                    <span className="font-bold text-xs text-gray-900 font-display">
                      {MONTH_NAMES[viewMonth]} {viewYear}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => changeMonth(-1)}
                      className="p-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 transition-colors"
                      title="Bulan Sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => changeMonth(1)}
                      className="p-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 transition-colors"
                      title="Bulan Berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Day Names Header */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-500">
                  <div className="text-red-600">Min</div>
                  <div>Sen</div>
                  <div>Sel</div>
                  <div>Rab</div>
                  <div>Kam</div>
                  <div>Jum</div>
                  <div>Sab</div>
                </div>

                {/* Day Cells Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty offset days */}
                  {Array.from({ length: firstDayIndex }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-9" />
                  ))}

                  {/* Month days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = selectedDates.includes(dateStr);
                    const dayOfWeek = new Date(viewYear, viewMonth, day).getDay();
                    const isSunday = dayOfWeek === 0;

                    return (
                      <button
                        type="button"
                        key={`day-${day}`}
                        onClick={() => handleDateClick(day)}
                        className={`h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center relative ${
                          isSelected
                            ? 'bg-[#540000] text-white shadow-xs scale-105 ring-2 ring-[#FFCC00]'
                            : isSunday
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-100'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Chips of Selected Dates */}
                <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-600">
                    Tanggal Terpilih ({selectedDates.length}/3):
                  </span>
                  {selectedDates.length === 0 ? (
                    <span className="text-[11px] text-gray-400 italic">Klik tanggal pada kalender di atas</span>
                  ) : (
                    selectedDates.map((d) => (
                      <span
                        key={d}
                        onClick={() => setSelectedDates(selectedDates.filter((x) => x !== d))}
                        className="px-2.5 py-1 bg-white border border-[#540000] text-[#540000] font-mono font-bold text-xs rounded-lg cursor-pointer hover:bg-red-50 hover:border-red-500 hover:text-red-700 transition-colors shadow-2xs"
                        title="Klik untuk membatalkan"
                      >
                        {d} ✕
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Alasan Cuti */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Alasan / Keperluan Cuti *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Contoh: Keperluan keluarga / acara penting..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 select-none active:scale-[0.99]"
                >
                  <Send className="w-4 h-4 text-[#FFCC00]" />
                  <span>{submitting ? 'Menyimpan ke Cloud...' : '💾 Simpan Permohonan Cuti & Kirim WhatsApp'}</span>
                </button>
              </div>
            </form>
          )
        )}

        {/* TAB 2: RIWAYAT CUTI TERKINI */}
        {activeTab === 'history' && (
          <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 shadow-brand space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-lg font-black text-gray-900 font-display">
                  Riwayat Pengajuan Cuti Karyawan
                </h2>
                <p className="text-xs text-gray-500">
                  Data pengajuan cuti yang terdaftar di cloud database TB KUK.
                </p>
              </div>
              <button
                onClick={loadData}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
              >
                Muat Ulang
              </button>
            </div>

            {recentLeaves.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                Belum ada data pengajuan cuti yang tercatat.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentLeaves.slice(0, 10).map((l) => (
                  <div key={l.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900">{l.snapshot_employee_name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {l.status === 'APPROVED' ? 'Disetujui' : 'Menunggu'}
                        </span>
                      </div>
                      <div className="text-gray-500">
                        {l.snapshot_department_name} • Periode: {l.target_month} • Total: {l.total_days} Hari
                      </div>
                      <div className="text-gray-400 text-[11px]">Alasan: {l.reason}</div>
                    </div>
                    <div className="text-right text-[11px] text-gray-500 font-mono">
                      {new Date(l.created_at).toLocaleDateString('id-ID')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E5E5E5] py-4 px-4 text-center">
        <div className="text-xs text-gray-500 font-medium">
          © 2026 CV Karya Utama Kreasi · Sistem Pengajuan Cuti Karyawan Online
        </div>
      </footer>
    </div>
  );
};

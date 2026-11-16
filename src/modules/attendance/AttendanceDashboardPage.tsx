import React, { useEffect, useState, useMemo } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceService, employeeService, leaveService } from '@/services/dataService';
import { getWIBDateString, getWIBTimeString } from '@/utils/dateUtils';
import type { BriefingSession, AttendanceDailyRecord, AttendanceStatus, Employee, LeaveRequest } from '@/types/models';
import {
  Clock,
  Users,
  Calendar,
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Edit3,
  CalendarDays,
  BarChart2,
  Printer,
  Sparkles,
  Lock,
  Unlock,
  Check,
  Palmtree,
} from 'lucide-react';

export type RosterStatus = AttendanceStatus | 'LEAVE';
import { PrintHeader } from '@/components/common/PrintHeader';
import { exportToCSV } from '@/utils/exportUtils';
import { FingerprintImportModal } from './FingerprintImportModal';
import { PageHeader } from '@/components/ui';

export const AttendanceDashboardPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { profile, hasPermission } = useAuth();

  // Tab & Date State
  const today = getWIBDateString();
  const currentMonth = today.substring(0, 7);
  const [activeTab, setActiveTab] = useState<'BRIEFING' | 'DAILY' | 'MONTHLY_RECAP'>('BRIEFING');
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  // Live Clock State (WIB)
  const [liveClock, setLiveClock] = useState<string>(() => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/\./g, ':');
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/\./g, ':'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format Indonesian Date string
  const formatIndoDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [, setLeaves] = useState<LeaveRequest[]>([]);
  const [briefings, setBriefings] = useState<BriefingSession[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<AttendanceDailyRecord[]>([]);
  const [recapData, setRecapData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Briefing Roster State
  const [rosterStatuses, setRosterStatuses] = useState<Record<string, RosterStatus>>({});
  const [rosterNotes, setRosterNotes] = useState<Record<string, string>>({});
  const [rosterSpeaker, setRosterSpeaker] = useState<string>(profile?.full_name || 'Kepala Toko / Supervisor');
  const [rosterTopic, setRosterTopic] = useState<string>('Pengarahan Operasional, K3 & Pelayanan Konsumen');
  const [rosterTime, setRosterTime] = useState<string>('07:45');
  const [rosterSaving, setRosterSaving] = useState<boolean>(false);
  const [isRosterUnlocked, setIsRosterUnlocked] = useState<boolean>(false);

  // Briefing modal state (for manual new session)
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
  const [printRecapModalOpen, setPrintRecapModalOpen] = useState(false);

  // Load all data for Daily / Briefing
  const loadDailyData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    setError(null);
    try {
      const [empRes, bRes, attRes, leaveRes] = await Promise.all([
        employeeService.getEmployeesByUnit(activeUnitId),
        attendanceService.getBriefingSessions(activeUnitId),
        attendanceService.getDailyAttendance(activeUnitId, selectedDate),
        leaveService.getLeaveRequestsByUnit(activeUnitId),
      ]);

      const activeEmps = empRes.data.filter((e) => e.status === 'ACTIVE');
      setEmployees(activeEmps);
      setBriefings(bRes.data);
      setDailyAttendance(attRes.data);
      setLeaves(leaveRes.data);
      setIsFixture(empRes.isFixture || bRes.isFixture || attRes.isFixture || leaveRes.isFixture);

      // Pre-fill roster status for each active employee
      const initialStatus: Record<string, RosterStatus> = {};
      const initialNotes: Record<string, string> = {};

      // Check if employee has approved leave on selectedDate
      const approvedLeavesToday = leaveRes.data.filter((l) => {
        if (l.status !== 'APPROVED') return false;
        if (Array.isArray(l.dates)) {
          return l.dates.some((d) => (typeof d === 'string' ? d : (d as any).leave_date) === selectedDate);
        }
        return false;
      });
      const leaveEmpIdSet = new Set(approvedLeavesToday.map((l) => l.employee_id));

      activeEmps.forEach((emp) => {
        // If employee is on approved leave today
        if (leaveEmpIdSet.has(emp.id)) {
          initialStatus[emp.id] = 'LEAVE';
          initialNotes[emp.id] = 'Cuti resmi disetujui';
          return;
        }

        // If attendance already recorded
        const existingAtt = attRes.data.find((a) => a.employee_id === emp.id);
        if (existingAtt) {
          initialStatus[emp.id] = existingAtt.status;
          initialNotes[emp.id] = existingAtt.notes || '';
        } else {
          initialStatus[emp.id] = 'PRESENT'; // Default Hadir
        }
      });

      setRosterStatuses(initialStatus);
      setRosterNotes(initialNotes);

      // Pre-fill speaker & topic if briefing exists for today
      const existingBriefing = bRes.data.find((b) => b.session_date === selectedDate);
      if (existingBriefing) {
        setRosterSpeaker(existingBriefing.speaker_name);
        setRosterTopic(existingBriefing.topic);
        setRosterTime(existingBriefing.session_time?.slice(0, 5) || '07:45');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data presensi.');
    } finally {
      setLoading(false);
    }
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
    if (activeTab === 'BRIEFING' || activeTab === 'DAILY') {
      loadDailyData();
    } else {
      loadRecapData();
    }
  }, [activeUnitId, selectedDate, selectedMonth, activeTab]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Check if briefing session was already recorded for selectedDate
  const briefingToday = useMemo(() => {
    return briefings.find((b) => b.session_date === selectedDate);
  }, [briefings, selectedDate]);

  const isRosterLocked = Boolean(briefingToday) && !isRosterUnlocked;

  // Status Counts for Summary Banner
  const rosterSummary = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alpa = 0;
    let cuti = 0;

    employees.forEach((emp) => {
      const st = rosterStatuses[emp.id];
      if (st === 'PRESENT') hadir++;
      else if (st === 'PERMIT') izin++;
      else if (st === 'SICK') sakit++;
      else if (st === 'ABSENT') alpa++;
      else if (st === 'LEAVE') cuti++;
    });

    return { hadir, izin, sakit, alpa, cuti, total: employees.length };
  }, [employees, rosterStatuses]);

  // Handle Roster Status Change
  const handleRosterStatusChange = (empId: string, status: AttendanceStatus) => {
    setRosterStatuses((prev) => ({ ...prev, [empId]: status }));
  };

  // Handle Save Briefing Roster (Bulk Submit)
  const handleSaveRoster = async () => {
    if (!activeUnitId) return;
    if (!rosterTopic.trim()) {
      showToast('Topik arahan briefing pagi wajib diisi.');
      return;
    }

    setRosterSaving(true);
    const records = employees.map((emp) => {
      const st = rosterStatuses[emp.id] || 'PRESENT';
      const isLeave = st === 'LEAVE';
      return {
        employee_id: emp.id,
        status: (isLeave ? 'PERMIT' : st) as AttendanceStatus,
        check_in_time: isLeave ? undefined : `${rosterTime}:00`,
        notes: isLeave ? 'Cuti resmi disetujui' : rosterNotes[emp.id]?.trim() || undefined,
      };
    });

    const res = await (attendanceService as any).recordDailyBriefingAttendance(activeUnitId, {
      session_date: selectedDate,
      session_time: `${rosterTime}:00`,
      speaker_name: rosterSpeaker.trim() || 'Kepala Toko / Supervisor',
      topic: rosterTopic.trim(),
      records,
    });

    setRosterSaving(false);

    if (res.success) {
      showToast(res.message || 'Rekap presensi briefing berhasil disimpan!');
      setIsRosterUnlocked(false);
      loadDailyData();
    } else {
      showToast(res.message || 'Gagal menyimpan presensi briefing.');
    }
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
    if (activeTab === 'BRIEFING' || activeTab === 'DAILY') {
      const headers = [
        'Nama Karyawan',
        'Kode',
        'Bagian/Jabatan',
        'Jam Masuk',
        'Status Presensi',
        'Keterlambatan (Menit)',
        'Tanggal',
      ];
      const rows = employees.map((emp) => [
        emp.full_name,
        emp.employee_code,
        emp.position?.title || emp.department?.name || '-',
        rosterTime,
        rosterStatuses[emp.id] || 'PRESENT',
        0,
        selectedDate,
      ]);
      exportToCSV(`Presensi_Briefing_${activeUnit?.code || 'KUK'}_${selectedDate}`, headers, rows);
    } else {
      const headers = [
        'Nama Karyawan',
        'Kode',
        'Departemen',
        'Hadir',
        'Terlambat',
        'Izin',
        'Sakit',
        'Alpa',
        'Total Menit Terlambat',
        'Bulan',
      ];
      const rows = recapData.map((rec) => [
        rec.employee_name,
        rec.employee_code,
        rec.department_name,
        rec.present_days,
        rec.late_days,
        rec.permit_days,
        rec.sick_days,
        rec.absent_days,
        rec.total_late_minutes,
        selectedMonth,
      ]);
      exportToCSV(`Rekap_Presensi_Bulanan_${activeUnit?.code || 'KUK'}_${selectedMonth}`, headers, rows);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header Halaman */}
      <PageHeader
        title="Presensi & Briefing Operasional"
        subtitle={`Pengarahan pagi & presensi karyawan unit ${activeUnit?.name || 'Unit Aktif'}`}
        icon={<Clock className="w-6 h-6 text-kuk-maroon" />}
        breadcrumbs={[{ label: 'Beranda', href: '/dashboard' }, { label: 'Presensi & Briefing' }]}
        unitBadge={activeUnit?.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
              title="Ekspor data presensi ke CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-kuk-maroon" />
              <span>Ekspor CSV</span>
            </button>

            <button
              onClick={() => setPrintRecapModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
              title="Cetak Rekapitulasi Presensi"
            >
              <Printer className="w-3.5 h-3.5 text-kuk-maroon" />
              <span className="hidden sm:inline">Cetak Rekap</span>
            </button>

            {hasPermission('attendance.manage_briefing', activeUnitId) && (
              <button
                onClick={() => setBriefingModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-kuk-maroon hover:bg-kuk-maroon-dark text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Sesi Briefing Baru</span>
              </button>
            )}

            {hasPermission('attendance.import_fingerprint', activeUnitId) && (
              <button
                onClick={() => setFingerprintModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
              >
                <UploadCloud className="w-4 h-4 text-kuk-maroon" />
                <span>Impor Fingerprint</span>
              </button>
            )}
          </div>
        }
      />

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
            onClick={() => (activeTab === 'MONTHLY_RECAP' ? loadRecapData() : loadDailyData())}
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
            <strong>Zero-State Preview Mode:</strong> Mode simulasi aktif. Data operasional tersimpan di penyimpanan preview lokal terisolasi.
          </span>
        </div>
      )}

      {/* Tab Navigation & Date Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('BRIEFING')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'BRIEFING'
                ? 'bg-kuk-maroon text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Presensi Briefing Pagi</span>
          </button>
          <button
            onClick={() => setActiveTab('DAILY')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'DAILY'
                ? 'bg-kuk-maroon text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Log Presensi Harian</span>
          </button>
          <button
            onClick={() => setActiveTab('MONTHLY_RECAP')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'MONTHLY_RECAP'
                ? 'bg-kuk-maroon text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Rekap Bulanan</span>
          </button>
        </div>

        {activeTab !== 'MONTHLY_RECAP' ? (
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

      {/* ========================================================================= */}
      {/* TAB 1: PRESENSI BRIEFING PAGI (ROSTER HARIAN RESMI)                      */}
      {/* ========================================================================= */}
      {activeTab === 'BRIEFING' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Card: Live Digital Clock & Indonesian Date */}
          <div className="bg-gradient-to-r from-[#540000] via-[#730000] to-[#540000] text-white p-6 rounded-2xl shadow-md border border-kuk-gold/30 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-kuk-gold/10 rounded-full blur-2xl pointer-events-none" />

            <div className="space-y-1 text-center md:text-left z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[11px] font-bold text-kuk-gold tracking-wide border border-white/10">
                <Sparkles className="w-3.5 h-3.5" />
                <span>APEL & BRIEFING OPERASIONAL HARIAN</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black font-display tracking-tight text-white">
                Rekap Presensi Briefing Pagi
              </h2>
              <p className="text-xs text-gray-200 font-medium">
                Unit: <strong className="text-kuk-gold">{activeUnit?.name}</strong> • {formatIndoDate(selectedDate)}
              </p>
            </div>

            {/* Digital Clock Display */}
            <div className="bg-black/30 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/15 text-center min-w-[200px] z-10 shadow-inner">
              <div className="text-[10px] text-gray-300 font-bold uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>WAKTU NYATA (WIB)</span>
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-kuk-gold drop-shadow-sm">
                {liveClock}
              </div>
            </div>
          </div>

          {/* Form Pengaturan Sesi Briefing */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-kuk-maroon" />
                  <span>Detail Sesi Briefing ({selectedDate})</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Isi narasumber dan catatan pengarahan untuk seluruh staf sebelum toko dibuka.
                </p>
              </div>

              {briefingToday && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Briefing Sudah Tercatat</span>
                  </span>
                  {isRosterLocked ? (
                    <button
                      onClick={() => setIsRosterUnlocked(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
                      title="Buka kunci untuk mengoreksi presensi staf"
                    >
                      <Unlock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Buka Kunci Edit</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsRosterUnlocked(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-bold transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5 text-gray-500" />
                      <span>Kunci Kembali</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Jam Briefing *</label>
                <input
                  type="time"
                  disabled={isRosterLocked}
                  value={rosterTime}
                  onChange={(e) => setRosterTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium border border-gray-200 rounded-xl focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Narasumber / Pembicara *</label>
                <input
                  type="text"
                  disabled={isRosterLocked}
                  value={rosterSpeaker}
                  onChange={(e) => setRosterSpeaker(e.target.value)}
                  placeholder="Nama Kepala Toko / SPV..."
                  className="w-full px-3 py-2 text-xs font-medium border border-gray-200 rounded-xl focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Topik & Arahan Briefing *</label>
                <input
                  type="text"
                  disabled={isRosterLocked}
                  value={rosterTopic}
                  onChange={(e) => setRosterTopic(e.target.value)}
                  placeholder="Contoh: K3 Pemotongan Kaca & Target Penjualan"
                  className="w-full px-3 py-2 text-xs font-medium border border-gray-200 rounded-xl focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Roster Table Karyawan */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-kuk-maroon/10 text-kuk-maroon flex items-center justify-center font-bold">
                  {employees.length}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Daftar Kehadiran Karyawan</h4>
                  <p className="text-[11px] text-gray-500">Pilih status kehadiran setiap personel untuk sesi pengarahan pagi ini.</p>
                </div>
              </div>

              {/* Roster Counters */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
                  Hadir: {rosterSummary.hadir}
                </span>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
                  Izin: {rosterSummary.izin}
                </span>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg">
                  Sakit: {rosterSummary.sakit}
                </span>
                <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg">
                  Alpa: {rosterSummary.alpa}
                </span>
                {rosterSummary.cuti > 0 && (
                  <span className="px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg">
                    Cuti: {rosterSummary.cuti}
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-xs text-gray-400">Memuat daftar staf unit...</div>
            ) : employees.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs">
                Tidak ada data karyawan aktif pada unit ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100/70 text-gray-700 font-bold uppercase text-[11px] border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">#</th>
                      <th className="px-4 py-3 min-w-[200px]">Karyawan</th>
                      <th className="px-4 py-3">Bagian / Jabatan</th>
                      <th className="px-4 py-3 min-w-[340px]">Status Kehadiran Briefing</th>
                      <th className="px-4 py-3 min-w-[180px]">Catatan / Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employees.map((emp, idx) => {
                      const isLeave = rosterStatuses[emp.id] === 'LEAVE';
                      const currentStatus = rosterStatuses[emp.id] || 'PRESENT';

                      return (
                        <tr
                          key={emp.id}
                          className={`transition-colors ${
                            isLeave
                              ? 'bg-purple-50/40 hover:bg-purple-50/70'
                              : currentStatus === 'ABSENT'
                              ? 'bg-rose-50/30 hover:bg-rose-50/50'
                              : 'hover:bg-gray-50/70'
                          }`}
                        >
                          <td className="px-4 py-3 text-center text-gray-400 font-mono font-semibold">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#540000] to-[#800000] text-kuk-gold font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                                {emp.full_name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900">{emp.full_name}</div>
                                <div className="text-[10px] text-gray-400 font-mono">{emp.employee_code}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                              {emp.position?.title || emp.department?.name || 'Staf Operasional'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isLeave ? (
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100/80 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold">
                                <Palmtree className="w-4 h-4 text-purple-700" />
                                <span>🏖️ Cuti Resmi (Otomatis Terverifikasi)</span>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {/* Option Hadir */}
                                <label
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                    currentStatus === 'PRESENT'
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                  } ${isRosterLocked ? 'opacity-70 pointer-events-none' : ''}`}
                                >
                                  <input
                                    type="radio"
                                    name={`status_${emp.id}`}
                                    value="PRESENT"
                                    checked={currentStatus === 'PRESENT'}
                                    disabled={isRosterLocked}
                                    onChange={() => handleRosterStatusChange(emp.id, 'PRESENT')}
                                    className="hidden"
                                  />
                                  <span>Hadir</span>
                                </label>

                                {/* Option Izin */}
                                <label
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                    currentStatus === 'PERMIT'
                                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                  } ${isRosterLocked ? 'opacity-70 pointer-events-none' : ''}`}
                                >
                                  <input
                                    type="radio"
                                    name={`status_${emp.id}`}
                                    value="PERMIT"
                                    checked={currentStatus === 'PERMIT'}
                                    disabled={isRosterLocked}
                                    onChange={() => handleRosterStatusChange(emp.id, 'PERMIT')}
                                    className="hidden"
                                  />
                                  <span>Izin</span>
                                </label>

                                {/* Option Sakit */}
                                <label
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                    currentStatus === 'SICK'
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                  } ${isRosterLocked ? 'opacity-70 pointer-events-none' : ''}`}
                                >
                                  <input
                                    type="radio"
                                    name={`status_${emp.id}`}
                                    value="SICK"
                                    checked={currentStatus === 'SICK'}
                                    disabled={isRosterLocked}
                                    onChange={() => handleRosterStatusChange(emp.id, 'SICK')}
                                    className="hidden"
                                  />
                                  <span>Sakit</span>
                                </label>

                                {/* Option Alpa */}
                                <label
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                    currentStatus === 'ABSENT'
                                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                  } ${isRosterLocked ? 'opacity-70 pointer-events-none' : ''}`}
                                >
                                  <input
                                    type="radio"
                                    name={`status_${emp.id}`}
                                    value="ABSENT"
                                    checked={currentStatus === 'ABSENT'}
                                    disabled={isRosterLocked}
                                    onChange={() => handleRosterStatusChange(emp.id, 'ABSENT')}
                                    className="hidden"
                                  />
                                  <span>Alpa</span>
                                </label>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              disabled={isRosterLocked || isLeave}
                              value={rosterNotes[emp.id] || ''}
                              onChange={(e) =>
                                setRosterNotes((prev) => ({ ...prev, [emp.id]: e.target.value }))
                              }
                              placeholder={isLeave ? 'Karyawan cuti' : 'Catatan opsional...'}
                              className="w-full px-2.5 py-1 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-kuk-maroon disabled:bg-gray-50 disabled:text-gray-400"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Action Bar */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-gray-600 font-medium">
                Perekapan presensi briefing akan langsung terhubung ke kalkulasi gaji bulanan unit.
              </div>

              {hasPermission('attendance.manage_briefing', activeUnitId) && (
                <button
                  onClick={handleSaveRoster}
                  disabled={isRosterLocked || rosterSaving}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-kuk-maroon hover:bg-kuk-maroon-dark text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4 text-kuk-gold" />
                  <span>{rosterSaving ? 'Menyimpan...' : '💾 Simpan Rekap Presensi Briefing'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LOG PRESENSI HARIAN (LOG LENGKAP & KOREKSI)                        */}
      {/* ========================================================================= */}
      {activeTab === 'DAILY' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Kolom Kiri: Briefing Sessions */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
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
                  <div key={b.id} className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-kuk-maroon">
                        {b.session_date} • {b.session_time}
                      </span>
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
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-kuk-maroon" />
                  <span>Log Presensi Tanggal {selectedDate}</span>
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
                                : (att.status as any) === 'LEAVE'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
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
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REKAP BULANAN                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'MONTHLY_RECAP' && (
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4 animate-in fade-in duration-200">
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
                      <td className="px-4 py-3 text-center font-bold text-emerald-700">{rec.present_days}</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-700">{rec.late_days}</td>
                      <td className="px-4 py-3 text-center text-blue-700 font-semibold">{rec.permit_days}</td>
                      <td className="px-4 py-3 text-center text-blue-700 font-semibold">{rec.sick_days}</td>
                      <td className="px-4 py-3 text-center font-bold text-rose-700">{rec.absent_days}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-700">
                        {rec.total_late_minutes} Menit
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Buat Briefing Baru */}
      {briefingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Catat Sesi Briefing Baru</h2>
              </div>
              <button onClick={() => setBriefingModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
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
                <div>
                  <strong>Karyawan:</strong> {selectedRecord.employee?.full_name} ({selectedRecord.employee?.employee_code})
                </div>
                <div>
                  <strong>Tanggal:</strong> {selectedDate}
                </div>
                <div className="text-[11px] text-amber-700 mt-1">
                  Perubahan presensi akan dicatat ke audit log dengan sumber MANUAL_ADJUSTMENT.
                </div>
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
      <FingerprintImportModal
        isOpen={fingerprintModalOpen}
        onClose={() => setFingerprintModalOpen(false)}
        unitId={activeUnitId || ''}
        onImportSuccess={(count) => {
          showToast(`Berhasil menyinkronkan ${count} data presensi fingerprint.`);
          loadDailyData();
        }}
      />

      {/* Modal Cetak Rekapitulasi Presensi Bulanan */}
      {printRecapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-3.5 bg-gray-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-kuk-gold" />
                <span className="font-bold text-sm">Rekapitulasi Presensi — Bulan {selectedMonth}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-kuk-maroon text-white hover:bg-kuk-maroon-700 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Dokumen</span>
                </button>
                <button
                  onClick={() => setPrintRecapModalOpen(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6 text-xs bg-white text-gray-800">
              <PrintHeader
                title="REKAPITULASI PRESENSI & KEDISIPLINAN KARYAWAN"
                documentNumber={`PRES/${selectedMonth}/${activeUnit?.code || 'KUK'}`}
                unitName={activeUnit?.name}
                unitCode={activeUnit?.code}
              />

              <div className="flex items-center justify-between bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-500 text-[11px]">Periode Rekapitulasi:</span>
                  <div className="font-bold text-gray-900 text-sm">Bulan {selectedMonth}</div>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 text-[11px]">Total Data Tercatat:</span>
                  <div className="font-bold text-gray-900 text-sm">
                    {recapData.length > 0 ? recapData.length : employees.length} Karyawan
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-bold uppercase border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2.5">No</th>
                      <th className="px-3 py-2.5">Karyawan</th>
                      <th className="px-3 py-2.5">Departemen</th>
                      <th className="px-3 py-2.5 text-center">Hadir</th>
                      <th className="px-3 py-2.5 text-center">Terlambat</th>
                      <th className="px-3 py-2.5 text-center">Izin / Sakit</th>
                      <th className="px-3 py-2.5 text-center">Mangkir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recapData.length > 0 ? (
                      recapData.map((rec, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2 text-gray-500 font-mono">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <span className="font-semibold text-gray-900">{rec.employee_name}</span>
                            <span className="text-[10px] font-mono text-gray-400 block">{rec.employee_code}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-700">{rec.department_name}</td>
                          <td className="px-3 py-2 text-center font-bold text-emerald-700">{rec.present_days}</td>
                          <td className="px-3 py-2 text-center font-bold text-amber-700">{rec.late_days}</td>
                          <td className="px-3 py-2 text-center text-blue-700 font-semibold">
                            {rec.permit_days + rec.sick_days}
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-rose-700">{rec.absent_days}</td>
                        </tr>
                      ))
                    ) : (
                      employees.map((emp, idx) => (
                        <tr key={emp.id} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2 text-gray-500 font-mono">{idx + 1}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900">{emp.full_name}</td>
                          <td className="px-3 py-2 text-gray-700">{emp.department?.name || 'Operasional'}</td>
                          <td className="px-3 py-2 text-center font-bold text-emerald-700">
                            {rosterStatuses[emp.id] === 'PRESENT' ? '1' : '0'}
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-amber-700">0</td>
                          <td className="px-3 py-2 text-center text-blue-700 font-semibold">
                            {rosterStatuses[emp.id] === 'PERMIT' || rosterStatuses[emp.id] === 'SICK' ? '1' : '0'}
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-rose-700">
                            {rosterStatuses[emp.id] === 'ABSENT' ? '1' : '0'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-200 text-center">
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Dibuat & Diverifikasi:</div>
                  <div className="border-b border-gray-300 w-36 mx-auto"></div>
                  <div className="font-bold text-gray-800">Personalia / HRD Unit</div>
                </div>
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Mengetahui & Menyetujui:</div>
                  <div className="border-b border-gray-300 w-36 mx-auto"></div>
                  <div className="font-bold text-gray-800">Kepala Toko / Manajer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceService } from '@/services/dataService';
import { getWIBDateString, getWIBTimeString } from '@/utils/dateUtils';
import type { BriefingSession, AttendanceDailyRecord } from '@/types/models';
import { Clock, Users, Calendar, Plus, UploadCloud, AlertCircle, CheckCircle2, X } from 'lucide-react';

export const AttendanceDashboardPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { profile, hasPermission } = useAuth();
  const [briefings, setBriefings] = useState<BriefingSession[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<AttendanceDailyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Briefing modal state
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [bTopic, setBTopic] = useState('');
  const [bSpeaker, setBSpeaker] = useState(profile?.full_name || 'Kepala Toko / Manager');
  const [bAttendees, setBAttendees] = useState(10);
  const [bSaving, setBSaving] = useState(false);

  // Konsisten dengan zona waktu Asia/Jakarta (WIB, UTC+7)
  const today = getWIBDateString();

  const loadData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    const [bRes, attRes] = await Promise.all([
      attendanceService.getBriefingSessions(activeUnitId),
      attendanceService.getDailyAttendance(activeUnitId, today),
    ]);
    setBriefings(bRes.data);
    setDailyAttendance(attRes.data);
    setIsFixture(bRes.isFixture || attRes.isFixture);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeUnitId, today]);

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
      session_date: today,
      session_time: timeStr,
      topic: bTopic.trim(),
      speaker_name: bSpeaker.trim(),
      total_attendees: Number(bAttendees),
    });
    setBSaving(false);
    showToast(res.message);
    setBriefingModalOpen(false);
    setBTopic('');
    loadData();
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
            Pengarahan pagi & presensi harian unit <span className="font-semibold text-kuk-maroon">{activeUnit?.name || 'Unit Aktif'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
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
              onClick={() => alert('Modul Sinkronisasi Fingerprint: Berkas mentah .dat / .csv dari mesin fingerprint unit siap diimpor via staging pipeline.')}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors"
            >
              <UploadCloud className="w-4 h-4 text-gray-500" />
              <span>Impor Log Fingerprint</span>
            </button>
          )}
        </div>
      </div>

      {isFixture && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Zero-State Preview Mode:</strong> Database Production belum memiliki log presensi aktif hari ini. Data di bawah ini adalah sampel preview lokal.
          </span>
        </div>
      )}

      {/* Grid: Briefing Terkini & Presensi Hari Ini */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Briefing Sessions */}
        <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-kuk-maroon" />
              <span>Sesi Briefing Pagi</span>
            </h2>
            <span className="text-xs text-gray-400">{briefings.length} sesi tercatat</span>
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

        {/* Kolom Kanan: Rekap Presensi Harian */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-kuk-maroon" />
                <span>Presensi Hari Ini ({today})</span>
              </h2>
            </div>
            <span className="text-xs font-medium text-gray-500">
              Fingerprint Standby & Direct Sync
            </span>
          </div>

          {loading ? (
            <div className="text-center py-6 text-xs text-gray-400">Memuat presensi harian...</div>
          ) : dailyAttendance.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">Belum ada log presensi untuk hari ini</div>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dailyAttendance.map((att) => (
                    <tr key={att.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{att.employee?.full_name}</td>
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
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {att.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
};

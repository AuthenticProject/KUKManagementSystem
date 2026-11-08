import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { violationService, employeeService } from '@/services/dataService';
import type { ViolationRecord, WarningLetter, Employee, WarningLevel } from '@/types/models';
import { AlertTriangle, FileText, Plus, ShieldAlert, Calendar, AlertCircle, CheckCircle2, X } from 'lucide-react';

export const ViolationListPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { profile, hasPermission } = useAuth();
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [warningLetters, setWarningLetters] = useState<WarningLetter[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'violations' | 'warning_letters'>('violations');
  const [toast, setToast] = useState<string | null>(null);

  // Modals
  const [spModalOpen, setSpModalOpen] = useState(false);
  const [violationModalOpen, setViolationModalOpen] = useState(false);

  // Form SP state
  const [spEmployeeId, setSpEmployeeId] = useState('');
  const [spLevel, setSpLevel] = useState<WarningLevel>('SP1');
  const [spReason, setSpReason] = useState('');
  const [spIssuedDate, setSpIssuedDate] = useState(new Date().toISOString().split('T')[0]);
  const [spSaving, setSpSaving] = useState(false);

  // Form Violation state
  const [vEmployeeId, setVEmployeeId] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [vPoints, setVPoints] = useState(5);
  const [vDate, setVDate] = useState(new Date().toISOString().split('T')[0]);
  const [vSaving, setVSaving] = useState(false);

  const loadData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    setError(null);
    const [vRes, spRes, empRes] = await Promise.all([
      violationService.getViolationsByUnit(activeUnitId),
      violationService.getWarningLettersByUnit(activeUnitId),
      employeeService.getEmployeesByUnit(activeUnitId),
    ]);
    setViolations(vRes.data);
    setWarningLetters(spRes.data);
    setEmployees(empRes.data);
    setIsFixture(vRes.isFixture || spRes.isFixture);
    if (!vRes.success && vRes.error) {
      setError(vRes.error);
    } else if (!spRes.success && spRes.error) {
      setError(spRes.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeUnitId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleCreateSP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !spEmployeeId || !spReason.trim()) return;
    setSpSaving(true);
    const res = await violationService.issueWarningLetter(activeUnitId, {
      employee_id: spEmployeeId,
      letter_number: `SP/${activeUnit?.code || 'UNIT'}/${new Date().toISOString().slice(0, 7).replace('-', '')}/${Math.floor(100 + Math.random() * 900)}`,
      level: spLevel,
      issued_date: spIssuedDate,
      reason: spReason.trim(),
      issued_by: profile?.full_name || 'Kepala Unit',
    });
    setSpSaving(false);
    showToast(res.message);
    setSpModalOpen(false);
    setSpReason('');
    loadData();
  };

  const handleRecordViolation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !vEmployeeId || !vDesc.trim()) return;
    setVSaving(true);
    const res = await violationService.recordViolation(activeUnitId, {
      employee_id: vEmployeeId,
      incident_date: vDate,
      description: vDesc.trim(),
      points_assigned: Number(vPoints),
      recorded_by: profile?.full_name || 'Supervisor Operasional',
    });
    setVSaving(false);
    showToast(res.message);
    setViolationModalOpen(false);
    setVDesc('');
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
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Pelanggaran & Surat Peringatan</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Riwayat kedisiplinan & sanksi unit <span className="font-semibold text-kuk-maroon">{activeUnit?.name || 'Unit Aktif'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission('violations.manage', activeUnitId) && (
            <button
              onClick={() => {
                setVEmployeeId(employees[0]?.id || '');
                setViolationModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-4 h-4 text-gray-500" />
              <span>Catat Pelanggaran</span>
            </button>
          )}

          {hasPermission('violations.issue_sp', activeUnitId) && (
            <button
              onClick={() => {
                setSpEmployeeId(employees[0]?.id || '');
                setSpModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-kuk-maroon text-white rounded-xl text-xs font-semibold hover:bg-kuk-maroon-700 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Terbitkan SP Baru</span>
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
            onClick={loadData}
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

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('violations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'violations'
              ? 'border-kuk-maroon text-kuk-maroon'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Catatan Pelanggaran ({violations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('warning_letters')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'warning_letters'
              ? 'border-kuk-maroon text-kuk-maroon'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Surat Peringatan / SP ({warningLetters.length})</span>
        </button>
      </div>

      {/* Content Table / Cards */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat data kedisiplinan...</div>
        ) : activeTab === 'violations' ? (
          violations.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">Tidak ada catatan pelanggaran</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                  <tr>
                    <th className="px-5 py-3.5">Tanggal</th>
                    <th className="px-5 py-3.5">Karyawan</th>
                    <th className="px-5 py-3.5">Poin Penalti</th>
                    <th className="px-5 py-3.5">Keterangan Kejadian</th>
                    <th className="px-5 py-3.5">Pencatat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {violations.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50/80">
                      <td className="px-5 py-4 text-xs font-mono text-gray-600">{v.incident_date}</td>
                      <td className="px-5 py-4 font-semibold text-gray-900">{v.employee?.full_name || 'Karyawan'}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          +{v.points_assigned} Poin
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-600 max-w-sm">{v.description}</td>
                      <td className="px-5 py-4 text-xs text-gray-400">{v.recorded_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : warningLetters.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Tidak ada Surat Peringatan aktif</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {warningLetters.map((sp) => (
              <div key={sp.id} className="p-5 hover:bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900">{sp.employee?.full_name}</span>
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{sp.letter_number}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Level: {sp.level}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{sp.reason}</p>
                  <div className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Diterbitkan: {sp.issued_date} • Referensi Berlaku s.d. {sp.valid_until} (Draft 6 Bln)</span>
                  </div>
                </div>

                <div>
                  <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {sp.approval_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Terbitkan SP (Aturan 6 Bulan Otomatis) */}
      {spModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Terbitkan Surat Peringatan (SP)</h2>
              </div>
              <button onClick={() => setSpModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreateSP} className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs">
                <strong>Pedoman Administratif (Draft):</strong> Masa berlaku SP dihitung secara administratif 6 bulan dari tanggal penerbitan. Kebijakan final masa berlaku & konsekuensi berstatus <em>BUSINESS DECISION REQUIRED</em> (tidak menimbulkan pemotongan gaji atau sanksi otomatis).
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Pilih Karyawan Sasaran *</label>
                <select
                  required
                  value={spEmployeeId}
                  onChange={(e) => setSpEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code}) - {e.department?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tingkat / Level SP *</label>
                  <select
                    value={spLevel}
                    onChange={(e) => setSpLevel(e.target.value as WarningLevel)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  >
                    <option value="ORAL_WARNING">Teguran Lisan</option>
                    <option value="SP1">SP 1 (Peringatan I)</option>
                    <option value="SP2">SP 2 (Peringatan II)</option>
                    <option value="SP3">SP 3 (Peringatan Terakhir)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal Penerbitan</label>
                  <input
                    type="date"
                    value={spIssuedDate}
                    onChange={(e) => setSpIssuedDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Alasan Penerbitan SP *</label>
                <textarea
                  required
                  rows={3}
                  value={spReason}
                  onChange={(e) => setSpReason(e.target.value)}
                  placeholder="Jelaskan dasar pelanggaran atau akumulasi poin..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSpModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={spSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {spSaving ? 'Menerbitkan...' : 'Terbitkan SP (6 Bulan)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Catat Pelanggaran */}
      {violationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h2 className="font-bold text-sm">Catat Pelanggaran Disiplin</h2>
              </div>
              <button onClick={() => setViolationModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleRecordViolation} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Pilih Karyawan *</label>
                <select
                  required
                  value={vEmployeeId}
                  onChange={(e) => setVEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Poin Penalti</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={vPoints}
                    onChange={(e) => setVPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal Kejadian</label>
                  <input
                    type="date"
                    value={vDate}
                    onChange={(e) => setVDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Keterangan / Kronologi Pelanggaran *</label>
                <textarea
                  required
                  rows={3}
                  value={vDesc}
                  onChange={(e) => setVDesc(e.target.value)}
                  placeholder="Jelaskan detail kejadian pelanggaran..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setViolationModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={vSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {vSaving ? 'Menyimpan...' : 'Simpan Pelanggaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

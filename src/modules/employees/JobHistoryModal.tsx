import React, { useEffect, useState } from 'react';
import type { Employee, EmployeeJobHistory, Position } from '@/types/models';
import { employeeService, systemService } from '@/services/dataService';
import { History, X, Briefcase, Calendar, AlertCircle, PlusCircle, CheckCircle2 } from 'lucide-react';

interface JobHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  unitId: string;
  onHistoryUpdated?: () => void;
}

export const JobHistoryModal: React.FC<JobHistoryModalProps> = ({
  isOpen,
  onClose,
  employee,
  unitId,
  onHistoryUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'view' | 'create'>('view');
  const [history, setHistory] = useState<EmployeeJobHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Mutation form state
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [toUnitId, setToUnitId] = useState<string>(unitId);
  const [toPositionId, setToPositionId] = useState<string>('');
  const [transitionType, setTransitionType] = useState<'PROMOTION' | 'MUTATION' | 'DEMOTION'>('PROMOTION');
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!employee || !unitId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await employeeService.getEmployeeJobHistory(unitId, employee.id);
      setHistory(res.data);
      setIsFixture(res.isFixture);
      if (!res.success && res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat riwayat jabatan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && employee && unitId) {
      setActiveTab('view');
      setSuccessMsg(null);
      setError(null);
      fetchHistory();

      // Load units and positions
      systemService.getUnits().then((uList) => {
        setUnits(uList);
        setToUnitId(employee.unit_id || unitId);
      });
    }
  }, [isOpen, employee, unitId]);

  useEffect(() => {
    if (toUnitId) {
      employeeService.getPositions(toUnitId).then((posList) => {
        setPositions(posList);
        if (posList.length > 0) {
          setToPositionId(posList[0].id);
        }
      });
    }
  }, [toUnitId]);

  const handleSubmitTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !toUnitId || !toPositionId || !effectiveDate) {
      setError('Unit, Posisi Baru, dan Tanggal Efektif wajib diisi.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await employeeService.recordJobTransition(unitId, {
        employee_id: employee.id,
        to_unit_id: toUnitId,
        to_position_id: toPositionId,
        effective_date: effectiveDate,
        transition_type: transitionType,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        setSuccessMsg(res.message);
        setNotes('');
        await fetchHistory();
        if (onHistoryUpdated) onHistoryUpdated();
        setTimeout(() => {
          setActiveTab('view');
          setSuccessMsg(null);
        }, 1200);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan perubahan jabatan.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-kuk-gold" />
            <h2 className="font-bold text-sm">Riwayat & Mutasi Jabatan Karyawan</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Header employee info */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900 text-sm">{employee.full_name}</div>
              <div className="text-gray-500 font-mono">{employee.employee_code}</div>
            </div>
            <div className="text-right">
              <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-kuk-maroon-50 text-kuk-maroon border border-kuk-maroon-100">
                {employee.position?.title || 'Staf'}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('view')}
              className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'view'
                  ? 'border-kuk-maroon text-kuk-maroon font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat ({history.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'create'
                  ? 'border-kuk-maroon text-kuk-maroon font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Catat Mutasi / Promosi</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'view' ? (
            <>
              {isFixture && !error && !loading && (
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Zero-State Preview:</strong> Riwayat di bawah ini adalah sampel simulasi lokal.
                  </span>
                </div>
              )}

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {loading ? (
                  <div className="py-8 text-center text-xs text-gray-500">Memuat riwayat jabatan...</div>
                ) : history.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">Belum ada riwayat mutasi/promosi untuk karyawan ini.</div>
                ) : (
                  history.map((item, idx) => (
                    <div key={item.id || idx} className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-900 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-kuk-maroon" />
                          <span>{item.to_position_title || 'Posisi Unit'}</span>
                        </span>
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          {item.transition_type}
                        </span>
                      </div>

                      <div className="text-2xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>Mulai Efektif: {item.effective_date}</span>
                        <span className="mx-1">•</span>
                        <span>Unit: {item.to_unit_name || 'Unit Operasional'}</span>
                      </div>

                      {item.notes && (
                        <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg text-2xs mt-1 border border-gray-100">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* Create Transition Form */
            <form onSubmit={handleSubmitTransition} className="space-y-3.5 max-h-80 overflow-y-auto pr-1 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Tipe Transisi Jabatan</label>
                <select
                  value={transitionType}
                  onChange={(e) => setTransitionType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-kuk-maroon"
                >
                  <option value="PROMOTION">PROMOSI (Kenaikan Jabatan/Level)</option>
                  <option value="MUTATION">MUTASI / ROTASI (Perubahan Peran)</option>
                  <option value="DEMOTION">DEMOSI (Penurunan Jabatan)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Unit Penempatan</label>
                  <select
                    value={toUnitId}
                    onChange={(e) => setToUnitId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-kuk-maroon"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Jabatan Baru</label>
                  <select
                    value={toPositionId}
                    onChange={(e) => setToPositionId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-kuk-maroon"
                  >
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Tanggal Mulai Efektif</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-kuk-maroon"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Catatan / Dasar SK Direksi</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nomor SK Mutasi atau pertimbangan rotasi..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-kuk-maroon"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('view')}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold bg-kuk-maroon hover:bg-kuk-maroon/90 text-white rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Mutasi Jabatan'}
                </button>
              </div>
            </form>
          )}

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

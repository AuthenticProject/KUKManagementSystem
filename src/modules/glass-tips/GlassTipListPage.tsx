import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { glassTipService } from '@/services/dataService';
import type { GlassTip } from '@/types/models';
import { Scissors, CheckCircle, Clock, XCircle, Calculator, FileCheck2, AlertCircle, CheckCircle2, X } from 'lucide-react';

export const GlassTipListPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { hasPermission } = useAuth();
  const [tips, setTips] = useState<GlassTip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [toast, setToast] = useState<string | null>(null);

  // Verification modal state
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedTip, setSelectedTip] = useState<GlassTip | null>(null);
  const [verifiedAmount, setVerifiedAmount] = useState<number>(0);
  const [verifyAction, setVerifyAction] = useState<'VERIFY' | 'REJECT'>('VERIFY');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifying, setVerifying] = useState(false);

  const loadData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    const res = await glassTipService.getGlassTipsByUnit(activeUnitId);
    setTips(res.data);
    setIsFixture(res.isFixture);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeUnitId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenVerify = (tip: GlassTip) => {
    setSelectedTip(tip);
    setVerifiedAmount(tip.tip_amount);
    setVerifyAction('VERIFY');
    setVerifyNotes('');
    setVerifyModalOpen(true);
  };

  const handleProcessVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTip || !activeUnitId) return;

    setVerifying(true);
    const res = await glassTipService.verifyTipNota(
      activeUnitId,
      selectedTip.id,
      Number(verifiedAmount),
      verifyAction,
      verifyNotes.trim()
    );
    setVerifying(false);
    showToast(res.message);
    setVerifyModalOpen(false);
    setSelectedTip(null);
    loadData();
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const filtered = tips.filter((t) => statusFilter === 'ALL' || t.status === statusFilter);

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
              <Scissors className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Tip Pemotongan Kaca (3%)</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Verifikasi fisik nota & klaim tip potongan kaca unit <span className="font-semibold text-kuk-maroon">{activeUnit?.name || 'Unit Aktif'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 bg-amber-50 text-amber-900 border border-amber-300 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-2xs">
          <Calculator className="w-4 h-4 text-amber-700 shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 px-1.5 py-0.5 rounded mr-1.5 text-amber-900">UNCONFIRMED</span>
            <span>Formula 3% Nilai Jual & Round Up Rp1.000 menunggu konfirmasi tertulis pimpinan</span>
          </div>
        </div>
      </div>

      {isFixture && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Zero-State Preview Mode:</strong> Belum ada nota pemotongan kaca tersimpan di database Production. Data di bawah ini adalah sampel preview lokal.
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {['ALL', 'PENDING', 'VERIFIED', 'REJECTED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === st
                ? 'bg-kuk-maroon text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {st === 'ALL' ? 'Semua Nota' : st}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat data nota tip...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Scissors className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Belum ada nota pemotongan kaca</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Kode Transaksi</th>
                  <th className="px-5 py-3.5">Pemotong / Sopir</th>
                  <th className="px-5 py-3.5">Dimensi Kaca</th>
                  <th className="px-5 py-3.5">Nilai Kaca</th>
                  <th className="px-5 py-3.5">Tip Standar (3%)</th>
                  <th className="px-5 py-3.5">Nominal Verifikasi</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Otorisasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/80">
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs font-bold text-gray-800">{t.reference_code}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{new Date(t.created_at).toLocaleDateString('id-ID')}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{t.employee?.full_name || 'Karyawan'}</div>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      <div>{t.glass_type?.name || 'Kaca Standar'}</div>
                      <div className="text-gray-400 mt-0.5">
                        {t.length_cm} × {t.height_cm} cm ({t.quantity} lbr = {t.calculated_sqm} m²)
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-gray-700">
                      {formatRupiah(t.glass_price_snapshot)}
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-gray-900">
                      {formatRupiah(t.tip_amount)}
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-emerald-700">
                      {t.verified_amount ? formatRupiah(t.verified_amount) : '— Belum Verif —'}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          t.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : t.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {t.status === 'VERIFIED' && <CheckCircle className="w-3 h-3" />}
                        {t.status === 'PENDING' && <Clock className="w-3 h-3" />}
                        {t.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                        <span>{t.status}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {hasPermission('glass_tips.verify', activeUnitId) && t.status === 'PENDING' && (
                        <button
                          onClick={() => handleOpenVerify(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-kuk-maroon text-white rounded-lg text-xs font-semibold hover:bg-kuk-maroon-700 transition-colors shadow-xs"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>Verifikasi Nota</span>
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

      {/* Modal Verifikasi Nota Fisik (Otorisasi Staf Berizin) */}
      {verifyModalOpen && selectedTip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Verifikasi Fisik Nota Tip ({selectedTip.reference_code})</h2>
              </div>
              <button onClick={() => setVerifyModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleProcessVerify} className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pemotong Kaca:</span>
                  <span className="font-bold text-gray-900">{selectedTip.employee?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dimensi & Volume:</span>
                  <span className="font-mono text-gray-800">{selectedTip.length_cm} × {selectedTip.height_cm} cm ({selectedTip.calculated_sqm} m²)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Nilai Kaca Terpotong:</span>
                  <span className="font-semibold text-gray-900">{formatRupiah(selectedTip.glass_price_snapshot)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                  <span className="text-gray-500">Klaim Tip Standar (3%):</span>
                  <span className="font-bold text-kuk-maroon">{formatRupiah(selectedTip.tip_amount)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Keputusan Verifikasi *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVerifyAction('VERIFY')}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-colors ${
                      verifyAction === 'VERIFY'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Setujui (VERIFY)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyAction('REJECT')}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-colors ${
                      verifyAction === 'REJECT'
                        ? 'border-rose-600 bg-rose-50 text-rose-800'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Tolak (REJECT)
                  </button>
                </div>
              </div>

              {verifyAction === 'VERIFY' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nominal Tip Disetujui (Rp) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1000"
                    value={verifiedAmount}
                    onChange={(e) => setVerifiedAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-bold text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Staf dapat mengoreksi nominal jika terdapat cacat nota atau toleransi limbah kaca.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan Verifikasi</label>
                <textarea
                  rows={2}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Catatan fisik nota, nomor surat jalan delivery, dll..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setVerifyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {verifying ? 'Memproses...' : 'Simpan Verifikasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

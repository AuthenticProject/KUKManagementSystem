import React, { useEffect, useState, useMemo } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { financeService } from '@/services/dataService';
import type { CashExpense, ExpenseCategory } from '@/types/models';
import {
  Wallet,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  X,
  FileSpreadsheet,
  Search,
  Filter,
  DollarSign,
  ShieldCheck,
  Fuel,
  Wrench,
  Coffee,
  ShoppingBag,
  Layers,
} from 'lucide-react';

export const CashExpensePage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { user, hasPermission } = useAuth();

  const [expenses, setExpenses] = useState<CashExpense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [recordModalOpen, setRecordModalOpen] = useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [selectedExpenseForReject, setSelectedExpenseForReject] = useState<CashExpense | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Form State
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('OPERATIONAL');
  const [expAmount, setExpAmount] = useState<string>('150000');
  const [expRecipient, setExpRecipient] = useState<string>('');
  const [expDescription, setExpDescription] = useState<string>('');
  const [expDate, setExpDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  const canApprove = hasPermission('finance.approve', activeUnitId) || hasPermission('admin.all', activeUnitId);

  const loadExpenses = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    setError(null);
    const res = await financeService.getExpensesByUnit(activeUnitId);
    setExpenses(res.data);
    setIsFixture(res.isFixture);
    if (!res.success && res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, [activeUnitId]);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId) return;
    const amountNum = Number(expAmount.replace(/\D/g, ''));
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Nominal pengeluaran harus berupa angka lebih besar dari Rp0.', true);
      return;
    }
    if (!expRecipient.trim() || !expDescription.trim()) {
      showToast('Penerima dan deskripsi pengeluaran wajib diisi.', true);
      return;
    }

    setSubmitting(true);
    const res = await financeService.recordExpense(activeUnitId, {
      category: expCategory,
      amount: amountNum,
      recipient_name: expRecipient.trim(),
      description: expDescription.trim(),
      expense_date: expDate,
      recorded_by: user?.email?.split('@')[0] || 'Staff Toko',
    });
    setSubmitting(false);

    showToast(res.message, !res.success);
    if (res.success) {
      setRecordModalOpen(false);
      setExpRecipient('');
      setExpDescription('');
      setExpAmount('150000');
      loadExpenses();
    }
  };

  const handleApprove = async (expense: CashExpense) => {
    if (!activeUnitId) return;
    setActionProcessing(true);
    const res = await financeService.approveExpense(
      activeUnitId,
      expense.id,
      'APPROVE',
      user?.id || 'admin-system',
      user?.email?.split('@')[0] || 'Manajer Unit'
    );
    setActionProcessing(false);
    showToast(res.message, !res.success);
    if (res.success) {
      loadExpenses();
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !selectedExpenseForReject) return;
    if (!rejectionReason.trim()) {
      showToast('Alasan penolakan pengeluaran wajib diisi.', true);
      return;
    }
    setActionProcessing(true);
    const res = await financeService.approveExpense(
      activeUnitId,
      selectedExpenseForReject.id,
      'REJECT',
      user?.id || 'admin-system',
      user?.email?.split('@')[0] || 'Manajer Unit',
      rejectionReason.trim()
    );
    setActionProcessing(false);
    showToast(res.message, !res.success);
    if (res.success) {
      setRejectModalOpen(false);
      setSelectedExpenseForReject(null);
      setRejectionReason('');
      loadExpenses();
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      if (statusFilter !== 'ALL' && item.approval_status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesRec = item.recipient_name.toLowerCase().includes(q);
        const matchesNum = item.expense_number.toLowerCase().includes(q);
        if (!matchesDesc && !matchesRec && !matchesNum) return false;
      }
      return true;
    });
  }, [expenses, statusFilter, categoryFilter, searchQuery]);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalApproved = 0;
    let totalPending = 0;
    let countPending = 0;

    expenses.forEach((e) => {
      if (e.approval_status === 'APPROVED') {
        totalApproved += e.amount;
      } else if (e.approval_status === 'PENDING') {
        totalPending += e.amount;
        countPending += 1;
      }
    });

    return { totalApproved, totalPending, countPending };
  }, [expenses]);

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'No. Bukti,Tanggal,Kategori,Penerima,Deskripsi,Nominal,Status,Disetujui Oleh,Alasan Penolakan\n';
    filteredExpenses.forEach((exp) => {
      csvContent += `"${exp.expense_number}","${exp.expense_date}","${exp.category}","${exp.recipient_name}","${exp.description}","${exp.amount}","${exp.approval_status}","${exp.approved_by_name || '-'}","${exp.rejection_reason || '-'}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pengeluaran_Kas_${activeUnit?.code || 'KUK'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryBadge = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'FLEET_FUEL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Fuel className="w-3 h-3" />
            <span>BBM Armada</span>
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Wrench className="w-3 h-3" />
            <span>Perawatan</span>
          </span>
        );
      case 'MEAL_ALLOWANCE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Coffee className="w-3 h-3" />
            <span>Uang Makan Lembur</span>
          </span>
        );
      case 'OFFICE_SUPPLIES':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ShoppingBag className="w-3 h-3" />
            <span>ATK & Perlengkapan</span>
          </span>
        );
      case 'PETTY_CASH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <DollarSign className="w-3 h-3" />
            <span>Kas Kecil Toko</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-50 text-gray-700 border border-gray-200">
            <Layers className="w-3 h-3" />
            <span>{cat}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm animate-in slide-in-from-bottom duration-200 ${
            toast.isError ? 'bg-red-900 border border-red-700' : 'bg-gray-900'
          }`}
        >
          {toast.isError ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-kuk-maroon-50 text-kuk-maroon rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Kas & Pengeluaran Toko</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Pencatatan kas kecil toko & otorisasi pengeluaran unit <span className="font-semibold text-kuk-maroon">{activeUnit?.name || 'Unit Aktif'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={() => setRecordModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-kuk-maroon text-white rounded-xl text-xs font-semibold hover:bg-kuk-maroon-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pengeluaran Kas</span>
          </button>
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
            onClick={loadExpenses}
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
            <strong>Zero-State Preview Mode:</strong> Mode simulasi aktif. Data pengeluaran di bawah ini adalah sampel preview lokal terisolasi dan tidak tersimpan di database Production.
          </span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-500 text-xs">
            <span>Total Pengeluaran Disetujui</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-gray-900 font-mono">
            {formatRupiah(summary.totalApproved)}
          </div>
          <div className="text-[11px] text-gray-400">
            Transaksi kas yang telah diverifikasi dan disetujui resmi
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-800 text-xs font-semibold">
            <span>Menunggu Otorisasi Manajer</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-700 font-mono">
            {formatRupiah(summary.totalPending)}
          </div>
          <div className="text-[11px] text-amber-600 font-medium">
            {summary.countPending} pengajuan kas perlu otorisasi sebelum pencairan
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-kuk-maroon/20 bg-kuk-maroon-50/30 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-kuk-maroon text-xs font-semibold">
            <span>Kebijakan Otorisasi Kas</span>
            <ShieldCheck className="w-4 h-4 text-kuk-gold" />
          </div>
          <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            BUSINESS DECISION REQUIRED
          </div>
          <div className="text-[11px] text-gray-600">
            Ambang batas auto-approval belum disahkan Direksi. Seluruh kas masuk antrean verifikasi manajer.
          </div>
        </div>
      </div>

      {/* Filters and Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Status:</span>
            <div className="flex rounded-lg p-0.5 bg-gray-100 text-xs font-semibold text-gray-600">
              {['ALL', 'APPROVED', 'PENDING', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    statusFilter === st ? 'bg-white text-kuk-maroon shadow-xs' : 'hover:text-gray-900'
                  }`}
                >
                  {st === 'ALL' ? 'Semua' : st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              >
                <option value="ALL">Semua Kategori</option>
                <option value="OPERATIONAL">OPERATIONAL</option>
                <option value="FLEET_FUEL">FLEET_FUEL (BBM)</option>
                <option value="OFFICE_SUPPLIES">OFFICE_SUPPLIES (ATK)</option>
                <option value="MAINTENANCE">MAINTENANCE (Perawatan)</option>
                <option value="MEAL_ALLOWANCE">MEAL_ALLOWANCE (Makan)</option>
                <option value="PETTY_CASH">PETTY_CASH (Kas Kecil)</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari bukti / penerima / keperluan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon w-56"
              />
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat data kas & pengeluaran...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Tidak ada transaksi pengeluaran kas yang sesuai filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3">No. Bukti & Tanggal</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Penerima & Keperluan</th>
                  <th className="px-4 py-3">Nominal (Rp)</th>
                  <th className="px-4 py-3">Status Otorisasi</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-gray-900">{exp.expense_number}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{exp.expense_date}</div>
                    </td>

                    <td className="px-4 py-3">
                      {getCategoryBadge(exp.category)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{exp.recipient_name}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5 max-w-xs line-clamp-1">{exp.description}</div>
                      {exp.rejection_reason && (
                        <div className="text-[10px] text-rose-600 font-medium mt-0.5">Alasan: {exp.rejection_reason}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono font-bold text-sm text-gray-900">
                      {formatRupiah(exp.amount)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            exp.approval_status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : exp.approval_status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {exp.approval_status === 'APPROVED' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : exp.approval_status === 'REJECTED' ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          <span>{exp.approval_status}</span>
                        </span>

                        {exp.approval_status === 'APPROVED' && exp.approved_by_name && (
                          <span className="text-[10px] text-gray-500">Disetujui oleh: {exp.approved_by_name}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {canApprove && exp.approval_status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApprove(exp)}
                            disabled={actionProcessing}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-50"
                          >
                            Setujui
                          </button>
                          <button
                            onClick={() => {
                              setSelectedExpenseForReject(exp);
                              setRejectionReason('');
                              setRejectModalOpen(true);
                            }}
                            disabled={actionProcessing}
                            className="px-2.5 py-1 bg-white text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-50 transition-colors shadow-2xs disabled:opacity-50"
                          >
                            Tolak
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Catat Pengeluaran Kas Baru */}
      {recordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Catat Pengeluaran Kas Toko</h2>
              </div>
              <button onClick={() => setRecordModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Tanggal Pengeluaran *</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Kategori Pengeluaran *</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  >
                    <option value="OPERATIONAL">OPERATIONAL (Operasional Toko)</option>
                    <option value="FLEET_FUEL">FLEET_FUEL (BBM Armada Toko)</option>
                    <option value="OFFICE_SUPPLIES">OFFICE_SUPPLIES (ATK/Kertas/Tinta)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Servis/Perbaikan)</option>
                    <option value="MEAL_ALLOWANCE">MEAL_ALLOWANCE (Uang Makan Lembur)</option>
                    <option value="PETTY_CASH">PETTY_CASH (Kas Kecil Harian)</option>
                    <option value="OTHER">OTHER (Lainnya)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Nominal Pengeluaran (Rp) *</label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={1000}
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Contoh: 150000"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon font-mono text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Kebijakan: Seluruh pencatatan kas toko berstatus PENDING hingga diverifikasi dan disetujui Manajer Unit / Petugas Keuangan.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Nama Penerima Dana / Vendor *</label>
                <input
                  type="text"
                  required
                  value={expRecipient}
                  onChange={(e) => setExpRecipient(e.target.value)}
                  placeholder="Contoh: SPBU Pertamina Cilegon / Toko ATK Sinar Baru"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Keperluan & Rincian Transaksi *</label>
                <textarea
                  required
                  rows={3}
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="Isi rincian pengeluaran, nomor plat armada (jika BBM), atau barang yang dibeli..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRecordModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Wallet className="w-4 h-4 text-kuk-gold" />
                  <span>{submitting ? 'Menyimpan...' : 'Simpan Pengeluaran Kas'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tolak Pengeluaran */}
      {rejectModalOpen && selectedExpenseForReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-200" />
                <h2 className="font-bold text-sm">Tolak Pengeluaran ({selectedExpenseForReject.expense_number})</h2>
              </div>
              <button onClick={() => setRejectModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-6 space-y-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                <div><span className="text-gray-500">Penerima:</span> <strong>{selectedExpenseForReject.recipient_name}</strong></div>
                <div><span className="text-gray-500">Nominal:</span> <strong className="text-rose-700">{formatRupiah(selectedExpenseForReject.amount)}</strong></div>
                <div><span className="text-gray-500">Keperluan:</span> {selectedExpenseForReject.description}</div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Alasan Penolakan Resmi *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Bukti nota tidak lengkap atau anggaran unit telah melebihi batas..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionProcessing}
                  className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {actionProcessing ? 'Memproses...' : 'Tolak Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

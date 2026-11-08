import React, { useState, useEffect } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { auditService } from '@/services/dataService';
import type { AuditLog } from '@/types/models';
import {
  ShieldAlert,
  Search,
  FileSpreadsheet,
  Eye,
  AlertCircle,
  X,
  History,
  Terminal,
} from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [tableFilter, setTableFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    setError(null);
    const res = await auditService.getAuditLogs(activeUnitId);
    setLogs(res.data);
    setIsFixture(res.isFixture);
    if (!res.success && res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeUnitId]);

  const handleOpenDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailModalOpen(true);
  };

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'ID,Timestamp,Tabel,Aksi,Record ID,Aktor ID,IP Address,Keterangan\n';
    filteredLogs.forEach((l) => {
      csvContent += `"${l.id}","${l.created_at}","${l.table_name}","${l.action}","${l.record_id || ''}","${l.actor_id || 'System'}","${l.ip_address || '-'}","${l.notes || ''}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit_Logs_${activeUnit?.code || 'KUK'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter((log) => {
    if (tableFilter !== 'ALL' && log.table_name !== tableFilter) return false;
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTable = log.table_name.toLowerCase().includes(q);
      const matchAction = log.action.toLowerCase().includes(q);
      const matchRecord = log.record_id?.toLowerCase().includes(q);
      const matchNotes = log.notes?.toLowerCase().includes(q);
      if (!matchTable && !matchAction && !matchRecord && !matchNotes) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-kuk-maroon-50 text-kuk-maroon rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Trail & Jejak Mutasi Data</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Rekam jejak perubahan data, otorisasi transaksi, dan anti-spoofing audit log unit <span className="font-semibold text-kuk-maroon">{activeUnit?.name || 'Unit Aktif'}</span>
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Ekspor Log CSV</span>
        </button>
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

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari tabel, record ID, catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-gray-500 font-semibold">Tabel:</span>
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-xs font-medium focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
            >
              <option value="ALL">Semua Tabel</option>
              <option value="employees">employees</option>
              <option value="glass_tips">glass_tips</option>
              <option value="payroll_periods">payroll_periods</option>
              <option value="attendance_daily_records">attendance_daily_records</option>
              <option value="vehicle_borrowing_requests">vehicle_borrowing_requests</option>
              <option value="leave_requests">leave_requests</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-gray-500 font-semibold">Aksi:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-xs font-medium focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
            >
              <option value="ALL">Semua Aksi</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="RPC">RPC</option>
            </select>
          </div>
        </div>

        <span className="text-gray-400 text-xs">
          Menampilkan {filteredLogs.length} dari {logs.length} entri
        </span>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat rekam jejak audit...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Tidak ada log yang cocok</p>
            <p className="text-xs text-gray-400 mt-1">Sesuaikan kata kunci pencarian atau filter Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3">Waktu (WIB)</th>
                  <th className="px-4 py-3">Tabel Objek</th>
                  <th className="px-4 py-3">Aksi</th>
                  <th className="px-4 py-3">Record ID</th>
                  <th className="px-4 py-3">Aktor / IP</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3 text-right">Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-800">
                      {l.table_name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          l.action === 'INSERT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : l.action === 'UPDATE'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : l.action === 'DELETE'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500">
                      {l.record_id ? l.record_id.slice(0, 12) + '...' : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{l.actor_id ? 'User: ' + l.actor_id.slice(0, 8) : 'Sistem / Anon'}</div>
                      <div className="font-mono text-[10px] text-gray-400">{l.ip_address || '127.0.0.1'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                      {l.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenDetail(l)}
                        className="px-2 py-1 text-xs text-kuk-maroon hover:bg-kuk-maroon-50 border border-kuk-maroon/20 rounded-md font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Diff</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail Diff */}
      {detailModalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">
                  Audit Snapshot — {selectedLog.table_name} ({selectedLog.action})
                </h2>
              </div>
              <button onClick={() => setDetailModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <div className="text-gray-400">Timestamp:</div>
                  <div className="font-mono font-bold text-gray-900">{new Date(selectedLog.created_at).toLocaleString('id-ID')}</div>
                </div>
                <div>
                  <div className="text-gray-400">Record ID:</div>
                  <div className="font-mono font-bold text-gray-900">{selectedLog.record_id || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-400">Aktor:</div>
                  <div className="text-gray-900 font-mono">{selectedLog.actor_id || 'System Service'}</div>
                </div>
                <div>
                  <div className="text-gray-400">Client IP:</div>
                  <div className="text-gray-900 font-mono">{selectedLog.ip_address || '127.0.0.1'}</div>
                </div>
              </div>

              {selectedLog.notes && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                  <span className="font-bold">Keterangan: </span>
                  {selectedLog.notes}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>Old Data (Data Lama)</span>
                  </div>
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-56">
                    {selectedLog.old_data ? JSON.stringify(selectedLog.old_data, null, 2) : '// Tidak ada data lama (INSERT)'}
                  </pre>
                </div>

                <div>
                  <div className="font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>New Data (Data Baru)</span>
                  </div>
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-56">
                    {selectedLog.new_data ? JSON.stringify(selectedLog.new_data, null, 2) : '// Record dihapus (DELETE)'}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setDetailModalOpen(false)}
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
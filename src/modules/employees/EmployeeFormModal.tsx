import React, { useState, useEffect } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { employeeService } from '@/services/dataService';
import type { Employee, Department, Position, WorkSchedule, EmploymentType, Gender, MaritalStatus } from '@/types/models';
import { X, UserPlus, Save, AlertCircle } from 'lucide-react';

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  employeeToEdit?: Employee | null;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  employeeToEdit,
}) => {
  const { activeUnit, activeUnitId } = useUnit();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [workScheduleId, setWorkScheduleId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender>('L');
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus>('SINGLE');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('PKWTT');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!isOpen || !activeUnitId) return;
    const currentUnitId = activeUnitId;
    async function loadMaster() {
      const [depts, pos, sch] = await Promise.all([
        employeeService.getDepartments(currentUnitId),
        employeeService.getPositions(currentUnitId),
        employeeService.getWorkSchedules(currentUnitId),
      ]);
      setDepartments(depts);
      setPositions(pos);
      setSchedules(sch);

      if (employeeToEdit) {
        setFullName(employeeToEdit.full_name);
        setEmployeeCode(employeeToEdit.employee_code);
        setDepartmentId(employeeToEdit.department_id);
        setPositionId(employeeToEdit.position_id);
        setWorkScheduleId(employeeToEdit.work_schedule_id);
        setEmail(employeeToEdit.email || '');
        setPhone(employeeToEdit.phone || '');
        setGender(employeeToEdit.gender);
        setMaritalStatus(employeeToEdit.marital_status);
        setEmploymentType(employeeToEdit.employment_type);
        setJoinDate(employeeToEdit.join_date);
      } else {
        setFullName('');
        setEmployeeCode(`EMP-${activeUnit?.code || 'UNIT'}-${Math.floor(100 + Math.random() * 900)}`);
        setDepartmentId(depts[0]?.id || '');
        setPositionId(pos[0]?.id || '');
        setWorkScheduleId(sch[0]?.id || '');
        setEmail('');
        setPhone('');
        setGender('L');
        setMaritalStatus('SINGLE');
        setEmploymentType('PKWTT');
        setJoinDate(new Date().toISOString().split('T')[0]);
      }
    }
    loadMaster();
  }, [isOpen, activeUnitId, employeeToEdit, activeUnit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId) {
      setError('Unit kerja aktif belum dipilih.');
      return;
    }
    if (!fullName.trim()) {
      setError('Nama lengkap karyawan wajib diisi.');
      return;
    }
    if (!departmentId || !positionId || !workScheduleId) {
      setError('Departemen, jabatan, dan jadwal kerja wajib dipilih.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload: Partial<Employee> = {
      id: employeeToEdit ? employeeToEdit.id : undefined,
      full_name: fullName.trim(),
      employee_code: employeeCode.trim(),
      department_id: departmentId,
      position_id: positionId,
      work_schedule_id: workScheduleId,
      email: email.trim() || null,
      phone: phone.trim() || null,
      gender,
      marital_status: maritalStatus,
      employment_type: employmentType,
      status: employeeToEdit ? employeeToEdit.status : 'ACTIVE',
      join_date: joinDate,
    };

    const res = await employeeService.saveEmployee(activeUnitId, payload);
    setLoading(false);

    if (res.success) {
      onSuccess(res.message);
      onClose();
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-kuk-gold" />
            <h2 className="font-bold text-base">
              {employeeToEdit ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Lengkap *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kode / NIP Karyawan *</label>
              <input
                type="text"
                required
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Departemen / Bagian *</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Jabatan / Posisi *</label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              >
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Jadwal Kerja Operasional *</label>
              <select
                value={workScheduleId}
                onChange={(e) => setWorkScheduleId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.start_time} - {s.end_time})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Status Ikatan Kerja</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              >
                <option value="PKWTT">PKWTT (Tetap)</option>
                <option value="PKWT">PKWT (Kontrak)</option>
                <option value="PROBATION">Probation (Percobaan)</option>
                <option value="INTERN">Magang (Intern)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal Bergabung</label>
              <input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nomor Telepon / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Menyimpan...' : 'Simpan Data'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

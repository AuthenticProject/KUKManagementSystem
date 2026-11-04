import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';
import { ShieldAlert } from 'lucide-react';

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback,
}) => {
  const { hasPermission } = useAuth();
  const { activeUnitId } = useUnit();

  const allowed = hasPermission(permission, activeUnitId);

  if (!allowed) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="p-8 text-center bg-white rounded-xl border border-gray-200 max-w-lg mx-auto my-12 shadow-sm">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Akses Ditolak</h3>
        <p className="text-sm text-gray-600 mb-4">
          Anda tidak memiliki izin (<code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{permission}</code>) untuk melihat data atau modul ini pada unit yang aktif.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};


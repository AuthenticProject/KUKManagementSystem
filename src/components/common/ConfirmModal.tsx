import React, { useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-[#FF0000]" />,
          iconBg: 'bg-red-50 border border-red-200',
          btn: 'bg-[#FF0000] hover:bg-[#CC0000] text-white focus:ring-[#FF0000]',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-[#996414]" />,
          iconBg: 'bg-[#FFF9D6] border border-[#FFE066]',
          btn: 'bg-[#FFCC00] hover:bg-[#E6B800] text-[#540000] font-bold focus:ring-[#FFCC00]',
        };
      case 'primary':
      default:
        return {
          icon: <Info className="w-5 h-5 text-[#540000]" />,
          iconBg: 'bg-[#FCE7E7] border border-[#F7C5C5]',
          btn: 'bg-[#540000] hover:bg-[#3B0000] text-white focus:ring-[#FFCC00]',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#E5E5E5] overflow-hidden transform transition-all animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-2.5 rounded-2xl shrink-0 ${styles.iconBg}`}>
              {styles.icon}
            </div>
            <div className="flex-1">
              <h3 id="confirm-modal-title" className="text-base font-bold text-gray-900 leading-tight font-display">
                {title}
              </h3>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                {message}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl transition-colors hover:bg-gray-100"
              aria-label="Tutup dialog konfirmasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-[#E5E5E5]">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors border border-[#E5E5E5] disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 select-none active:scale-[0.98] ${styles.btn}`}
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

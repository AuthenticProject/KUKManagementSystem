import React from 'react';
import { twMerge } from 'tailwind-merge';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className,
}) => {
  return (
    <div
      className={twMerge(
        'text-center py-12 px-4 rounded-2xl border border-dashed border-[#E5E5E5] bg-white flex flex-col items-center justify-center',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#540000]/5 text-[#540000] flex items-center justify-center mb-4">
        {icon || <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-sm mt-1">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

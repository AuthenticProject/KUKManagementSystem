import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'gold' | 'success' | 'warning' | 'danger' | 'neutral' | 'outline';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-semibold rounded-full select-none';

  const variants = {
    brand: 'bg-[#FCE7E7] text-[#540000] border border-[#F7C5C5]',
    gold: 'bg-[#FFF9D6] text-[#996414] border border-[#FFE066]',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200',
    danger: 'bg-red-50 text-red-800 border border-red-200',
    neutral: 'bg-gray-100 text-gray-700 border border-gray-200',
    outline: 'bg-white text-gray-700 border border-[#E5E5E5]',
  };

  const dots = {
    brand: 'bg-[#540000]',
    gold: 'bg-[#FFCC00]',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    neutral: 'bg-gray-400',
    outline: 'bg-gray-500',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-0.5 gap-1.5',
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))} {...props}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dots[variant])} />}
      {children}
    </span>
  );
};

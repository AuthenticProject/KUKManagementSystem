import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: 'none' | 'gold' | 'maroon';
}

export const Card: React.FC<CardProps> = ({ className, accent = 'none', children, ...props }) => {
  const accentClasses = {
    none: '',
    gold: 'border-t-2 border-t-[#FFCC00]',
    maroon: 'border-t-2 border-t-[#540000]',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'bg-white rounded-2xl border border-[#E5E5E5] shadow-brand-card transition-all duration-200',
          accentClasses[accent],
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  accent?: 'none' | 'gold' | 'maroon';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  accent = 'none',
  className,
}) => {
  return (
    <Card accent={accent} className={twMerge('p-5 sm:p-6', className)}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-[#540000]/5 text-[#540000] flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-display">
          {value}
        </div>

        {(subtitle || trend) && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            {trend && (
              <span
                className={clsx(
                  'font-bold',
                  trend.isPositive ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {trend.value}
              </span>
            )}
            {subtitle && <span className="text-gray-500">{subtitle}</span>}
          </div>
        )}
      </div>
    </Card>
  );
};

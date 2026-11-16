import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  unitBadge?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  badge,
  unitBadge,
  actions,
  breadcrumbs,
  className,
}) => {
  return (
    <div className={twMerge('mb-6 sm:mb-8', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-gray-300">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-[#540000] transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className={clsx(idx === breadcrumbs.length - 1 && 'font-semibold text-gray-800')}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {icon && <div className="p-2 bg-[#540000]/5 text-[#540000] rounded-xl">{icon}</div>}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-display">
              {title}
            </h1>
            {unitBadge && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#540000]/10 text-[#540000] border border-[#540000]/20">
                {unitBadge}
              </span>
            )}
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{subtitle}</p>}
        </div>

        {actions && <div className="flex items-center gap-2.5 shrink-0 flex-wrap">{actions}</div>}
      </div>

      <div className="mt-4 kuk-gold-line opacity-75" />
    </div>
  );
};

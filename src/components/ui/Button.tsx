import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus-visible:outline-2 focus-visible:outline-[#FFCC00] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variants = {
      primary: 'bg-[#540000] text-white hover:bg-[#3B0000] shadow-xs hover:shadow-brand active:bg-[#2E0000]',
      gold: 'bg-[#FFCC00] text-[#540000] font-bold hover:bg-[#E6B800] shadow-brand-gold hover:shadow-md active:bg-[#D4A000]',
      secondary: 'bg-[#F4F5F7] text-gray-800 border border-[#E5E5E5] hover:bg-[#EAEBED] hover:border-gray-300 active:bg-[#E0E2E6]',
      outline: 'bg-transparent text-[#540000] border border-[#540000] hover:bg-[#540000]/5 active:bg-[#540000]/10',
      destructive: 'bg-[#FF0000] text-white hover:bg-[#CC0000] shadow-xs active:bg-[#990000]',
      ghost: 'bg-transparent text-gray-700 hover:text-[#540000] hover:bg-[#540000]/5 active:bg-[#540000]/10',
    };

    const sizes = {
      xs: 'text-xs px-2.5 py-1 gap-1.5',
      sm: 'text-xs px-3 py-1.5 gap-2',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5 font-semibold',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';

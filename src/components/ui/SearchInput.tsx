import React from 'react';
import { Search } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  className,
  value,
  onChange,
  placeholder = 'Cari data...',
  ...props
}) => {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={twMerge(
          clsx(
            'w-full pl-10 pr-4 py-2 bg-white border border-[#E5E5E5] rounded-xl text-sm placeholder-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all',
            className
          )
        )}
        {...props}
      />
    </div>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={twMerge(
        'animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg',
        className
      )}
    />
  );
};

import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  disabled,
  className = '',
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-semibold transition-all rounded-lg text-sm px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0D173B]';

  const variants = {
    primary:
      'bg-[#E2D64B] hover:bg-[#ebd846] text-[#0D173B] shadow-lg shadow-[#E2D64B]/20 border border-[#E2D64B]/60 focus:ring-[#E2D64B]',
    secondary:
      'bg-[#0D173B]/80 hover:bg-[#4AB7E0]/15 text-[#F7F8FA] border border-[#4AB7E0]/40 focus:ring-[#4AB7E0]',
    danger:
      'bg-rose-600/90 hover:bg-rose-500 text-white border border-rose-500/40 focus:ring-rose-500',
    ghost:
      'bg-transparent hover:bg-[#4AB7E0]/10 text-slate-300 hover:text-[#F7F8FA] focus:ring-[#4AB7E0]',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#0D173B]" />
          <span>Processing...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

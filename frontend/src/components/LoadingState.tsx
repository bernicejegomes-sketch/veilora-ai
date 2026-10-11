import React from 'react';
import { Shield } from 'lucide-react';

interface LoadingStateProps {
  title: string;
  description?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ title, description }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-[#4AB7E0]/30 bg-[#0D173B] shadow-xl">
      <div className="relative mb-5">
        <div className="w-14 h-14 rounded-full border-2 border-[#4AB7E0]/20 border-t-[#E2D64B] animate-spin flex items-center justify-center" />
        <div className="absolute inset-0 flex items-center justify-center text-[#E2D64B]">
          <Shield className="w-5 h-5 animate-pulse" />
        </div>
      </div>
      <h3 className="text-base font-bold text-[#F7F8FA] mb-1.5">{title}</h3>
      {description && <p className="text-xs text-slate-300 max-w-sm">{description}</p>}
    </div>
  );
};

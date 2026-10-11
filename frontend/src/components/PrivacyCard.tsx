import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

interface PrivacyCardProps {
  title?: string;
  text?: string;
  className?: string;
  variant?: 'subtle' | 'highlight';
}

export const PrivacyCard: React.FC<PrivacyCardProps> = ({
  title = 'Your identity is not attached to your report.',
  text = "We use client-side cryptographic zero-knowledge proofs to verify you're an enrolled student without sending who you are.",
  className = '',
  variant = 'subtle',
}) => {
  if (variant === 'highlight') {
    return (
      <div
        className={`p-4 rounded-xl border border-[#4AB7E0]/40 bg-[#0D173B] text-[#F7F8FA] flex gap-3 items-start shadow-md shadow-[#0D173B]/50 ${className}`}
      >
        <div className="p-2 rounded-lg bg-[#4AB7E0]/15 text-[#4AB7E0] shrink-0 border border-[#4AB7E0]/30">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-[#F7F8FA] mb-0.5">{title}</h4>
          <p className="text-xs text-slate-300 leading-relaxed">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3.5 rounded-lg border border-[#4AB7E0]/20 bg-[#0D173B]/80 text-slate-300 flex gap-2.5 items-start text-xs ${className}`}
    >
      <Info className="w-4 h-4 text-[#4AB7E0] shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold text-[#F7F8FA]">{title} </span>
        <span className="text-slate-300">{text}</span>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Copy, Check, ArrowRight } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { PrivacyCard } from '../components/PrivacyCard';

export const SuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const trackingCode: string =
    (location.state as any)?.trackingCode || 'INC-DEMO-CONFIRMED';
  const topic: string = (location.state as any)?.topic || 'CAMPUS';

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    // Clear state from active report flow and return home
    navigate('/', { replace: true });
  };

  return (
    <PageContainer maxWidth="md">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-950/40">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#F7F8FA] mb-2">Your report is in.</h1>
        <p className="text-sm text-slate-300 max-w-sm mx-auto">
          Your report has been accepted into the anonymous review queue.
        </p>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl border border-[#4AB7E0]/30 bg-[#0D173B] shadow-xl mb-6">
        <div className="text-center mb-6">
          <span className="text-xs font-mono uppercase tracking-widest text-[#4AB7E0] block mb-2 font-bold">
            ONE-TIME TRACKING CODE
          </span>
          <div className="inline-flex items-center gap-3 bg-[#091029] border border-[#E2D64B]/40 px-5 py-3 rounded-xl shadow-inner">
            <span className="font-mono text-lg sm:text-xl font-bold tracking-widest text-[#E2D64B] select-all">
              {trackingCode}
            </span>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-[#0D173B] hover:bg-[#4AB7E0]/20 text-[#4AB7E0] hover:text-[#F7F8FA] transition-colors cursor-pointer border border-[#4AB7E0]/30"
              title="Copy tracking code"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-300 mt-3">
            Save this code if you need to reference this submission.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[#4AB7E0]/20 bg-[#091029] mb-6 space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-[#4AB7E0]/15">
            <span className="text-slate-400">Category</span>
            <span className="font-mono text-[#E2D64B] font-bold">{topic}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-[#4AB7E0]/15">
            <span className="text-slate-400">Queue Status</span>
            <span className="text-emerald-400 font-bold">QUEUED (Delayed Release)</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">Reporter Identity</span>
            <span className="text-slate-300 italic">None attached (Zero-Knowledge)</span>
          </div>
        </div>

        <Button
          onClick={handleDone}
          className="w-full py-3 flex items-center justify-center gap-2 text-base font-bold shadow-lg shadow-[#E2D64B]/20"
        >
          <span>Done</span>
          <ArrowRight className="w-4 h-4 text-[#0D173B]" />
        </Button>
      </div>

      <PrivacyCard
        variant="subtle"
        title="Session Separation:"
        text="Clicking 'Done' removes the active complaint text from your browser display. No persistent student profile is maintained on the server."
      />
    </PageContainer>
  );
};

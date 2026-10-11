import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowLeft, AlertCircle, ShieldAlert } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { PrivacyCard } from '../components/PrivacyCard';
import type { Topic } from '../services/cryptoEncoding';

export const ComplaintWritePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const initialTopic: Topic = (location.state as any)?.topic || 'FACULTY';
  const [topic] = useState<Topic>(initialTopic);
  const [text, setText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const characterCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = text.trim();
    if (!trimmed) {
      setErrorMsg('Please write your complaint before proceeding.');
      return;
    }

    if (trimmed.length < 10) {
      setErrorMsg('Please provide a little more detail (minimum 10 characters).');
      return;
    }

    // Pass topic and exact text to the review & proof generation screen
    navigate('/report/review', { state: { topic, text } });
  };

  return (
    <PageContainer maxWidth="lg">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/report')}
          className="text-xs text-slate-300 hover:text-[#E2D64B] flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Change Topic</span>
        </button>

        <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#4AB7E0]/15 text-[#4AB7E0] border border-[#4AB7E0]/30 font-semibold">
          TOPIC: {topic}
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F8FA] mb-2">Tell us what happened.</h1>
        <p className="text-sm text-slate-300">
          Describe the situation as clearly and accurately as possible.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs flex gap-3 items-start">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleReview} className="space-y-6">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Describe the issue clearly. Avoid including details that could identify you if they aren't necessary..."
            className="w-full bg-[#091029] border border-[#4AB7E0]/30 rounded-xl p-4 sm:p-5 text-sm sm:text-base text-[#F7F8FA] placeholder-slate-500 focus:outline-none focus:border-[#E2D64B] focus:ring-1 focus:ring-[#E2D64B] leading-relaxed resize-y min-h-[220px]"
            required
          />

          <div className="flex items-center justify-between px-2 pt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-[11px] text-[#4AB7E0]">
              <ShieldAlert className="w-3.5 h-3.5 text-[#E2D64B]" />
              Tip: avoid unnecessary details like names or specific timestamps.
            </span>
            <span className="font-mono text-slate-300">
              {characterCount} chars | {wordCount} words
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#4AB7E0]/20">
          <button
            type="button"
            onClick={() => navigate('/report')}
            className="text-xs text-slate-300 hover:text-[#F7F8FA] cursor-pointer w-full sm:w-auto text-center"
          >
            Cancel
          </button>

          <Button
            type="submit"
            className="w-full sm:w-auto px-6 py-3 flex items-center justify-center gap-2 text-base font-bold shadow-lg shadow-[#E2D64B]/20"
          >
            <span>Review & Submit</span>
            <ArrowRight className="w-4 h-4 text-[#0D173B]" />
          </Button>
        </div>
      </form>

      <div className="mt-8">
        <PrivacyCard
          variant="subtle"
          title="Byte-for-byte Message Binding:"
          text="Your exact written text is hashed client-side into the Semaphore proof message. The backend will verify that the received text matches this cryptographic hash exactly."
        />
      </div>
    </PageContainer>
  );
};

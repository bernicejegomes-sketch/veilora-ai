import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { PrivacyCard } from '../components/PrivacyCard';
import { requestOtp, enrollStudent } from '../services/api';
import {
  getOrCreateIdentity,
  setEnrolledStatus,
  addKnownCommitment,
} from '../services/identityStorage';

// Exact development roster entries from backend/src/config/roster.js
const DEMO_ROSTER: Record<string, { dob: string; name: string }> = {
  DEV001: { dob: '2007-01-01', name: 'Test Student One' },
  DEV002: { dob: '2007-02-02', name: 'Test Student Two' },
  DEV003: { dob: '2007-03-03', name: 'Test Student Three' },
  DEV004: { dob: '2007-04-04', name: 'Test Student Four' },
  DEV005: { dob: '2007-05-05', name: 'Test Student Five' },
};

export const EnrollPage: React.FC = () => {
  const navigate = useNavigate();

  const [rollNo, setRollNo] = useState('DEV001');
  const [dob, setDob] = useState('2007-01-01');
  const [name, setName] = useState('Test Student One');
  const [otp, setOtp] = useState('123456');

  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRollNoChange = (newRollNo: string) => {
    setRollNo(newRollNo);
    const trimmedUpper = newRollNo.trim().toUpperCase();
    if (DEMO_ROSTER[trimmedUpper]) {
      setDob(DEMO_ROSTER[trimmedUpper].dob);
      setName(DEMO_ROSTER[trimmedUpper].name);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!rollNo.trim()) {
      setErrorMsg('Please enter your student Roll Number.');
      return;
    }

    setIsRequestingOtp(true);
    try {
      await requestOtp(rollNo.trim());
      setSuccessMsg('OTP dispatched! In development mode, use standard dev OTP: 123456.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check your details and try again.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!rollNo || !dob || !name || !otp) {
      setErrorMsg('All fields are required for student eligibility verification.');
      return;
    }

    setIsEnrolling(true);
    try {
      // 1. Client-Side Semaphore Identity generation
      // The secret NEVER leaves the client.
      const identity = getOrCreateIdentity();
      const commitment = identity.commitment.toString();

      // 2. Submit ONLY the public commitment and student credentials
      await enrollStudent({
        rollNo: rollNo.trim(),
        dob: dob.trim(),
        name: name.trim(),
        otp: otp.trim(),
        commitment,
      });

      // 3. Mark client session enrolled and record commitment
      setEnrolledStatus(true);
      addKnownCommitment(commitment);

      // 4. Proceed to Language Selection screen
      navigate('/language');
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check your details and try again.');
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <PageContainer maxWidth="md">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-[#E2D64B]/15 border border-[#E2D64B]/30 text-[#E2D64B] flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F8FA] mb-2">
          Verify your student status
        </h1>
        <p className="text-sm text-slate-300">
          One-time verification. Your student identity is used only to confirm eligibility.
        </p>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl border border-[#4AB7E0]/30 bg-[#0D173B] shadow-xl mb-6">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs flex gap-3 items-start">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Verification Error:</span> {errorMsg}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 text-emerald-300 text-xs flex gap-3 items-start">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>{successMsg}</div>
          </div>
        )}

        <form onSubmit={handleEnroll} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Roll Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={rollNo}
                onChange={(e) => handleRollNoChange(e.target.value)}
                placeholder="e.g. DEV001"
                className="flex-1 bg-[#091029] border border-[#4AB7E0]/30 rounded-lg px-3.5 py-2.5 text-sm text-[#F7F8FA] placeholder-slate-500 focus:outline-none focus:border-[#E2D64B] font-mono"
                required
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleRequestOtp}
                isLoading={isRequestingOtp}
                className="shrink-0 text-xs"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1 text-[#4AB7E0]" />
                Request OTP
              </Button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Demo presets: DEV001 through DEV005
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Date of Birth
              </label>
              <input
                type="text"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full bg-[#091029] border border-[#4AB7E0]/30 rounded-lg px-3.5 py-2.5 text-sm text-[#F7F8FA] placeholder-slate-500 focus:outline-none focus:border-[#E2D64B] font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="As per student ID"
                className="w-full bg-[#091029] border border-[#4AB7E0]/30 rounded-lg px-3.5 py-2.5 text-sm text-[#F7F8FA] placeholder-slate-500 focus:outline-none focus:border-[#E2D64B]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              One-Time Password (OTP)
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit OTP"
              className="w-full bg-[#091029] border border-[#4AB7E0]/30 rounded-lg px-3.5 py-2.5 text-sm text-[#F7F8FA] placeholder-slate-500 focus:outline-none focus:border-[#E2D64B] font-mono tracking-widest"
              required
            />
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              isLoading={isEnrolling}
              className="w-full py-3 flex items-center justify-center gap-2 text-base font-bold shadow-lg shadow-[#E2D64B]/20"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4 text-[#0D173B]" />
            </Button>
          </div>
        </form>
      </div>

      <PrivacyCard
        variant="subtle"
        title="Zero-Knowledge Identity Protection:"
        text="A cryptographic Semaphore identity is created client-side in your browser. Only the public commitment is sent to the server. Your secret identity key is never revealed or transmitted."
      />
    </PageContainer>
  );
};

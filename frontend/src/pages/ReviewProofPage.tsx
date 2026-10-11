import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Group, generateProof } from '@semaphore-protocol/core';
import {
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
  FileText,
  Lock,
} from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { PrivacyCard } from '../components/PrivacyCard';
import { getComplaintContext, getSemaphoreGroup, submitComplaint } from '../services/api';
import {
  encodeComplaintMessage,
  encodeScope,
  type Topic,
} from '../services/cryptoEncoding';
import { getSavedIdentity } from '../services/identityStorage';

export const ReviewProofPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const topic: Topic = (location.state as any)?.topic || 'FACULTY';
  const text: string = (location.state as any)?.text || '';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!text) {
    return (
      <PageContainer maxWidth="md">
        <div className="p-8 text-center bg-[#0D173B] rounded-2xl border border-[#4AB7E0]/30">
          <p className="text-slate-300 mb-4">No report content found.</p>
          <Button onClick={() => navigate('/report')}>Return to Report</Button>
        </div>
      </PageContainer>
    );
  }

  const handleGenerateAndSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Retrieve the client-side Identity
      setLoadingPhase('Accessing client-side identity...');
      const identity = getSavedIdentity();
      if (!identity) {
        throw new Error(
          'Student identity not found on this device. Please complete verification first.'
        );
      }

      // 2. Fetch authoritative backend complaint context (serverDay)
      setLoadingPhase("Fetching server's authoritative date & scope context...");
      const context = await getComplaintContext();
      if (!context.ok || !context.serverDay) {
        throw new Error("Unable to retrieve server's authoritative date.");
      }

      // 3. Derive cryptographic Message and Scope strictly per contract
      setLoadingPhase('Calculating SHA-256 message and scope commitments...');
      const message = await encodeComplaintMessage(text);
      const scope = await encodeScope(topic, context.serverDay);

      // 4. Fetch the authoritative public group commitments from backend
      setLoadingPhase('Fetching authoritative Semaphore group commitments...');
      const groupData = await getSemaphoreGroup();
      if (!groupData.ok || !Array.isArray(groupData.members) || groupData.members.length === 0) {
        throw new Error('No registered commitments found in the campus Semaphore group.');
      }

      // Construct identical Semaphore Group in the exact backend database rowid order
      const group = new Group();
      for (const member of groupData.members) {
        group.addMember(BigInt(member));
      }

      // Ensure this client's commitment is enrolled in the group
      const myCommitmentBigInt = identity.commitment;
      if (group.indexOf(myCommitmentBigInt) === -1) {
        throw new Error(
          'Your student commitment is not registered in the campus group. Please verify student status first.'
        );
      }

      // 5. Generate client-side Zero-Knowledge Proof using Semaphore v4
      setLoadingPhase(
        'Generating zero-knowledge Semaphore proof... (Groth16 mathematical pairing)'
      );
      const proof = await generateProof(identity, group, message, scope);

      // 6. Submit proof, topicId, and EXACT original text to backend
      setLoadingPhase('Submitting anonymous proof and report to server...');
      const result = await submitComplaint({
        proof,
        topicId: topic,
        text,
      });

      if (result.ok && result.trackingCode) {
        // Navigate to success screen with one-time tracking code
        navigate('/report/success', {
          state: { trackingCode: result.trackingCode, topic },
          replace: true,
        });
      } else {
        throw new Error(result.error || 'Submission failed');
      }
    } catch (err: any) {
      console.error('Proof submission failed:', err);
      let userFriendly = err.message || 'We could not submit your report.';
      if (err.status === 409) {
        userFriendly =
          'You have already submitted a report for this topic today. Please wait for the next calendar day.';
      } else if (err.status === 422) {
        userFriendly =
          'Your complaint text did not pass basic content policy guidelines (e.g. text too short or contains spam links).';
      }
      setErrorMsg(userFriendly);
    } finally {
      setIsSubmitting(false);
      setLoadingPhase('');
    }
  };

  return (
    <PageContainer maxWidth="lg">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/report/write', { state: { topic, text } })}
          disabled={isSubmitting}
          className="text-xs text-slate-300 hover:text-[#E2D64B] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Edit Report</span>
        </button>

        <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#4AB7E0]/15 text-[#4AB7E0] border border-[#4AB7E0]/30 font-semibold">
          PRE-SUBMISSION REVIEW
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F8FA] mb-2">Ready to submit?</h1>
        <p className="text-sm text-slate-300">
          Review your report before generating the zero-knowledge proof.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl border border-rose-500/40 bg-[#0D173B] text-rose-300 text-xs flex gap-3 items-start shadow-lg">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {isSubmitting ? (
        <LoadingState
          title="Creating your privacy proof..."
          description={`${loadingPhase || 'This may take a few seconds.'} Mathematical pairing cryptography is running in your browser.`}
        />
      ) : (
        <div className="space-y-6">
          {/* Report Preview Card */}
          <div className="p-6 rounded-2xl border border-[#4AB7E0]/30 bg-[#0D173B] shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#4AB7E0]/20 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#4AB7E0]" />
                <span className="text-xs font-bold text-[#F7F8FA] uppercase tracking-wider">
                  Report Category
                </span>
              </div>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-[#4AB7E0]/20 text-[#4AB7E0] font-bold">
                {topic}
              </span>
            </div>

            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Complaint Text Preview
            </div>
            <div className="p-4 rounded-xl bg-[#091029] border border-[#4AB7E0]/20 text-sm text-[#F7F8FA] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto font-sans">
              {text}
            </div>
          </div>

          {/* Zero Knowledge Cryptographic Card */}
          <div className="p-6 rounded-2xl border border-[#E2D64B]/40 bg-[#0D173B] shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E2D64B]/15 border border-[#E2D64B]/40 text-[#E2D64B] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F7F8FA] mb-1">Zero-knowledge proof</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
                  We'll prove that you're an enrolled student without sending your student identity
                  with this report.
                </p>
                <div className="flex flex-wrap gap-3 text-[11px] font-mono text-[#4AB7E0]">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#4AB7E0]" /> Client-Side Groth16 Proof
                  </span>
                  <span>•</span>
                  <span>SHA-256 Text Binding</span>
                  <span>•</span>
                  <span>Topic Day Nullifier</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#4AB7E0]/20">
            <button
              type="button"
              onClick={() => navigate('/report/write', { state: { topic, text } })}
              className="text-xs text-slate-300 hover:text-[#F7F8FA] cursor-pointer w-full sm:w-auto text-center"
            >
              Back to Edit
            </button>

            <Button
              onClick={handleGenerateAndSubmit}
              className="w-full sm:w-auto px-8 py-3 flex items-center justify-center gap-2 text-base shadow-xl shadow-[#E2D64B]/20"
            >
              <ShieldCheck className="w-5 h-5 mr-1 text-[#0D173B]" />
              <span>Generate Proof & Submit</span>
            </Button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <PrivacyCard
          variant="subtle"
          title="Authoritative Scope Authority:"
          text="The server's date and group commitments are fetched beforehand to ensure the proof strictly matches the backend's accepted Semaphore tree."
        />
      </div>
    </PageContainer>
  );
};

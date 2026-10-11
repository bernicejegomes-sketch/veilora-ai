import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { PrivacyCard } from '../components/PrivacyCard';
import { isEnrolled } from '../services/identityStorage';

export const LandingPage: React.FC = () => {
  const enrolled = isEnrolled();

  return (
    <PageContainer maxWidth="6xl">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center py-6 sm:py-12">
        <div className="lg:col-span-7 flex flex-col items-start">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#4AB7E0]/30 bg-[#4AB7E0]/10 text-[#4AB7E0] text-xs font-mono mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E2D64B] animate-pulse" />
            ZERO-KNOWLEDGE COLLEGE REPORTING
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#F7F8FA] tracking-tight leading-[1.1] mb-6">
            Speak up. <br />
            <span className="text-[#E2D64B]">
              Stay separated
            </span>{' '}
            from your identity.
          </h1>

          <p className="text-slate-300 text-base sm:text-lg mb-8 max-w-xl leading-relaxed">
            A privacy-preserving reporting system for verified college students. Prove you're an
            enrolled student without revealing who you are to the complaint server.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-10">
            <Link to={enrolled ? '/report' : '/enroll'} className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto px-6 py-3 text-base flex items-center justify-center gap-2">
                <span>Start a Report</span>
                <ArrowRight className="w-4 h-4 text-[#0D173B]" />
              </Button>
            </Link>

            <a href="#how-it-works" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto px-6 py-3 text-base">
                How it works
              </Button>
            </a>
          </div>

          <PrivacyCard
            variant="subtle"
            title="Privacy by design:"
            text="Your identity is not attached to your report. Proof generation happens entirely in your browser."
            className="w-full max-w-xl"
          />
        </div>

        {/* Right Conceptual Architecture Card */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-md p-6 rounded-2xl border border-[#4AB7E0]/30 bg-[#0D173B] relative overflow-hidden shadow-2xl shadow-[#0D173B]/80">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#4AB7E0]/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-[#4AB7E0]/20 mb-6">
              <span className="text-xs font-mono text-[#4AB7E0]">CRYPTOGRAPHIC BOUNDARY</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3 h-3" /> VERIFIED
              </span>
            </div>

            {/* Step A: Identity */}
            <div className="p-4 rounded-xl border border-[#4AB7E0]/20 bg-[#091029] mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#4AB7E0]/15 text-[#4AB7E0] flex items-center justify-center border border-[#4AB7E0]/30">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#F7F8FA] uppercase tracking-wider">
                    Student Identity
                  </div>
                  <div className="text-[11px] text-slate-300">Roll No + DOB verified once</div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-[#4AB7E0] bg-[#4AB7E0]/15 px-2 py-1 rounded font-semibold border border-[#4AB7E0]/20">
                Isolated
              </span>
            </div>

            {/* Separation Arrow */}
            <div className="flex flex-col items-center my-2">
              <div className="w-0.5 h-6 bg-gradient-to-b from-[#4AB7E0] to-[#E2D64B]" />
              <div className="px-3 py-1 rounded-full bg-[#0D173B] border border-[#E2D64B]/40 text-[10px] font-mono text-[#E2D64B] my-1 shadow-sm font-bold">
                Zero-Knowledge Proof (Semaphore)
              </div>
              <div className="w-0.5 h-6 bg-gradient-to-b from-[#E2D64B] to-emerald-400" />
            </div>

            {/* Step B: Anonymous Report */}
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#F7F8FA] uppercase tracking-wider">
                    Anonymous Report
                  </div>
                  <div className="text-[11px] text-emerald-300">
                    Topic + Text only. No student link.
                  </div>
                </div>
              </div>
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="mt-6 pt-4 border-t border-[#4AB7E0]/20 flex items-center justify-between text-[11px] text-slate-300">
              <span>Campus Scope</span>
              <span className="font-mono text-[#E2D64B] font-semibold">FACULTY / INFRA / OTHER</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works 3-Step Section */}
      <section id="how-it-works" className="py-16 sm:py-24 border-t border-[#4AB7E0]/20">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F7F8FA] mb-4">How it works</h2>
          <p className="text-sm sm:text-base text-slate-300">
            A simple three-step process built to separate who you are from what you report.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl border border-[#4AB7E0]/20 bg-[#0D173B] flex flex-col justify-between shadow-lg">
            <div>
              <span className="font-mono text-3xl font-black text-[#E2D64B] mb-4 block">01</span>
              <h3 className="text-lg font-bold text-[#F7F8FA] mb-2">Verify</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Prove you're an enrolled student using your roll number and a one-time OTP.
                Verification confirms eligibility once.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-[#4AB7E0]/20 bg-[#0D173B] flex flex-col justify-between shadow-lg">
            <div>
              <span className="font-mono text-3xl font-black text-[#4AB7E0] mb-4 block">02</span>
              <h3 className="text-lg font-bold text-[#F7F8FA] mb-2">Report</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Share what happened without attaching your identity. Pick from Faculty,
                Infrastructure, or Other.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-[#4AB7E0]/20 bg-[#0D173B] flex flex-col justify-between shadow-lg">
            <div>
              <span className="font-mono text-3xl font-black text-[#E2D64B] mb-4 block">03</span>
              <h3 className="text-lg font-bold text-[#F7F8FA] mb-2">Submit</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Your browser calculates a mathematical proof. Your report enters the review queue
                with an unmapped tracking code.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Model Section */}
      <section id="privacy-model" className="py-12 border-t border-[#4AB7E0]/20 mb-6">
        <div className="p-8 rounded-2xl border border-[#4AB7E0]/30 bg-[#0D173B] flex flex-col md:flex-row gap-8 items-start justify-between shadow-xl">
          <div>
            <h3 className="text-xl font-bold text-[#F7F8FA] mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#E2D64B]" />
              Our Privacy Commitment
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed mb-4">
              The backend database strictly isolates student roster information from submitted reports.
              There is no foreign key or correlation timestamp connecting who submitted what.
            </p>
            <div className="flex flex-wrap gap-4 text-xs font-mono text-[#4AB7E0]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E2D64B]" /> No IP Logging
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E2D64B]" /> Client-Side Proofs
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E2D64B]" /> Rate-Limited by Daily Nullifier
              </span>
            </div>
          </div>

          <Link to={enrolled ? '/report' : '/enroll'} className="shrink-0">
            <Button className="px-5 py-2.5">
              {enrolled ? 'Proceed to Report' : 'Get Verified Now'}
            </Button>
          </Link>
        </div>
      </section>
    </PageContainer>
  );
};

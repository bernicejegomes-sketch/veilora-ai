import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock } from 'lucide-react';
import { isEnrolled } from '../services/identityStorage';
import { SectionLink } from './SectionLink';

export const Navbar: React.FC = () => {
  const enrolled = isEnrolled();

  return (
    <nav className="w-full border-b border-[#4AB7E0]/20 bg-[#0D173B]/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-[#E2D64B]/15 border border-[#E2D64B]/40 flex items-center justify-center text-[#E2D64B] group-hover:border-[#E2D64B] transition-colors">
            <Shield className="w-5 h-5" />
          </div>
          <span className="font-bold tracking-wider text-lg text-[#F7F8FA] font-mono flex items-center gap-1.5">
            INCOGNITO
            <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-[#4AB7E0]/15 text-[#4AB7E0] border border-[#4AB7E0]/30 font-semibold">
              CAMPUS
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-6 text-sm">
          <SectionLink
            sectionId="how-it-works"
            className="text-slate-300 hover:text-[#E2D64B] transition-colors hidden sm:inline-block font-medium"
          >
            How it works
          </SectionLink>
          <SectionLink
            sectionId="privacy-model"
            className="text-slate-300 hover:text-[#4AB7E0] transition-colors hidden sm:inline-block font-medium"
          >
            Privacy
          </SectionLink>
          <Link
            to="/insights"
            className="text-slate-300 hover:text-[#E2D64B] transition-colors hidden sm:inline-block font-medium"
          >
            AI Insights
          </Link>

          {enrolled ? (
            <Link
              to="/report"
              className="px-4 py-2 rounded-lg bg-[#E2D64B] text-[#0D173B] font-bold hover:bg-[#ebd846] transition-all shadow-md shadow-[#E2D64B]/20 text-xs sm:text-sm cursor-pointer"
            >
              Start Report
            </Link>
          ) : (
            <Link
              to="/enroll"
              className="px-4 py-2 rounded-lg bg-[#0D173B] border border-[#4AB7E0]/40 text-[#F7F8FA] font-medium hover:border-[#4AB7E0] hover:bg-[#4AB7E0]/10 transition-all flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-[#4AB7E0]" />
              Verify Student
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

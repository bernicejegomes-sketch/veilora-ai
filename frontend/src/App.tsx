import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { EnrollPage } from './pages/EnrollPage';
import { LanguagePage } from './pages/LanguagePage';
import { ReportTopicPage } from './pages/ReportTopicPage';
import { ComplaintWritePage } from './pages/ComplaintWritePage';
import { ReviewProofPage } from './pages/ReviewProofPage';
import { SuccessPage } from './pages/SuccessPage';
import { InsightsPage } from './pages/InsightsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#07090e] text-[#f1f5f9] flex flex-col font-sans">
        <Navbar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/enroll" element={<EnrollPage />} />
            <Route path="/language" element={<LanguagePage />} />
            <Route path="/report" element={<ReportTopicPage />} />
            <Route path="/report/write" element={<ComplaintWritePage />} />
            <Route path="/report/review" element={<ReviewProofPage />} />
            <Route path="/report/success" element={<SuccessPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;

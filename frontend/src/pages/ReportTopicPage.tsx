import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, HelpCircle } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { TopicCard } from '../components/TopicCard';
import { Button } from '../components/Button';
import { PrivacyCard } from '../components/PrivacyCard';
import type { Topic } from '../services/cryptoEncoding';

export const ReportTopicPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTopic, setSelectedTopic] = useState<Topic>('FACULTY');

  const handleContinue = () => {
    // Navigate to write page with selected topic in navigation state
    navigate('/report/write', { state: { topic: selectedTopic } });
  };

  return (
    <PageContainer maxWidth="xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F7F8FA] mb-3">
          What's on your mind?
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
          Your report will be submitted without attaching your student identity. Select the category
          that best represents the issue.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <TopicCard
          topic="FACULTY"
          title="Faculty"
          description="Report concerns involving teaching, conduct, grading, or faculty interaction."
          isSelected={selectedTopic === 'FACULTY'}
          onSelect={(t) => setSelectedTopic(t)}
        />

        <TopicCard
          topic="INFRASTRUCTURE"
          title="Infrastructure"
          description="Report issues with classrooms, labs, facilities, equipment, or campus infrastructure."
          isSelected={selectedTopic === 'INFRASTRUCTURE'}
          onSelect={(t) => setSelectedTopic(t)}
        />

        <TopicCard
          topic="OTHER"
          title="Other"
          description="Anything else affecting your student experience."
          isSelected={selectedTopic === 'OTHER'}
          onSelect={(t) => setSelectedTopic(t)}
        />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-2xl border border-[#4AB7E0]/30 bg-[#0D173B] shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#4AB7E0]/15 text-[#4AB7E0] flex items-center justify-center border border-[#4AB7E0]/30 shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="text-xs sm:text-sm text-slate-200">
            Selected Topic:{' '}
            <span className="font-mono font-bold text-[#E2D64B] uppercase bg-[#091029] border border-[#4AB7E0]/20 px-2.5 py-1 rounded">
              {selectedTopic}
            </span>
          </div>
        </div>

        <Button
          onClick={handleContinue}
          className="w-full sm:w-auto px-6 py-2.5 flex items-center justify-center gap-2 font-bold"
        >
          <span>Continue to Write Report</span>
          <ArrowRight className="w-4 h-4 text-[#0D173B]" />
        </Button>
      </div>

      <div className="mt-8">
        <PrivacyCard
          variant="subtle"
          title="Topic Scope Isolation:"
          text="Each topic creates an independent rate-limiting scope for the day. Submitting for Infrastructure does not prevent you from reporting a Faculty issue on the same day."
        />
      </div>
    </PageContainer>
  );
};

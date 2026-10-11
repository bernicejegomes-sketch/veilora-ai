import React from 'react';
import { GraduationCap, Building2, HelpCircle } from 'lucide-react';
import type { Topic } from '../services/cryptoEncoding';

interface TopicCardProps {
  topic: Topic;
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: (topic: Topic) => void;
}

export const TopicCard: React.FC<TopicCardProps> = ({
  topic,
  title,
  description,
  isSelected,
  onSelect,
}) => {
  const icons = {
    FACULTY: GraduationCap,
    INFRASTRUCTURE: Building2,
    OTHER: HelpCircle,
  };

  const Icon = icons[topic];

  return (
    <div
      onClick={() => onSelect(topic)}
      className={`p-6 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
        isSelected
          ? 'border-[#E2D64B] bg-[#0D173B] shadow-xl shadow-[#E2D64B]/15 ring-2 ring-[#E2D64B]/80'
          : 'border-[#4AB7E0]/20 bg-[#0D173B]/70 hover:border-[#4AB7E0]/50 hover:bg-[#0D173B]'
      }`}
    >
      <div>
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors ${
            isSelected
              ? 'bg-[#E2D64B] text-[#0D173B]'
              : 'bg-[#4AB7E0]/15 text-[#4AB7E0] border border-[#4AB7E0]/30'
          }`}
        >
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-[#F7F8FA] mb-2">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{description}</p>
      </div>

      <div className="mt-6 flex items-center justify-between pt-4 border-t border-[#4AB7E0]/15">
        <span className="text-[11px] font-mono tracking-wider text-slate-400">{topic}</span>
        <span
          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
            isSelected
              ? 'bg-[#E2D64B] text-[#0D173B]'
              : 'text-[#4AB7E0] bg-[#4AB7E0]/10 border border-[#4AB7E0]/20'
          }`}
        >
          {isSelected ? 'Selected' : 'Select'}
        </span>
      </div>
    </div>
  );
};

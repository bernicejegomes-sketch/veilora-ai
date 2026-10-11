import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Languages, ArrowRight, Check } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { setSavedLanguage, getSavedLanguage } from '../services/identityStorage';

export const LanguagePage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLang, setSelectedLang] = useState(getSavedLanguage() || 'en');

  // Options ONLY: English, Hindi, Marathi. (Gujarati explicitly excluded per spec)
  const languages = [
    { id: 'en', name: 'English', native: 'English', desc: 'Standard campus reporting' },
    { id: 'hi', name: 'हिन्दी', native: 'Hindi', desc: 'गोपनीय छात्र रिपोर्टिंग' },
    { id: 'mr', name: 'मराठी', native: 'Marathi', desc: 'गोपनीय तक्रार नोंदणी' },
  ];

  const handleContinue = () => {
    setSavedLanguage(selectedLang);
    navigate('/report');
  };

  return (
    <PageContainer maxWidth="md">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-[#E2D64B]/15 border border-[#E2D64B]/30 text-[#E2D64B] flex items-center justify-center mx-auto mb-4">
          <Languages className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F8FA] mb-2">
          Namaste 🙏 <br /> Choose your preferred language
        </h1>
        <p className="text-sm text-slate-300">
          Select the language you feel most comfortable reading and reporting in.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {languages.map((lang) => {
          const isSelected = selectedLang === lang.id;
          return (
            <div
              key={lang.id}
              onClick={() => setSelectedLang(lang.id)}
              className={`p-4 sm:p-5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                isSelected
                  ? 'border-[#E2D64B] bg-[#0D173B] ring-2 ring-[#E2D64B] shadow-md shadow-[#E2D64B]/15'
                  : 'border-[#4AB7E0]/20 bg-[#0D173B]/70 hover:border-[#4AB7E0]/50 hover:bg-[#0D173B]'
              }`}
            >
              <div>
                <div className="text-base font-bold text-[#F7F8FA] mb-0.5">{lang.name}</div>
                <div className="text-xs text-slate-300">{lang.desc}</div>
              </div>

              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                  isSelected
                    ? 'border-[#E2D64B] bg-[#E2D64B] text-[#0D173B]'
                    : 'border-[#4AB7E0]/30 bg-[#091029] text-transparent'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </div>
            </div>
          );
        })}
      </div>

      <Button
        onClick={handleContinue}
        className="w-full py-3 flex items-center justify-center gap-2 text-base font-bold"
      >
        <span>Proceed to Report Dashboard</span>
        <ArrowRight className="w-4 h-4 text-[#0D173B]" />
      </Button>
    </PageContainer>
  );
};

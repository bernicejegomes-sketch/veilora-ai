import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '6xl';
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
  maxWidth = 'lg',
}) => {
  const maxClass = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
    '6xl': 'max-w-6xl',
  }[maxWidth];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      <main className={`w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 ${maxClass} ${className}`}>
        {children}
      </main>

      <footer className="w-full border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>Built for safer student feedback. Your identity is not attached to your report.</p>
      </footer>
    </div>
  );
};

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface SectionLinkProps {
  sectionId: string;
  className?: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}

/**
 * Navigates to a landing-page section from ANY route.
 *
 * The landing page is the only page that owns the `#how-it-works` and
 * `#privacy-model` sections, so a plain `<a href="#...">` silently does
 * nothing when the user is on another route (e.g. /insights). This component
 * always routes back to `/` with the target hash, and the LandingPage scrolls
 * to that section once rendered. Using the location hash keeps browser
 * Back/Forward navigation consistent.
 */
export const SectionLink: React.FC<SectionLinkProps> = ({
  sectionId,
  className,
  children,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToSection = () => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (onNavigate) onNavigate();

    const targetHash = `#${sectionId}`;
    if (location.pathname === '/') {
      if (location.hash !== targetHash) {
        navigate({ pathname: '/', hash: targetHash });
      } else {
        scrollToSection();
      }
    } else {
      navigate({ pathname: '/', hash: targetHash });
    }
  };

  return (
    <a href={`/#${sectionId}`} className={className} onClick={handleClick}>
      {children}
    </a>
  );
};

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export default function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);
  const ticking = useRef(false);

  const updateProgress = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      setProgress(Math.min((scrollTop / docHeight) * 100, 100));
    }
    ticking.current = false;
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(updateProgress);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [updateProgress]);

  return (
    <div className="fixed top-0 left-0 z-50 h-[3px] w-full pointer-events-none">
      <div
        className="h-full bg-primary transition-[width] duration-100 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

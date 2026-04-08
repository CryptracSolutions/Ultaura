'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const HeroDashboardPreview = dynamic(
  () =>
    import('./HeroDashboardPreview').then((mod) => ({
      default: mod.HeroDashboardPreview,
    })),
  { ssr: false },
);

/**
 * On mobile (<1024px) the dashboard preview sits below the fold,
 * so we defer mounting until it's near the viewport. On desktop
 * it's visible immediately so we mount right away.
 */
export function LazyHeroDashboardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    // Desktop (lg breakpoint = 1024px): mount immediately
    if (window.innerWidth >= 1024) {
      setShouldMount(true);
      return;
    }

    // Mobile: mount when near viewport
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldMount(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="min-h-[300px]">
      {shouldMount ? <HeroDashboardPreview /> : null}
    </div>
  );
}

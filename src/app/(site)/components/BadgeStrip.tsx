'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';

const badges = [
  { src: '/badges/1-hipaa-compliant.png', alt: 'HIPAA Compliant', height: 90 },
  { src: '/badges/5-age-friendly-badge.png', alt: 'Age Friendly', height: 76 },
  { src: '/badges/3-aarp-logo.png', alt: 'AARP', height: 83 },
  { src: '/badges/6-certified-provider.png', alt: 'Certified Provider', height: 76 },
  { src: '/badges/4-ncoa-logo.png', alt: 'National Council on Aging', height: 83 },
  { src: '/badges/2-soc2-compliant.png', alt: 'SOC 2 Compliant', height: 99 },
];

export function BadgeStrip() {
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const [repeatCount, setRepeatCount] = useState(2);
  const [marqueeDistance, setMarqueeDistance] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !groupRef.current) {
      return;
    }

    const update = () => {
      const containerWidth = containerRef.current?.offsetWidth ?? 0;
      const groupWidth = groupRef.current?.scrollWidth ?? 0;

      if (!containerWidth || !groupWidth) {
        return;
      }

      const neededRepeats = Math.max(2, Math.ceil((containerWidth * 2) / groupWidth));

      setRepeatCount((prev) => (prev === neededRepeats ? prev : neededRepeats));
      setMarqueeDistance((prev) => (prev === groupWidth ? prev : groupWidth));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(containerRef.current);
    observer.observe(groupRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-12 overflow-hidden relative isolate bg-background" style={{ zIndex: 10 }}>
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-1 * var(--marquee-distance)));
          }
        }
        .marquee-track {
          animation: marquee 40s linear infinite;
          will-change: transform;
        }
      `}</style>

      <div ref={containerRef} className="relative flex overflow-hidden py-0">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'oklch(0.96 0.025 180 / 0.86)',
            boxShadow:
              'inset 0 2px 0 oklch(0.75 0.12 180 / 0.95), inset 0 -2px 0 oklch(0.75 0.12 180 / 0.95), 0 12px 36px -24px oklch(0.75 0.12 180 / 0.55)',
          }}
        />
        <div
          className="marquee-track relative z-10 flex w-max"
          style={{ '--marquee-distance': `${marqueeDistance}px` } as CSSProperties}
        >
          {Array.from({ length: repeatCount }).map((_, groupIndex) => (
            <div
              key={`group-${groupIndex}`}
              ref={groupIndex === 0 ? groupRef : undefined}
              className="flex shrink-0 items-center gap-20 pr-20"
              aria-hidden={groupIndex !== 0}
            >
              {badges.map((badge, index) => (
                <img
                  key={`${groupIndex}-${index}`}
                  src={badge.src}
                  alt={badge.alt}
                  height={badge.height}
                  className="w-auto"
                  style={{
                    height: badge.height,
                    filter: 'none',
                    transform: 'translateZ(0)',
                    imageRendering: '-webkit-optimize-contrast',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useRef, useEffect, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { FadeInWhenVisible } from './MotionWrappers';

const STATS = [
  { value: 2400, suffix: '+', label: 'Calls completed' },
  { value: 850, suffix: '+', label: 'Families trust Ultaura' },
  { value: 4.9, suffix: '', label: 'Average rating' },
  { value: 98, suffix: '%', label: 'Pickup rate' },
];

function AnimatedNumber({
  value,
  suffix,
}: {
  value: number;
  suffix: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const prefersReducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(0);
  const isDecimal = value % 1 !== 0;

  useEffect(() => {
    if (!isInView) return;
    if (prefersReducedMotion) {
      setDisplayed(value);
      return;
    }

    const duration = 1400;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * value;
      setDisplayed(isDecimal ? Math.round(current * 10) / 10 : Math.floor(current));

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setDisplayed(value);
      }
    };

    requestAnimationFrame(tick);
  }, [isInView, isDecimal, prefersReducedMotion, value]);

  const formatted = isDecimal ? displayed.toFixed(1) : displayed.toString();

  return (
    <span ref={ref}>
      {formatted}
      {suffix}
    </span>
  );
}

export function StatsBar() {
  return (
    <FadeInWhenVisible>
      <section className="py-16 lg:py-20 border-y border-primary/20">
        {/* Desktop: single row with dividers */}
        <div className="hidden lg:flex items-center justify-center gap-20">
          {STATS.map((stat, index) => (
            <div key={stat.label} className="flex items-center gap-20">
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-4xl lg:text-5xl font-bold text-foreground">
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                </span>
                <span className="text-sm lg:text-base text-muted-foreground">{stat.label}</span>
              </div>
              {index < STATS.length - 1 && (
                <div className="h-14 w-px bg-primary" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        {/* Mobile: 2x2 grid */}
        <div className="grid grid-cols-2 gap-8 lg:hidden">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 text-center">
              <span className="text-4xl font-bold text-foreground">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>
    </FadeInWhenVisible>
  );
}

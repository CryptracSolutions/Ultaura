'use client';

import { useRef, useEffect, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { StarIcon } from '@heroicons/react/24/solid';
import { FadeInWhenVisible } from './MotionWrappers';

const STATS = [
  {
    value: 50000,
    prefix: '+',
    label: 'Hours of companionship',
    description: 'A friendly voice and a personal assistant in one — reminding them about medications, appointments, and daily routines so nothing slips through the cracks',
  },
  {
    value: 18,
    suffix: ' min',
    label: 'Average conversation length',
    description: 'Meaningful chats that go beyond a quick check-in, building real relationships and giving seniors someone who truly listens',
  },
  {
    value: 4.7,
    suffix: '/5',
    label: 'Average rating',
    description: 'Seniors and families consistently rate their experience highly, praising the genuine connection and ease of use',
    showStar: true,
  },
  {
    value: 100,
    suffix: '+',
    label: 'Languages supported',
    description: 'Ultaura speaks their language — whether it\u2019s English, Spanish, Mandarin, or over a hundred others, every call feels like home',
  },
];

function AnimatedNumber({
  value,
  prefix,
  suffix,
  showStar,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  showStar?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '0px' });
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

  const formatted = isDecimal ? displayed.toFixed(1) : displayed.toLocaleString();

  return (
    <span ref={ref} className="inline-flex items-center gap-1">
      {prefix}
      {formatted}
      {suffix}
      {showStar && <StarIcon className="h-6 w-6 text-primary" />}
    </span>
  );
}

export function StatsBar() {
  return (
    <FadeInWhenVisible>
      <section className="bg-primary/5 pt-16 pb-16 lg:py-20">
        {/* Large Desktop: columns in a row with dividers */}
        <div className="hidden xl:flex items-stretch justify-center gap-6 2xl:gap-8 px-8 2xl:px-12 max-w-[1400px] mx-auto">
          {STATS.map((stat, index) => (
            <div key={stat.label} className="flex items-stretch gap-6 2xl:gap-8 flex-1 min-w-0">
              <div className="flex flex-col items-start gap-1 text-left">
                <span className="font-heading text-4xl xl:text-5xl font-bold text-primary mb-2 whitespace-nowrap">
                  <AnimatedNumber
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    showStar={stat.showStar}
                  />
                </span>
                <span className="text-sm xl:text-base font-semibold text-foreground">
                  {stat.label}
                </span>
                <span className="text-sm text-muted-foreground leading-relaxed">
                  {stat.description}
                </span>
              </div>
              {index < STATS.length - 1 && (
                <div className="h-auto w-px bg-primary/30 self-stretch" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        {/* Tablet and Small Desktop: 2x2 grid */}
        <div className="hidden md:grid xl:hidden w-full max-w-4xl mx-auto grid-cols-2 gap-x-8 gap-y-12 px-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-start gap-1 text-left">
              <span className="font-heading text-3xl md:text-4xl font-bold text-primary mb-2 whitespace-nowrap">
                <AnimatedNumber
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  showStar={stat.showStar}
                />
              </span>
              <span className="text-base font-semibold text-foreground">{stat.label}</span>
              <span className="text-sm text-muted-foreground leading-relaxed">
                {stat.description}
              </span>
            </div>
          ))}
        </div>

        {/* Mobile: 2x2 grid with smaller text */}
        <div className="grid md:hidden w-full max-w-md mx-auto grid-cols-2 gap-x-6 gap-y-10 px-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex min-w-0 flex-col items-start gap-1 text-left">
              <span className="font-heading text-3xl sm:text-4xl font-bold text-primary mb-1">
                <AnimatedNumber
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  showStar={stat.showStar}
                />
              </span>
              <span className="text-sm font-semibold text-foreground">{stat.label}</span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                {stat.description}
              </span>
            </div>
          ))}
        </div>
      </section>
    </FadeInWhenVisible>
  );
}

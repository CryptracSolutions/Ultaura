'use client';

import { useRef, useEffect, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { StarIcon } from '@heroicons/react/24/solid';
import { FadeInWhenVisible } from './MotionWrappers';

const STATS = [
  {
    value: 10000,
    prefix: '+',
    label: 'Calls completed',
    description: 'Thousands of friendly conversations happening every day, bringing warmth and connection to seniors across the country',
  },
  {
    value: 1750,
    prefix: '+',
    label: 'Families trust Ultaura',
    description: 'Families rely on us to stay connected with their loved ones, giving them peace of mind without the burden of constant calling',
  },
  {
    value: 18,
    suffix: ' min',
    label: 'Avg. conversation',
    description: 'Meaningful chats that go beyond a quick check-in, building real relationships and giving seniors someone who truly listens',
  },
  {
    value: 4.7,
    suffix: '/5',
    label: 'Average rating',
    description: 'Seniors and families consistently rate their experience highly, praising the genuine connection and ease of use',
    showStar: true,
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
        {/* Large Desktop: 4 columns in a row with dividers */}
        <div className="hidden xl:flex items-stretch justify-center gap-8 2xl:gap-12">
          {STATS.map((stat, index) => (
            <div key={stat.label} className="flex items-stretch gap-8 2xl:gap-12">
              <div className="flex flex-col items-start gap-1 text-left w-[260px] 2xl:w-[280px]">
                <span className="text-4xl xl:text-5xl font-bold text-primary mb-2 whitespace-nowrap">
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
              <span className="text-3xl md:text-4xl font-bold text-primary mb-2 whitespace-nowrap">
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
        <div className="grid md:hidden w-full max-w-lg mx-auto grid-cols-2 gap-x-4 gap-y-8 px-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex min-w-0 flex-col items-start gap-1 text-left">
              <span className="text-2xl sm:text-3xl font-bold text-primary mb-1 whitespace-nowrap">
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

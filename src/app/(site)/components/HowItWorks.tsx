'use client';

import { useRef } from 'react';
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useInView,
  useReducedMotion,
} from 'framer-motion';
import {
  BellIcon,
  CalendarIcon,
  ChartBarIcon,
  SparklesIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { FadeInWhenVisible } from '~/app/(site)/components/MotionWrappers';

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Tell us about them',
    description:
      "Their name, their phone number, a few things they love talking about. That's all we need to make the first call feel personal.",
    icon: UserPlusIcon,
  },
  {
    title: 'Choose a voice and a time',
    description:
      'Pick from five distinct voices and set a daily call window that fits their routine. They just answer the phone.',
    icon: CalendarIcon,
  },
  {
    title: 'Add helpful reminders',
    description:
      'Medications, appointments, birthdays — Ultaura gently reminds them during the call so nothing slips through the cracks.',
    icon: BellIcon,
  },
  {
    title: 'Real conversations, every day',
    description:
      'They talk about their day, their memories, whatever\u2019s on their mind \u2014 and chat about today\u2019s news, sports, or weather. Ultaura listens, remembers, and brings it up next time.',
    icon: SparklesIcon,
  },
  {
    title: 'You stay informed',
    description:
      'See when they talked, how long, and how they\u2019re doing \u2014 all from your dashboard. No recordings, no eavesdropping. Just reassurance.',
    icon: ChartBarIcon,
  },
];

function StepCircle({
  index,
  scrollProgress,
  totalSteps,
}: {
  index: number;
  scrollProgress: ReturnType<typeof useScroll>['scrollYProgress'];
  totalSteps: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  const start = index / totalSteps;
  const end = (index + 1) / totalSteps;

  const scale = useTransform(scrollProgress, [start, end], [0.7, 1]);
  const checkOpacity = useTransform(scrollProgress, [start + (end - start) * 0.4, end * 0.9, end], [0, 0, 1]);

  if (prefersReducedMotion) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-background text-sm font-semibold text-primary shadow-sm">
        {index + 1}
      </div>
    );
  }

  return (
    <motion.div
      style={{ scale }}
      className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-background text-sm font-semibold text-primary shadow-sm"
    >
      <span>{index + 1}</span>
      <motion.div
        style={{ opacity: checkOpacity }}
        className="absolute inset-0 flex items-center justify-center rounded-full bg-primary"
      >
        <CheckIcon className="h-5 w-5 text-primary-foreground" />
      </motion.div>
    </motion.div>
  );
}

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 70%', 'end 30%'],
  });

  const smoothScrollProgress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 30,
    mass: 0.35,
  });

  const lineScaleY = useTransform(smoothScrollProgress, [0, 1], [0, 1]);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="bg-surface-subtle py-16 lg:py-20"
    >
      <Container>
        {/* Header - right-aligned */}
        <div className="ml-auto max-w-2xl text-right space-y-4">
          <Heading type={2}>
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
              Learn
            </span>{' '}
            how Ultaura works
          </Heading>
          <SubHeading>
            Set up in 5 minutes. Your loved one gets their first call today.
          </SubHeading>
        </div>

        {/* Desktop zigzag layout */}
        <div className="mt-10 hidden lg:block">
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute inset-0 flex justify-center">
              <div className="relative w-px bg-border/40">
                {prefersReducedMotion ? (
                  <div className="absolute inset-0 bg-primary" />
                ) : (
                  <motion.div
                    style={{ scaleY: lineScaleY, originY: 0 }}
                    className="absolute inset-0 bg-primary"
                  />
                )}
              </div>
            </div>

            {/* Steps */}
            <div className="relative space-y-6">
              {HOW_IT_WORKS_STEPS.map((step, index) => {
                const isLeft = index % 2 === 0;
                return (
                  <div
                    key={step.title}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-8"
                  >
                    {isLeft ? (
                      <FadeInWhenVisible direction="left" delay={0.1}>
                        <StepCard step={step} />
                      </FadeInWhenVisible>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center justify-center">
                      <StepCircle
                        index={index}
                        scrollProgress={smoothScrollProgress}
                        totalSteps={HOW_IT_WORKS_STEPS.length}
                      />
                    </div>

                    {!isLeft ? (
                      <FadeInWhenVisible direction="right" delay={0.1}>
                        <StepCard step={step} />
                      </FadeInWhenVisible>
                    ) : (
                      <div />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile vertical timeline */}
        <div className="mt-10 lg:hidden">
          <div
            className="relative space-y-6 pl-20"
            style={{ '--hiw-track-x': '1.75rem' } as React.CSSProperties}
          >
            <div className="pointer-events-none absolute left-[var(--hiw-track-x)] top-4 h-[calc(100%-32px)] w-px -translate-x-1/2 bg-primary" />
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <div key={step.title} className="relative">
                <div className="absolute left-[calc(var(--hiw-track-x)-5rem)] top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-background text-sm font-semibold text-primary shadow-sm">
                  {index + 1}
                </div>
                <FadeInWhenVisible direction="right" delay={index * 0.05}>
                  <StepCard step={step} />
                </FadeInWhenVisible>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function StepCard({
  step,
}: {
  step: (typeof HOW_IT_WORKS_STEPS)[number];
}) {
  return (
    <div className="rounded-2xl border border-border/60 border-t-2 border-t-primary/40 bg-sidebar p-5 shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className="group rounded-xl border border-primary/10 bg-primary/10 p-3 transition-colors duration-200 hover:border-primary hover:bg-primary shrink-0">
          <step.icon className="h-5 w-5 text-primary transition-colors duration-200 group-hover:text-primary-foreground" />
        </div>
        <div className="space-y-2">
          <h4 className="text-base font-semibold text-foreground">
            {step.title}
          </h4>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </div>
      </div>
    </div>
  );
}

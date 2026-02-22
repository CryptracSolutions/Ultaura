'use client';

import { useState } from 'react';
import classNames from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownIcon,
  CheckCircleIcon,
  PlayCircleIcon,
  ClockIcon,
  HeartIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import Button from '~/core/ui/Button';
import { FadeInWhenVisible } from '~/app/(site)/components/MotionWrappers';
import { MainCallToActionButton } from '~/app/(site)/components/MainCallToActionButton';
import { ReassuranceChecklist } from '~/app/(site)/components/ReassuranceChecklist';
import BlendedDemoFrame from '~/app/(site)/components/BlendedDemoFrame';

type AudienceId = 'families' | 'seniors' | 'care-teams';

const AUDIENCES: Array<{
  id: AudienceId;
  label: string;
  short: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  {
    id: 'families',
    label: 'Family',
    short: 'Stay connected without the worry.',
    icon: UserGroupIcon,
  },
  {
    id: 'seniors',
    label: 'Senior',
    short: 'A friendly voice, whenever you want one.',
    icon: HeartIcon,
  },
  {
    id: 'care-teams',
    label: 'Caregiver',
    short: 'Less workload. More connection for your residents.',
    icon: ClockIcon,
  },
];

const ALWAYS_INCLUDED = [
  'Daily check-in calls',
  'Medication & routine reminders',
  'At-a-glance summaries for family',
  'Safety alerts to people they trust',
];

function Pill(props: React.PropsWithChildren) {
  return (
    <div className="inline-flex w-fit items-center space-x-2 rounded-full bg-primary/10 px-4 py-2 text-center text-sm font-medium text-primary">
      <span>{props.children}</span>
    </div>
  );
}

function CardShell(props: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={classNames(
        'rounded-2xl border border-border/60 bg-sidebar p-6 shadow-xl',
        'hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-300',
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

function CardTitle(props: React.PropsWithChildren) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      {props.children}
    </div>
  );
}

function IconBadge({
  icon: Icon,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  return (
    <div className="rounded-xl border border-primary/10 bg-primary/10 p-2 text-primary">
      <Icon className="h-4 w-4" />
    </div>
  );
}

export function AudienceValueTabs() {
  const [active, setActive] = useState<AudienceId>('families');

  const activeIndex = Math.max(0, AUDIENCES.findIndex((a) => a.id === active));
  const activeMeta = AUDIENCES[activeIndex]!;

  return (
    <>
      {/* Choose Your Perspective */}
      <section className="py-20 lg:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-surface-elevated px-6 pb-10 pt-1 lg:px-12 lg:py-4">
          <div className="relative">
            <FadeInWhenVisible>
              <div className="mt-16 text-center">
                <Heading type={2}>
                  <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Choose</span> your perspective
                </Heading>
              </div>
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.15}>
              <div className="mx-auto mt-6 w-full max-w-[28rem]">
                <div
                  role="tablist"
                  aria-label="Choose audience"
                  className="relative grid grid-cols-3 rounded-2xl bg-background/70 p-1"
                >
                  {/* Animated pill indicator behind tabs */}
                  <motion.span
                    aria-hidden="true"
                    layoutId="tab-indicator"
                    layout
                    className="pointer-events-none absolute inset-y-1 rounded-xl bg-primary/15"
                    style={{
                      width: 'calc(100% / 3)',
                      left: `calc(${activeIndex} * 100% / 3)`,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />

                  {AUDIENCES.map((audience) => {
                    const selected = audience.id === active;
                    return (
                      <button
                        key={audience.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={`audience-panel-${audience.id}`}
                        id={`audience-tab-${audience.id}`}
                        onClick={() => setActive(audience.id)}
                        className={classNames(
                          'relative flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          'hover:bg-primary/5',
                          selected
                            ? 'text-primary opacity-100'
                            : 'text-muted-foreground hover:text-foreground opacity-60',
                        )}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                          <audience.icon
                            className={classNames(
                              'h-4 w-4 transition-transform',
                              selected && 'scale-110',
                            )}
                          />
                        </span>
                        {audience.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </FadeInWhenVisible>

            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                role="tabpanel"
                id={`audience-panel-${active}`}
                aria-labelledby={`audience-tab-${active}`}
                className="mx-auto mt-6 w-full max-w-6xl"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <CardShell>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {activeMeta.label}
                        </div>
                        <div className="text-lg font-semibold text-foreground">
                          {activeMeta.short}
                        </div>
                      </div>
                      <IconBadge icon={activeMeta.icon} />
                    </div>

                    {active === 'families' && (
                      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Call summary</span>
                          <span className="font-semibold text-foreground">
                            18 min
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Recent activity</span>
                          <span className="font-semibold text-foreground">
                            Tue 6:30 PM · Sun 5:00 PM
                          </span>
                        </div>
                        <div className="mt-2 flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                          See how their calls are going at a glance — duration, mood, and timing.
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                          Get a quiet alert only when something seems off.
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                          Stay close to their life without needing to call every day.
                        </div>
                      </div>
                    )}

                    {active === 'seniors' && (
                      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Daily call window</span>
                          <span className="font-semibold text-foreground">
                            Afternoon
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Tone</span>
                          <span className="font-semibold text-foreground">
                            Warm & gentle
                          </span>
                        </div>
                        <div className="mt-2 flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                          Talk about your day, your memories, whatever&apos;s on your mind.
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                          Gentle reminders for medications and appointments — so you don&apos;t have to keep track.
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                          Call anytime, day or night. There&apos;s always someone happy to listen.
                        </div>
                      </div>
                    )}

                    {active === 'care-teams' && (
                      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Scheduling windows</span>
                          <span className="font-semibold text-foreground">
                            Built in
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Shift handoffs</span>
                          <span className="font-semibold text-foreground">
                            Supported
                          </span>
                        </div>
                        <div className="mt-2 flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                          Daily calls that fit around your facility&apos;s schedule and routines.
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                          Frees up staff time without reducing the quality of check-ins.
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                          Consistent care across shift changes — every resident gets the same warmth.
                        </div>
                      </div>
                    )}
                  </CardShell>

                  <div className="grid gap-6">
                    {active === 'families' && (
                      <>
                        <CardShell>
                          <CardTitle>
                            <IconBadge icon={ShieldCheckIcon} />
                            Privacy that respects both of you
                          </CardTitle>
                          <p className="mt-3 text-sm text-muted-foreground">
                            You see when they talked and for how long — never what
                            they said. They keep their independence. You keep your
                            peace of mind.
                          </p>
                        </CardShell>

                        <CardShell>
                          <CardTitle>
                            <IconBadge icon={ClockIcon} />
                            Their schedule, their terms
                          </CardTitle>
                          <p className="mt-3 text-sm text-muted-foreground">
                            Calls happen when they prefer. Quiet hours are built
                            in. They&apos;re in control of their routine.
                          </p>
                        </CardShell>
                      </>
                    )}

                    {active === 'seniors' && (
                      <>
                        <CardShell>
                          <CardTitle>
                            <IconBadge icon={HeartIcon} />
                            A conversation worth having
                          </CardTitle>
                          <p className="mt-3 text-sm text-muted-foreground">
                            Not a script. Not a checklist. A real conversation
                            about the things you care about — your garden, your
                            grandkids, that recipe you&apos;ve been thinking about.
                            Ask about yesterday&apos;s game, today&apos;s headlines, or the weather.
                          </p>
                        </CardShell>

                        <CardShell>
                          <CardTitle>
                            <IconBadge icon={ShieldCheckIcon} />
                            Always honest, always respectful
                          </CardTitle>
                          <p className="mt-3 text-sm text-muted-foreground">
                            Ultaura tells you it&apos;s AI from the start. No
                            tricks, no confusion. Just a warm voice and a good
                            chat.
                          </p>
                        </CardShell>
                      </>
                    )}

                    {active === 'care-teams' && (
                      <>
                        <CardShell>
                          <CardTitle>
                            <IconBadge icon={ClockIcon} />
                            Fits your schedule, not the other way around
                          </CardTitle>
                          <p className="mt-3 text-sm text-muted-foreground">
                            Set call windows, quiet hours, and routines that match
                            how your facility actually runs.
                          </p>
                        </CardShell>

                        <CardShell>
                          <CardTitle>
                            <IconBadge icon={UserGroupIcon} />
                            Support that scales
                          </CardTitle>
                          <p className="mt-3 text-sm text-muted-foreground">
                            Whether you have 5 residents or 50, every person gets
                            a daily conversation that feels personal.
                          </p>
                        </CardShell>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Before vs. With Ultaura */}
      <section className="bg-surface-subtle py-20 lg:py-24">
        <Container>
          <div className="relative overflow-hidden rounded-3xl bg-surface-elevated px-6 pb-10 pt-1 lg:px-12 lg:py-4">
            <div className="relative">
              <div className="mx-auto flex max-w-3xl flex-col items-center space-y-6 text-center">
                <Pill>
                  Peace of mind for families, companionship for seniors, and
                  support for caregivers
                </Pill>
                <Heading type={2}>
                  Peace of mind starts with a <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">daily call</span>
                </Heading>
              </div>

              <div className="mx-auto mt-6 flex max-w-4xl flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
                {ALWAYS_INCLUDED.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground"
                  >
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mx-auto mt-8 max-w-4xl">
                <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
                  {/* Before card — deliberately dim */}
                  <BlendedDemoFrame className="w-full">
                    <div className="h-full rounded-2xl border border-border/60 bg-background/80 p-6 shadow-xl">
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground">
                          Before
                        </h3>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/50" />
                            <span>No way to know if they&apos;re okay until your next call</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/50" />
                            <span>The guilt of knowing you should be calling more often</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/50" />
                            <span>Missing the small changes that signal something&apos;s wrong</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </BlendedDemoFrame>

                  <div className="flex items-center justify-center py-1 sm:py-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <ArrowDownIcon className="h-3 w-3 sm:-rotate-90" />
                    </div>
                  </div>

                  <BlendedDemoFrame className="w-full">
                    {/* With Ultaura card — brighter, elevated */}
                    <div className="h-full rounded-2xl border border-primary/40 bg-sidebar p-6 shadow-2xl">
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-primary">
                          With Ultaura
                        </h3>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                            <span>They have a warm, friendly voice to talk to each day</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                            <span>You see that they&apos;re doing well — without hovering</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                            <span>Gentle alerts only when something needs your attention</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </BlendedDemoFrame>
                </div>

                <div className="relative mt-5">
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-border" />
                  <div className="relative flex items-center justify-between">
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  </div>
                </div>

                <div className="mt-10 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                  <MainCallToActionButton />
                  <Button
                    variant="outline"
                    size="lg"
                    round
                    href="/demo"
                    className="border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <span className="flex items-center gap-2">
                      <PlayCircleIcon className="h-5 w-5" />
                      Try the voices
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Reassurance Built In */}
      <ReassuranceChecklist />
    </>
  );
}

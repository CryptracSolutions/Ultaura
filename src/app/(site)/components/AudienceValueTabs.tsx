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
  'Safety alerts',
  '100+ languages',
  'Daily check-in calls',
  'Conversation summaries',
  'Medication + routine reminders',
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
      <section className="pt-5 pb-[4.7265625rem] lg:pt-6 lg:pb-[5.15625rem]">
        <div className="relative overflow-hidden rounded-3xl bg-surface-elevated px-6 pb-10 pt-1 lg:px-12 lg:py-4">
          <div className="relative">
            <FadeInWhenVisible>
              <div className="mt-8 text-center">
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
                            18 min · Happy
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Recent activity</span>
                          <span className="font-semibold text-foreground">
                            Tue 6:30 PM · Sun 5:00 PM
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Call insights</span>
                          <span className="font-semibold text-foreground">
                            Engagement, topics & more
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Wellness + Safety alerts</span>
                          <span className="font-semibold text-foreground">
                            Supported
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Stay connected</span>
                          <span className="font-semibold text-foreground">
                            Always
                          </span>
                        </div>
                      </div>
                    )}

                    {active === 'seniors' && (
                      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Daily call</span>
                          <span className="font-semibold text-foreground">
                            Morning · 9 am
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Voice</span>
                          <span className="font-semibold text-foreground">
                            Ara · warm & nurturing
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Talk about</span>
                          <span className="font-semibold text-foreground">
                            Life, events & memories
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Reminders</span>
                          <span className="font-semibold text-foreground">
                            Meds, appointments & dates
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Availability</span>
                          <span className="font-semibold text-foreground">
                            24/7/365
                          </span>
                        </div>
                      </div>
                    )}

                    {active === 'care-teams' && (
                      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Scheduling times</span>
                          <span className="font-semibold text-foreground">
                            Built in
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Safety alerts</span>
                          <span className="font-semibold text-foreground">
                            Instant notifications
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Flexibility</span>
                          <span className="font-semibold text-foreground">
                            Fits your routines
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Efficiency</span>
                          <span className="font-semibold text-foreground">
                            Saves you time
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                          <span>Family updates</span>
                          <span className="font-semibold text-foreground">
                            Automatic & secure
                          </span>
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
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>Your loved one keeps their independence while you keep your peace of mind</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>See call timing, duration, topics, and insights — never the full transcript</span>
                            </li>
                          </ul>
                        </CardShell>

                        <CardShell>
                          <CardTitle>
                            <IconBadge icon={ClockIcon} />
                            Their schedule, their terms
                          </CardTitle>
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>Complete control over when calls happen — quiet hours, pauses, vacation</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>They can call inbound anytime, or skip days when they prefer</span>
                            </li>
                          </ul>
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
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>Real conversations about what matters — no scripts, no checklists</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>Someone who truly listens, remembers your stories, and cares about your day</span>
                            </li>
                          </ul>
                        </CardShell>

                        <CardShell>
                          <CardTitle>
                            <IconBadge icon={ShieldCheckIcon} />
                            Your helpful daily assistant
                          </CardTitle>
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>Remembers your preferences and helps with weather, news, or reminders</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>Always there when you call — patient, never rushed, and ready for good company</span>
                            </li>
                          </ul>
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
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>Call windows and quiet hours tailored to your daily flow</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>Less time on routine check-ins, more time for meaningful resident care</span>
                            </li>
                          </ul>
                        </CardShell>

                        <CardShell>
                          <CardTitle>
                            <IconBadge icon={UserGroupIcon} />
                            Support that scales
                          </CardTitle>
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>Whether you care for 1 resident or 100, each individual receives consistent attention</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>Insights dashboard that helps you track patterns and stay involved</span>
                            </li>
                          </ul>
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

      {/* Reassurance Built In */}
      <ReassuranceChecklist />

      {/* Before vs. With Ultaura */}
      <section className="bg-surface-subtle pt-10 pb-20 lg:pt-12 lg:pb-24">
        <Container>
          <div className="relative overflow-hidden rounded-3xl bg-surface-elevated px-6 pb-10 pt-1 lg:px-12 lg:py-4">
            <div className="relative">
              <div className="mx-auto flex max-w-3xl flex-col items-center space-y-6 text-center pt-8">
                <Pill>
                  Daily connection for those who matter most
                </Pill>
                <Heading type={2}>
                  <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Peace of mind</span> starts with a daily call
                </Heading>
              </div>

              <div className="mx-auto mt-6 flex max-w-4xl flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
                {ALWAYS_INCLUDED.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs text-muted-foreground"
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
                        <h3 className="text-xs font-semibold text-foreground">
                          Before
                        </h3>
                        <ul className="space-y-1.5 text-xs text-foreground">
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-foreground/70" />
                            <span>The silence between calls slowly becomes a weight you carry alone</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-foreground/70" />
                            <span>Small changes slip by unnoticed until they become problems you could have prevented</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-foreground/70" />
                            <span>Distance wins, and you&apos;re left wondering what&apos;s happening while you&apos;re not there</span>
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
                    {/* With Ultaura card — same muted styling as Before */}
                    <div className="h-full rounded-2xl border border-border/60 bg-background/80 p-6 shadow-xl">
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-primary">
                          With Ultaura
                        </h3>
                        <ul className="space-y-1.5 text-xs text-foreground">
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                            <span>A warm, genuine conversation waiting for them every single morning</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                            <span>You finally know they&apos;re okay—without hovering, without guilt, without constantly calling</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                            <span>The quiet confidence of being present, even when you simply can&apos;t be there</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </BlendedDemoFrame>
                </div>

                <div className="relative mt-5 hidden sm:block">
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

    </>
  );
}

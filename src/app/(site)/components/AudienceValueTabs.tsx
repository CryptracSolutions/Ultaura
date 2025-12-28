'use client';

import { useMemo, useState } from 'react';
import classNames from 'clsx';
import {
  CheckCircleIcon,
  ClockIcon,
  HeartIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';

type AudienceId = 'families' | 'seniors' | 'care-teams';

const AUDIENCES: Array<{
  id: AudienceId;
  label: string;
  short: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  {
    id: 'families',
    label: 'Families',
    short: 'Peace of mind without hovering.',
    icon: UserGroupIcon,
  },
  {
    id: 'seniors',
    label: 'Seniors',
    short: 'A warm, respectful daily routine.',
    icon: HeartIcon,
  },
  {
    id: 'care-teams',
    label: 'Caregivers',
    short: 'Designed for multi-resident workflows.',
    icon: ClockIcon,
  },
];

const ALWAYS_INCLUDED = [
  'Works on any phone',
  'No app required',
  'Always discloses AI',
  'No transcripts stored by default',
];

const PROMISES = [
  'No manipulation or deception.',
  'Never pretend to be human.',
  'No upsells or pressure tactics.',
];

function Pill(props: React.PropsWithChildren) {
  return (
    <div
      className={
        'inline-flex w-fit items-center space-x-2 rounded-full bg-primary/10 px-4 py-2' +
        ' text-center text-sm font-medium text-primary'
      }
    >
      <span>{props.children}</span>
    </div>
  );
}

function CardShell(props: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={classNames(
        'rounded-2xl border border-border/60 bg-sidebar p-6 shadow-xl',
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

  const activeIndex = useMemo(
    () => Math.max(0, AUDIENCES.findIndex((audience) => audience.id === active)),
    [active],
  );

  const activeMeta = useMemo(
    () => AUDIENCES.find((a) => a.id === active) ?? AUDIENCES[0]!,
    [active],
  );

  return (
    <section className="py-24">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-surface-elevated px-6 py-16 lg:px-12">
          <div className="relative">
            <div className="mx-auto flex max-w-3xl flex-col items-center space-y-4 text-center">
              <Pill>
                Peace of mind for familes, companionship for seniors, and
                support for caregivers
              </Pill>
              <Heading type={2}>
                <span className="text-primary">Why</span> choose Ultaura?
              </Heading>
              <SubHeading as={'h3'}>
                Tailored experience through your perspective
              </SubHeading>
            </div>

            <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-3">
              {ALWAYS_INCLUDED.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground"
                >
                  <CheckCircleIcon className="h-4 w-4 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-10 w-full max-w-[28rem]">
              <div
                role="tablist"
                aria-label="Choose audience"
                className="relative grid grid-cols-3 rounded-2xl bg-background/70 p-1"
              >
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
                        'rounded-xl px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                        selected
                          ? 'text-primary'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {audience.label}
                    </button>
                  );
                })}

                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/3 bg-primary transition-transform duration-200"
                  style={{ transform: `translateX(${activeIndex * 100}%)` }}
                />
              </div>
            </div>

            <div
              role="tabpanel"
              id={`audience-panel-${active}`}
              aria-labelledby={`audience-tab-${active}`}
              className="mx-auto mt-10 w-full max-w-6xl"
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

                  {active === 'families' ? (
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
                        See cadence and comfort signals at a glance.
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                        Get notified only when something needs attention.
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                        Maintain meaningful connections without daily intrusion.
                      </div>
                    </div>
                  ) : null}

                  {active === 'seniors' ? (
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
                        Respectful conversations that honor independence.
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                        Natural AI conversations that feel genuinely caring.
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                        24/7 availability for comfort and companionship.
                      </div>
                    </div>
                  ) : null}

                  {active === 'care-teams' ? (
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
                        Designed for multi-resident routines and staffing
                        changes.
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                        Reduces daily check-in workload for care teams.
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                        Maintains consistent care quality during staff transitions.
                      </div>
                    </div>
                  ) : null}
                </CardShell>

                <div className="grid gap-6">
                  {active === 'families' ? (
                    <>
                      <CardShell>
                        <CardTitle>
                          <IconBadge icon={ShieldCheckIcon} />
                          Privacy-first by design
                        </CardTitle>
                        <p className="mt-3 text-sm text-muted-foreground">
                          You get activity and duration — not transcripts — so
                          you can stay informed without being intrusive.
                        </p>
                      </CardShell>

                      <CardShell>
                        <CardTitle>
                          <IconBadge icon={ClockIcon} />
                          Quiet hours & scheduling control
                        </CardTitle>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Set a predictable routine with respectful boundaries,
                          including quiet hours.
                        </p>
                      </CardShell>
                    </>
                  ) : null}

                  {active === 'seniors' ? (
                    <>
                      <CardShell>
                        <CardTitle>
                          <IconBadge icon={HeartIcon} />
                          Friendly companionship
                        </CardTitle>
                        <p className="mt-3 text-sm text-muted-foreground">
                          A bright spot in the day — gentle questions and
                          meaningful conversation.
                        </p>
                      </CardShell>

                      <CardShell>
                        <CardTitle>
                          <IconBadge icon={ShieldCheckIcon} />
                          Clear AI disclosure
                        </CardTitle>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Every call begins with transparency, so it always
                          feels respectful and safe.
                        </p>
                      </CardShell>
                    </>
                  ) : null}

                  {active === 'care-teams' ? (
                    <>
                      <CardShell>
                        <CardTitle>
                          <IconBadge icon={ClockIcon} />
                          Operationally practical
                        </CardTitle>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Scheduling windows and quiet hours help fit real
                          facility routines.
                        </p>
                      </CardShell>

                      <CardShell>
                        <CardTitle>
                          <IconBadge icon={UserGroupIcon} />
                          Built for caregivers
                        </CardTitle>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Designed to support staff and families with a
                          consistent, low-lift check-in cadence.
                        </p>
                      </CardShell>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mx-auto mt-10 w-full max-w-6xl rounded-2xl border border-border/60 bg-sidebar p-5 shadow-xl">
              <div className="grid place-items-center gap-3 text-center text-sm text-muted-foreground md:grid-cols-3">
                {PROMISES.map((item) => (
                  <div key={item} className="flex items-center justify-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}



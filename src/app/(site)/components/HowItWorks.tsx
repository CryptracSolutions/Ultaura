import {
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  PlayCircleIcon,
  SparklesIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import { MainCallToActionButton } from '~/app/(site)/components/MainCallToActionButton';

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Add your loved one',
    description:
      "Create an account, add their phone number, and share a few preferences so calls feel familiar.",
    icon: UserPlusIcon,
  },
  {
    title: 'Pick timing and a voice',
    description:
      'Choose when Ultaura calls and select a voice that feels warm and natural to them.',
    icon: CalendarIcon,
  },
  {
    title: 'Natural conversations',
    description:
      'Ultaura chats about their day, memories, and interests — responding in real-time with expressive, human-like voice.',
    icon: SparklesIcon,
  },
  {
    title: 'Stay in the loop',
    description:
      'Review call activity and duration from your dashboard without reading transcripts.',
    icon: ChartBarIcon,
  },
];

const TRUST_POINTS = [
  'Works on any phone',
  'Setup in under 2 minutes',
  'No app required',
  'Cancel anytime',
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface-subtle py-24">
      <Container>
        <div className="relative grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="flex flex-col space-y-6">
            <div className="space-y-4">
              <div className="inline-flex w-fit items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                Fast setup. Real connection.
              </div>
              <Heading type={2}>
                <span className="text-primary">How</span> it works
              </Heading>
              <SubHeading className="max-w-xl">
                A simple, respectful flow that keeps your loved one engaged and
                you informed.
              </SubHeading>
            </div>

            <div className="flex flex-wrap gap-3">
              {TRUST_POINTS.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground"
                >
                  <CheckCircleIcon className="h-4 w-4 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

            <p className="text-sm text-muted-foreground">
              Voice demo is coming soon. We&apos;ll make it easy to hear and pick
              the tone that feels right before you invite a loved one.
            </p>
          </div>

          <div className="relative">
            <ol
              className="relative space-y-6"
              style={{ '--hiw-track-x': '1.75rem' } as React.CSSProperties}
            >
              <div className="pointer-events-none absolute left-[var(--hiw-track-x)] top-4 h-[calc(100%-32px)] w-px -translate-x-1/2 bg-primary" />
              {HOW_IT_WORKS_STEPS.map((step, index) => (
                <li key={step.title} className="relative pl-16">
                  <div className="absolute left-[var(--hiw-track-x)] top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-background text-xs font-semibold text-primary shadow-sm">
                    {index + 1}
                  </div>
                  <div className="rounded-2xl border border-border bg-background/90 p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="group rounded-xl border border-primary/10 bg-primary/10 p-3 transition-colors duration-200 hover:border-primary hover:bg-primary">
                        <step.icon className="h-5 w-5 text-primary transition-colors duration-200 group-hover:text-primary-foreground" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold text-foreground">
                          {step.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Container>
    </section>
  );
}

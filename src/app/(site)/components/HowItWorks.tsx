import {
  BellIcon,
  CalendarIcon,
  ChartBarIcon,
  SparklesIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';

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


export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface-subtle pt-4 pb-12">
      <Container>
        {/* Header - right-aligned */}
        <div className="ml-auto max-w-2xl text-right space-y-4">
          <Heading type={2}>
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Learn</span> how Ultaura works
          </Heading>
          <SubHeading>
            Set up in 5 minutes. Your loved one gets their first call today.
          </SubHeading>
        </div>

        {/* Steps - centered timeline */}
        <div className="mx-auto mt-10 max-w-xl lg:max-w-6xl">
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
                <div className="rounded-2xl border border-border/60 bg-sidebar p-6 shadow-xl">
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
      </Container>
    </section>
  );
}

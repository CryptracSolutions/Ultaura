import { ArrowDownIcon } from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';

function Pill(props: React.PropsWithChildren) {
  return (
    <div className="inline-flex w-fit items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
      {props.children}
    </div>
  );
}

export function BeforeAfterTimeline() {
  return (
    <section className="bg-surface-subtle py-12">
      <Container>
        <div className="mb-10 flex flex-col items-center text-center space-y-3">
          <Pill>The Ultaura difference</Pill>
          <Heading type={2}>From worry to peace of mind</Heading>
        </div>

        <div className="relative mx-auto max-w-3xl">
          <div className="absolute left-1/2 top-0 hidden h-full w-0.5 -translate-x-1/2 bg-border md:block" />

          <div className="relative grid gap-8 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="space-y-3 md:text-right md:pr-8">
              <h3 className="text-sm font-semibold text-muted-foreground">Before</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Worry between check-ins</li>
                <li>Missed calls, uncertainty</li>
                <li>No insight into daily life</li>
              </ul>
            </div>
            <div className="mx-auto hidden h-3 w-3 rounded-full bg-muted-foreground md:block" />
            <div className="hidden md:block" />
          </div>

          <div className="relative my-8 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ArrowDownIcon className="h-4 w-4" />
            </div>
          </div>

          <div className="relative grid gap-8 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="hidden md:block" />
            <div className="mx-auto hidden h-3 w-3 rounded-full bg-primary md:block" />
            <div className="space-y-3 md:pl-8">
              <h3 className="text-sm font-semibold text-primary">With Ultaura</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Daily routine & connection</li>
                <li>Instant summaries & insights</li>
                <li>Alerts when something is off</li>
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

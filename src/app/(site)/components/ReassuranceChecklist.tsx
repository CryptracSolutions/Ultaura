import { CheckCircle2 } from 'lucide-react';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';

const REASSURANCES = [
  { text: 'No app required', detail: 'Works on any phone, including landlines' },
  { text: 'Cancel anytime', detail: 'No contracts, no cancellation fees' },
  { text: 'Always discloses AI', detail: 'Transparent about being an AI companion' },
  { text: 'Privacy-first', detail: 'No transcripts stored by default' },
  { text: '3-day free trial', detail: 'Try before you commit' },
  { text: 'Quiet hours respected', detail: 'You control when calls happen' },
];

export function ReassuranceChecklist() {
  return (
    <section className="bg-primary/5 py-12">
      <Container>
        <div className="mb-8 text-center">
          <Heading type={3}>Reassurance built in</Heading>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {REASSURANCES.map((item) => (
            <div key={item.text} className="flex flex-col items-center text-center p-4">
              <CheckCircle2 className="mb-2 h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-foreground">{item.text}</span>
              <span className="mt-1 text-xs text-muted-foreground">{item.detail}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

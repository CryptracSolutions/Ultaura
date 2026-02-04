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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {REASSURANCES.map((item) => (
            <div key={item.text} className="flex flex-col items-center text-center p-3 sm:p-4">
              <CheckCircle2 className="mb-2 h-5 w-5 text-primary sm:h-6 sm:w-6" />
              <span className="text-xs font-medium text-foreground sm:text-sm">{item.text}</span>
              <span className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{item.detail}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

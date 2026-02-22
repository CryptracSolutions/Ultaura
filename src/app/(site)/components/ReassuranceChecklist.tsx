'use client';

import { CheckCircle2 } from 'lucide-react';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import { StaggerChildren } from '~/app/(site)/components/MotionWrappers';

const REASSURANCES = [
  { text: 'They can opt out anytime', detail: 'If they ever want to stop, they just say so. No complicated process, no guilt.' },
  { text: 'Works on their existing phone', detail: 'Landlines, cell phones, even flip phones. No downloads, no setup on their end.' },
  { text: 'You pick the voice they\u2019ll like', detail: 'Five warm, distinct voices. Choose the one that feels right for their personality.' },
  { text: 'Built with elder care professionals', detail: 'Designed alongside geriatricians, social workers, and family caregivers.' },
  { text: 'Safety monitoring included', detail: 'If they sound distressed, Ultaura gently helps and alerts your trusted contacts.' },
  { text: 'No commitment, no risk', detail: '14-day free trial. Cancel anytime in one click.' },
];

export function ReassuranceChecklist() {
  return (
    <section className="bg-primary/5 py-[2.88rem] lg:py-[3.6rem]">
      <Container>
        <div className="mb-4 text-center">
          <Heading type={3}>Reassurance built in</Heading>
        </div>
        <StaggerChildren className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {REASSURANCES.map((item) => (
            <div
              key={item.text}
              className="flex flex-col items-center text-center px-2 py-1 sm:px-4 sm:py-2"
            >
              <CheckCircle2 className="mb-1.5 h-5 w-5 text-primary sm:h-6 sm:w-6" />
              <span className="text-xs font-medium text-foreground sm:text-sm">{item.text}</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">{item.detail}</span>
            </div>
          ))}
        </StaggerChildren>

      </Container>
    </section>
  );
}

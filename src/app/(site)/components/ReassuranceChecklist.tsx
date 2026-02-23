'use client';

import { CheckCircle2 } from 'lucide-react';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import { StaggerChildren } from '~/app/(site)/components/MotionWrappers';

const REASSURANCES = [
  { text: 'Your loved one is always in control', detail: 'They can pause or stop calls anytime — just by saying so. No hoops, no pressure.' },
  { text: 'Someone\u2019s listening \u2014 even when you can\u2019t be', detail: 'If something sounds off, Ultaura responds with care and alerts your trusted contacts right away.' },
  { text: 'Shaped by people who get it', detail: 'Designed with family caregivers, elder care doctors, and social workers — not just engineers.' },
  { text: 'A voice that feels like a friend', detail: 'Five personalities to choose from — preview each one and pick whoever feels right. They can always switch later.' },
  { text: 'It just calls their phone', detail: 'Ultaura calls their phone — landline, cell, even a flip phone. Zero setup, zero tech skills needed.' },
  { text: 'Try it free for 14 days', detail: 'No card required to start. If it\u2019s not right, cancel in one click — no questions asked.' },
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

'use client';

import { CheckCircle2 } from 'lucide-react';
import { PlayCircleIcon } from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import Button from '~/core/ui/Button';
import { MainCallToActionButton } from '~/app/(site)/components/MainCallToActionButton';
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
    <section className="bg-primary/5 py-16 lg:py-20">
      <Container>
        <div className="mb-4 text-center">
          <Heading type={3}>Reassurance built in</Heading>
        </div>
        <StaggerChildren className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {REASSURANCES.map((item) => (
            <div
              key={item.text}
              className="flex flex-col items-center text-center rounded-2xl border border-border/40 bg-sidebar/50 p-4 sm:p-5"
            >
              <CheckCircle2 className="mb-1.5 h-5 w-5 text-primary sm:h-6 sm:w-6" />
              <span className="text-xs font-medium text-foreground sm:text-sm">{item.text}</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">{item.detail}</span>
            </div>
          ))}
        </StaggerChildren>

        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
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
      </Container>
    </section>
  );
}

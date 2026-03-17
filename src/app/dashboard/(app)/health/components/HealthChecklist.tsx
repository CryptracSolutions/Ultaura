'use client';

import { ClipboardCheck, Check } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '~/core/ui/Popover';
import type { HealthChecklistCounts } from '../types';

interface HealthChecklistProps {
  counts: HealthChecklistCounts;
}

const STEPS = [
  { key: 'conditions' as const, label: 'Conditions', description: 'Add known health conditions' },
  { key: 'medications' as const, label: 'Medications', description: 'Add current medications' },
  { key: 'documents' as const, label: 'Documents', description: 'Upload health records' },
  { key: 'observations' as const, label: 'Observations', description: 'Log day-to-day notes' },
];

export function HealthChecklist({ counts }: HealthChecklistProps) {
  const completedCount = STEPS.filter((s) => counts[s.key] > 0).length;
  const allDone = completedCount === STEPS.length;
  const progressPercent = (completedCount / STEPS.length) * 100;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
          <span>Health checklist</span>
          <span className="text-primary/60">{completedCount}/{STEPS.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden rounded-xl border border-border/70 p-0 shadow-lg">
        {/* Header */}
        <div className="border-b border-border/50 bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                <ClipboardCheck className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">Health checklist</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {completedCount}/{STEPS.length}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {allDone
              ? 'All set! Health profile is fully configured.'
              : 'Set up health information in this order for the best experience.'}
          </p>
        </div>

        {/* Steps */}
        <div className="px-4 py-3">
          <ol className="space-y-0.5">
            {STEPS.map((step, i) => {
              const done = counts[step.key] > 0;
              return (
                <li
                  key={step.key}
                  className={`flex items-start gap-3 rounded-lg px-2 py-2 ${
                    done ? 'bg-success/5' : ''
                  }`}
                >
                  {done ? (
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/25 text-[11px] font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium leading-tight ${done ? 'text-foreground' : 'text-foreground'}`}>
                      {step.label}
                    </p>
                    <p className={`text-xs leading-snug ${done ? 'text-success' : 'text-muted-foreground'}`}>
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </PopoverContent>
    </Popover>
  );
}

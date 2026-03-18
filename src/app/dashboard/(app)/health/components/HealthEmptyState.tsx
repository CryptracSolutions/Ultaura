'use client';

import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';

import Button from '~/core/ui/Button';

interface HealthEmptyStateProps {
  icon: LucideIcon;
  headline: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export function HealthEmptyState({
  icon: Icon,
  headline,
  description,
  ctaLabel,
  onCtaClick,
}: HealthEmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <Icon className="mb-3 h-8 w-8 text-primary" strokeWidth={1.5} />
      <p className="text-sm font-semibold text-foreground">{headline}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {ctaLabel && onCtaClick && (
        <Button
          variant="outline"
          size="small"
          className="mt-4 self-stretch sm:self-auto"
          onClick={onCtaClick}
        >
          <Plus className="h-4 w-4" />
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}

'use client';

import { Plus } from 'lucide-react';
import Button from '~/core/ui/Button';

interface AutomationPageHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  disabled?: boolean;
}

export function AutomationPageHeader({
  icon: Icon,
  title,
  subtitle,
  ctaLabel,
  onCtaClick,
  disabled,
}: AutomationPageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-primary" />
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
        </div>
      </div>

      {ctaLabel && onCtaClick && !disabled && (
        <Button
          onClick={onCtaClick}
          variant="default"
          size="small"
          className="w-full sm:w-auto gap-1"
        >
          <Plus className="w-3 h-3" />
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}

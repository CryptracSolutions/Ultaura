'use client';

import { Plus } from 'lucide-react';
import Button from '~/core/ui/Button';

interface AutomationEmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  disabled?: boolean;
}

export function AutomationEmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
  disabled,
}: AutomationEmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">{description}</p>
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

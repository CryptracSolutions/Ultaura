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
  ctaDisabled?: boolean;
  ctaDisabledReason?: string;
}

export function AutomationEmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
  disabled,
  ctaDisabled = false,
  ctaDisabledReason,
}: AutomationEmptyStateProps) {
  const showCta = Boolean(ctaLabel && onCtaClick && !disabled);
  const showCtaDisabledReason = showCta && ctaDisabled && Boolean(ctaDisabledReason);

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">{description}</p>
      {showCta && (
        <div className="mx-auto w-full sm:w-auto sm:text-center">
          <span
            className="inline-block w-full sm:w-auto"
            title={showCtaDisabledReason ? ctaDisabledReason : undefined}
          >
            <Button
              onClick={onCtaClick}
              variant="default"
              size="small"
              className="w-full sm:w-auto gap-1"
              disabled={ctaDisabled}
            >
              <Plus className="w-3 h-3" />
              {ctaLabel}
            </Button>
          </span>
          {showCtaDisabledReason ? (
            <p className="mt-2 text-xs text-muted-foreground">{ctaDisabledReason}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

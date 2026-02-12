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
  ctaDisabled?: boolean;
  ctaDisabledReason?: string;
}

export function AutomationPageHeader({
  icon: Icon,
  title,
  subtitle,
  ctaLabel,
  onCtaClick,
  disabled,
  ctaDisabled = false,
  ctaDisabledReason,
}: AutomationPageHeaderProps) {
  const showCta = Boolean(ctaLabel && onCtaClick && !disabled);
  const showCtaDisabledReason = showCta && ctaDisabled && Boolean(ctaDisabledReason);

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

      {showCta && (
        <div className="w-full sm:w-auto sm:text-right">
          <span
            className="inline-block w-full sm:w-auto"
            title={showCtaDisabledReason ? ctaDisabledReason : undefined}
          >
            <Button
              onClick={onCtaClick}
              variant="default"
              size="small"
              className="w-full sm:w-auto"
              disabled={ctaDisabled}
            >
              <Plus className="w-4 h-4" />
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

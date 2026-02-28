'use client';

import { Loader2 } from 'lucide-react';
import Button from '~/core/ui/Button';

export interface PrivacyStateBannerProps {
  isPrivacySettingsUnavailable: boolean;
  showSavingState: boolean;
  isSaving: boolean;
  onRetry: () => void;
}

export function PrivacyStateBanner({
  isPrivacySettingsUnavailable,
  showSavingState,
  isSaving,
  onRetry,
}: PrivacyStateBannerProps) {
  if (isPrivacySettingsUnavailable) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-warning">
          Privacy settings could not be loaded. Editing is temporarily disabled to
          avoid overwriting your saved preferences.
        </p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!showSavingState) {
    return null;
  }

  return (
    <p
      className="text-sm font-medium text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {isSaving ? (
        <span className="inline-flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Saving your privacy changes...
        </span>
      ) : (
        <span className="text-sm">Changes pending save...</span>
      )}
    </p>
  );
}

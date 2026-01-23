'use client';

import { useTranslation } from 'react-i18next';
import type { GrokVoice } from '~/lib/ultaura/voices';
import { VOICE_OPTIONS } from '~/lib/ultaura/voices';

export type VoiceSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface VoiceSelectorProps {
  value: GrokVoice;
  onChange: (voice: GrokVoice) => void;
  saveStatus?: VoiceSaveStatus;
  onRetry?: () => void;
  disabled?: boolean;
  helperText?: string;
}

export function VoiceSelector({
  value,
  onChange,
  saveStatus = 'idle',
  onRetry,
  disabled = false,
  helperText,
}: VoiceSelectorProps) {
  const { t } = useTranslation('voices');

  const statusLabel = (() => {
    if (saveStatus === 'saving') return t('ui.voicePreference.statusSaving');
    if (saveStatus === 'saved') return t('ui.voicePreference.statusSaved');
    if (saveStatus === 'error') return t('ui.voicePreference.statusError');
    return null;
  })();

  const statusColor =
    saveStatus === 'error'
      ? 'text-destructive'
      : saveStatus === 'saved'
      ? 'text-success'
      : 'text-muted-foreground';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {VOICE_OPTIONS.map((option) => {
          const isSelected = value === option.apiName;
          const nameKey = `voices.${option.id}.name`;
          const descriptionKey = `voices.${option.id}.description`;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.apiName)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={
                'flex w-full flex-col rounded-xl border p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ' +
                (isSelected
                  ? 'border-primary ring-2 ring-primary shadow-xl shadow-primary/20'
                  : 'border-border bg-card hover:ring-2 hover:ring-primary hover:shadow-sm')
              }
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
                  <img
                    src={option.iconPath}
                    alt={t(nameKey)}
                    className="h-7 w-7"
                  />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {t(nameKey)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(descriptionKey)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {option.traitIds.map((traitId) => (
                  <span
                    key={traitId}
                    className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {t(`traits.${traitId}`)}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{helperText}</span>
        {statusLabel && (
          <span className="flex items-center gap-2">
            <span className={statusColor}>{statusLabel}</span>
            {saveStatus === 'error' && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={disabled}
                className="text-primary hover:underline disabled:opacity-50"
              >
                {t('ui.voicePreference.retry')}
              </button>
            ) : null}
          </span>
        )}
      </div>
    </div>
  );
}

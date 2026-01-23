'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';
import { DEFAULT_GROK_VOICE, type GrokVoice, VOICE_OPTIONS } from '~/lib/ultaura/voices';

export interface VoiceSelectionStepData {
  preferredGrokVoice: GrokVoice;
}

const VoiceSelectionStep: React.FCC<{
  onSubmit: (data: VoiceSelectionStepData) => void;
  onGoBack?: () => void;
  value?: GrokVoice;
}> = ({ onSubmit, onGoBack, value }) => {
  const { t } = useTranslation('voices');
  const [selectedVoice, setSelectedVoice] = useState<GrokVoice>(
    value ?? DEFAULT_GROK_VOICE,
  );

  useEffect(() => {
    if (value) {
      setSelectedVoice(value);
    }
  }, [value]);

  return (
    <div className={'flex w-full flex-1 flex-col space-y-12'}>
      <div className={'flex flex-col space-y-2'}>
        <Heading type={1}>
          <Trans i18nKey={'onboarding:voiceSelectionHeading'} />
        </Heading>

        <SubHeading>
          <span className={'text-base'}>
            <Trans i18nKey={'onboarding:voiceSelectionDescription'} />
          </span>
        </SubHeading>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {VOICE_OPTIONS.map((option) => {
          const isSelected = selectedVoice === option.apiName;
          const nameKey = `voices.${option.id}.name`;
          const descriptionKey = `voices.${option.id}.description`;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedVoice(option.apiName)}
              aria-pressed={isSelected}
              className={
                'flex w-full flex-col items-center rounded-xl border p-6 text-center transition-all ' +
                (isSelected
                  ? 'border-primary ring-2 ring-primary shadow-xl shadow-primary/20'
                  : 'border-border bg-card hover:ring-2 hover:ring-primary hover:shadow-sm')
              }
            >
              <p className="text-lg font-semibold text-foreground">
                {t(nameKey)}
              </p>
              <div className="mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
                <img
                  src={option.iconPath}
                  alt={t(nameKey)}
                  className="h-10 w-10"
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {t(descriptionKey)}
              </p>
            </button>
          );
        })}
      </div>

      <div className={'flex flex-col gap-3'}>
        <Button type={'button'} onClick={() => onSubmit({ preferredGrokVoice: selectedVoice })}>
          <Trans i18nKey={'common:continue'} />
        </Button>

        {onGoBack && (
          <Button type={'button'} variant={'ghost'} onClick={onGoBack}>
            <Trans i18nKey={'common:goBack'} />
          </Button>
        )}
      </div>
    </div>
  );
};

export default VoiceSelectionStep;

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import { PlayCircleIcon, StopCircleIcon } from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';
import type { GrokVoice, VoiceOption } from '~/lib/ultaura/voices';
import { VOICE_OPTIONS } from '~/lib/ultaura/voices';

type PlayState = 'idle' | 'loading' | 'playing';

function VoiceAvatar({
  option,
  alt,
  isSelected,
}: {
  option: VoiceOption;
  alt: string;
  isSelected: boolean;
}) {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    if (option.animationPath) {
      fetch(option.animationPath)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load animation');
          return res.json();
        })
        .then(setAnimationData)
        .catch(() => {});
    }
  }, [option.animationPath]);

  useEffect(() => {
    if (lottieRef.current) {
      if (isSelected) {
        lottieRef.current.play();
      } else {
        lottieRef.current.pause();
        lottieRef.current.goToAndStop(0, true);
      }
    }
  }, [isSelected]);

  if (animationData) {
    return (
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop
        autoplay={isSelected}
        className="h-14 w-14 sm:h-40 sm:w-40"
      />
    );
  }

  // Placeholder while loading
  return <div className="h-14 w-14 sm:h-40 sm:w-40 rounded-full bg-muted animate-pulse" />;
}

interface VoiceSelectorProps {
  value: GrokVoice;
  onChange: (voice: GrokVoice) => void;
  disabled?: boolean;
}

export function VoiceSelector({
  value,
  onChange,
  disabled = false,
}: VoiceSelectorProps) {
  const { t } = useTranslation('voices');
  const [playingVoice, setPlayingVoice] = useState<GrokVoice | null>(null);
  const [playState, setPlayState] = useState<PlayState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayVoice = useCallback(
    async (voice: GrokVoice, e: React.MouseEvent) => {
      e.stopPropagation();

      if (playingVoice === voice && playState === 'playing') {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setPlayState('idle');
        setPlayingVoice(null);
        return;
      }

      setPlayingVoice(voice);
      setPlayState('loading');

      try {
        const response = await fetch('/api/voice-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `Hi, I'm ${voice}. I'd love to be your companion.`,
            voice: voice,
          }),
        });

        if (!response.ok) {
          setPlayState('idle');
          setPlayingVoice(null);
          return;
        }

        setPlayState('idle');
        setPlayingVoice(null);
      } catch (error) {
        console.error('Voice demo error:', error);
        setPlayState('idle');
        setPlayingVoice(null);
      }
    },
    [playingVoice, playState],
  );

  const handleAudioEnd = () => {
    setPlayState('idle');
    setPlayingVoice(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <audio ref={audioRef} onEnded={handleAudioEnd} className="hidden" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {VOICE_OPTIONS.map((option) => {
          const isSelected = value === option.apiName;
          const isPlayingThis = playingVoice === option.apiName;
          const isLoading = isPlayingThis && playState === 'loading';
          const isPlaying = isPlayingThis && playState === 'playing';
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
                'flex w-full rounded-xl border transition-all disabled:cursor-not-allowed disabled:opacity-60 ' +
                'flex-row items-center gap-3 p-3 sm:flex-col sm:items-center sm:gap-0 sm:p-6 sm:text-center ' +
                (isSelected
                  ? 'border-primary ring-2 ring-primary shadow-xl shadow-primary/20'
                  : 'border-border bg-card hover:ring-2 hover:ring-primary hover:shadow-sm')
              }
            >
              {/* Mobile: Avatar on left */}
              <div className="shrink-0 sm:order-2 sm:mt-4">
                <VoiceAvatar
                  option={option}
                  alt={t(nameKey)}
                  isSelected={isSelected}
                />
              </div>

              {/* Mobile: Name + Description in middle */}
              <div className="flex min-w-0 flex-1 flex-col items-start sm:order-1 sm:items-center">
                <p className="text-base font-semibold text-foreground sm:text-lg">
                  {t(nameKey)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground sm:hidden">
                  {t(descriptionKey)}
                </p>
              </div>

              {/* Desktop only: Description */}
              <p className="hidden text-sm text-muted-foreground sm:order-3 sm:mt-4 sm:block">
                {t(descriptionKey)}
              </p>

              {/* Play button */}
              <button
                type="button"
                onClick={(e) => handlePlayVoice(option.apiName, e)}
                disabled={isLoading || disabled}
                className={
                  'shrink-0 flex items-center justify-center rounded-full p-2 transition-all sm:order-4 sm:mt-4 ' +
                  (isPlaying || isLoading
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary')
                }
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isPlaying ? (
                  <StopCircleIcon className="h-5 w-5" />
                ) : (
                  <PlayCircleIcon className="h-5 w-5" />
                )}
              </button>
            </button>
          );
        })}
      </div>
    </div>
  );
}

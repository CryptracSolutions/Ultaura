'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PlayCircleIcon,
  StopCircleIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  SparklesIcon,
  ClockIcon,
  HandRaisedIcon,
  SpeakerWaveIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Container from '~/core/ui/Container';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import Button from '~/core/ui/Button';
import Textarea from '~/core/ui/Textarea';
import LanguageDropdownSwitcher from '~/components/LanguageDropdownSwitcher';
import {
  FALLBACK_LOCALE,
  normalizeLocale,
  toLanguageCode,
} from '~/i18n/locales';
import { VOICE_DEMO, GROK } from '~/lib/ultaura/constants';
import {
  type DemoPresetId,
  getDemoPresetsForLocale,
} from '~/lib/ultaura/demo-presets';

type Voice = (typeof GROK.VOICES)[number];

const TECH_FEATURES = [
  {
    icon: ClockIcon,
    title: 'Real-time responses',
    description: 'Natural conversation flow with no awkward pauses',
  },
  {
    icon: HandRaisedIcon,
    title: 'Natural interruptions',
    description: 'Jump in anytime, just like a real phone call',
  },
  {
    icon: SparklesIcon,
    title: 'Expressive voice',
    description: 'Laughs, sighs, and genuine emotional expression',
  },
  {
    icon: GlobeAltIcon,
    title: '100+ languages',
    description: 'Auto-detection with native-quality accents',
  },
  {
    icon: SpeakerWaveIcon,
    title: 'Crystal clear audio',
    description: 'Optimized for phone calls and hearing clarity',
  },
  {
    icon: UserGroupIcon,
    title: '5 voice personalities',
    description: 'Choose the voice that feels right for your loved one',
  },
];

type PlayState = 'idle' | 'loading' | 'playing' | 'error';

export default function DemoPage() {
  const { i18n } = useTranslation();

  // Text input state
  const [customText, setCustomText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<DemoPresetId | null>(
    null,
  );
  const [selectedLocale, setSelectedLocale] = useState(() => {
    return (
      normalizeLocale(
        i18n.resolvedLanguage ?? i18n.language ?? FALLBACK_LOCALE,
      ) ?? FALLBACK_LOCALE
    );
  });

  // Playback state
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio ref for playback
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSelectedLocale(
      normalizeLocale(
        i18n.resolvedLanguage ?? i18n.language ?? FALLBACK_LOCALE,
      ) ?? FALLBACK_LOCALE,
    );
  }, [i18n.language, i18n.resolvedLanguage]);

  const demoPresets = getDemoPresetsForLocale(selectedLocale);

  // Get the current text to play
  const currentText = customText;

  // Handle preset selection
  const handlePresetClick = (presetId: DemoPresetId) => {
    const selectedPhrase = demoPresets.find((preset) => preset.id === presetId);

    if (!selectedPhrase) {
      return;
    }

    setSelectedPreset(presetId);
    setCustomText(selectedPhrase.text);
    setErrorMessage(null);
  };

  useEffect(() => {
    if (!selectedPreset) {
      return;
    }

    const localizedPreset = demoPresets.find(
      (preset) => preset.id === selectedPreset,
    );

    if (localizedPreset) {
      setCustomText(localizedPreset.text);
    }
  }, [demoPresets, selectedPreset]);

  // Handle custom text change
  const handleCustomTextChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setCustomText(e.target.value);
    setSelectedPreset(null); // Clear preset when typing custom text
    setErrorMessage(null);
  };

  // Handle voice play
  const handlePlayVoice = useCallback(
    async (voice: Voice) => {
      // If already playing this voice, stop it
      if (selectedVoice === voice && playState === 'playing') {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setPlayState('idle');
        setSelectedVoice(null);
        return;
      }

      // Check if there's text to play
      if (!currentText.trim()) {
        setErrorMessage(
          'Please enter some text or select a preset phrase first.',
        );
        return;
      }

      setSelectedVoice(voice);
      setPlayState('loading');
      setErrorMessage(null);

      try {
        const locale = normalizeLocale(selectedLocale) ?? FALLBACK_LOCALE;
        const response = await fetch('/api/voice-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: currentText,
            voice: voice,
            language: toLanguageCode(locale),
            locale,
          }),
        });

        const data = await response.json();

        if (response.status === 503) {
          // API not yet available - show friendly message
          setPlayState('idle');
          setErrorMessage(
            "Voice demo coming soon! We're waiting for the xAI TTS API to launch.",
          );
          return;
        }

        if (response.status === 429) {
          setPlayState('error');
          setErrorMessage(
            'Too many requests. Please wait a moment and try again.',
          );
          return;
        }

        if (!response.ok) {
          setPlayState('error');
          setErrorMessage(
            data.error || 'Something went wrong. Please try again.',
          );
          return;
        }

        // When TTS API is available, this will handle audio playback:
        // const audioBlob = await response.blob();
        // const audioUrl = URL.createObjectURL(audioBlob);
        // if (audioRef.current) {
        //   audioRef.current.src = audioUrl;
        //   audioRef.current.play();
        // }

        setPlayState('idle');
      } catch (error) {
        console.error('Voice demo error:', error);
        setPlayState('error');
        setErrorMessage(
          'Failed to connect. Please check your internet connection.',
        );
      }
    },
    [currentText, playState, selectedLocale, selectedVoice],
  );

  // Handle audio end
  const handleAudioEnd = () => {
    setPlayState('idle');
    setSelectedVoice(null);
  };

  return (
    <div className="flex flex-col pb-24">
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} onEnded={handleAudioEnd} className="hidden" />

      {/* Hero + Demo */}
      <section className="relative overflow-hidden">
        <div className="ultaura-surface-wash">
          <Container>
            <div className="relative pt-6 pb-20 lg:pt-10 sm:pb-24">
              <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
              <div className="absolute -right-24 bottom-8 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -right-10 top-0 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />

              <div className="relative grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
                <div className="flex flex-col space-y-6">
                  <div className="inline-flex w-fit items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                    Hear the difference
                  </div>

                  <Heading
                    type={1}
                    className="text-4xl md:text-5xl xl:text-6xl"
                  >
                    <span className="block leading-[1.1]">Meet the voices</span>
                    <span className="block leading-[1.1]">
                      of{' '}
                      <span className="text-transparent bg-gradient-to-br bg-clip-text from-primary to-primary/70">
                        Ultaura
                      </span>
                    </span>
                  </Heading>

                  <SubHeading className="max-w-2xl">
                    Five distinct voice personalities, each designed to feel
                    warm, natural, and genuinely engaging.
                  </SubHeading>

                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {[
                      'Works on any phone',
                      'No app required',
                      '100+ languages',
                      'Natural interruptions',
                    ].map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1"
                      >
                        <CheckCircleIcon className="h-4 w-4 text-primary" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-border/60 bg-sidebar p-6 shadow-xl backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      Demo studio
                    </div>
                    <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                      <LanguageDropdownSwitcher
                        onChange={(locale) =>
                          setSelectedLocale(
                            normalizeLocale(locale) ?? FALLBACK_LOCALE,
                          )
                        }
                        className="w-auto"
                        triggerClassName="!w-auto h-8 min-h-[32px] min-w-[8.5rem] border-border/70 bg-background/80 px-2 py-1 text-[11px] shadow-sm sm:h-9 sm:min-h-[36px] sm:text-xs"
                        contentClassName="!w-[calc(var(--radix-select-trigger-width)+8px)] !min-w-[calc(var(--radix-select-trigger-width)+8px)]"
                        ariaLabel="Select demo language"
                      />
                    </div>
                  </div>

                  <div className="mt-6 space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          1
                        </span>
                        <Heading type={4} className="text-base">
                          What should they say?
                        </Heading>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Choose a preset phrase
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {demoPresets.map((phrase) => (
                          <button
                            key={phrase.id}
                            onClick={() => handlePresetClick(phrase.id)}
                            className={
                              'px-4 py-2 rounded-full text-sm font-medium transition-all' +
                              (selectedPreset === phrase.id
                                ? ' bg-primary text-primary-foreground shadow-md'
                                : ' bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground')
                            }
                          >
                            {phrase.label}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          or write your own
                        </p>
                        <Textarea
                          value={customText}
                          onChange={handleCustomTextChange}
                          placeholder="Type your own text here..."
                          maxLength={VOICE_DEMO.MAX_TEXT_LENGTH}
                          rows={3}
                          className={
                            'min-h-[96px] resize-none rounded-xl bg-background px-4 py-3 text-base sm:text-sm' +
                            (selectedPreset
                              ? ' border-primary/30 bg-primary/5'
                              : '')
                          }
                        />

                        {errorMessage && (
                          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                            {errorMessage}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          2
                        </span>
                        <Heading type={4} className="text-base">
                          Choose a voice
                        </Heading>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Click a voice to hear your text spoken aloud
                      </p>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {GROK.VOICES.map((voice) => {
                          const voiceInfo = VOICE_DEMO.VOICE_INFO[voice];
                          const isSelected = selectedVoice === voice;
                          const isLoading =
                            isSelected && playState === 'loading';
                          const isPlaying =
                            isSelected && playState === 'playing';

                          return (
                            <button
                              key={voice}
                              onClick={() => handlePlayVoice(voice)}
                              disabled={playState === 'loading' && !isSelected}
                              className={
                                'group relative flex flex-col items-center rounded-2xl border p-5' +
                                ' transition-all duration-200 text-left disabled:opacity-50' +
                                (isSelected
                                  ? ' border-primary bg-primary/5 shadow-lg shadow-primary/10'
                                  : ' border-border bg-background hover:border-primary/50 hover:shadow-md')
                              }
                            >
                              <div
                                className={
                                  'mb-4 rounded-full p-3 transition-colors' +
                                  (isPlaying || isLoading
                                    ? ' bg-primary text-primary-foreground'
                                    : ' bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground')
                                }
                              >
                                {isLoading ? (
                                  <Loader2 className="h-7 w-7 animate-spin" />
                                ) : isPlaying ? (
                                  <StopCircleIcon className="h-7 w-7" />
                                ) : (
                                  <PlayCircleIcon className="h-7 w-7" />
                                )}
                              </div>

                              <h3 className="text-base font-semibold text-foreground">
                                {voice}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1 text-center">
                                {voiceInfo.description}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-1 justify-center">
                                {voiceInfo.traits.map((trait) => (
                                  <span
                                    key={trait}
                                    className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                                  >
                                    {trait}
                                  </span>
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </div>
      </section>

      {/* Technology Features */}
      <section className="bg-surface-subtle py-20">
        <Container>
          <div className="space-y-12">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                Next-generation voice AI
              </div>
              <Heading type={2}>What makes Ultaura different</Heading>
              <SubHeading className="max-w-2xl mx-auto">
                Built on cutting-edge technology that makes every conversation
                feel genuine.
              </SubHeading>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              {TECH_FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="group flex items-start gap-4 rounded-2xl border border-border/60 bg-sidebar p-6 shadow-xl transition-colors hover:border-primary/30"
                >
                  <div className="rounded-xl border border-primary/10 bg-primary/10 p-3 transition-colors duration-200 group-hover:border-primary group-hover:bg-primary">
                    <feature.icon className="h-5 w-5 text-primary transition-colors duration-200 group-hover:text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* CTA Section */}
      <section>
        <Container>
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <Heading type={2}>Ready to get started?</Heading>
            <p className="text-lg text-muted-foreground">
              Give your loved one a companion who&apos;s always happy to listen.
              Start with a 3-day free trial, no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" round href="/auth/sign-up">
                Start 3-day free trial
              </Button>
              <Button
                size="lg"
                round
                variant="outline"
                href="/pricing"
                className="border-primary/30 text-primary hover:bg-primary/5"
              >
                View Pricing
              </Button>
            </div>
            <div className="flex flex-wrap gap-4 justify-center text-sm text-muted-foreground">
              {['Works on any phone', 'No app required', 'Cancel anytime'].map(
                (item) => (
                  <span key={item} className="flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4 text-primary" />
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

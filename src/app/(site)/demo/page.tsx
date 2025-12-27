'use client';

import { useState, useRef, useCallback } from 'react';
import {
  PlayCircleIcon,
  StopCircleIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  SparklesIcon,
  ClockIcon,
  HandRaisedIcon,
  SpeakerWaveIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';

import Container from '~/core/ui/Container';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import Button from '~/core/ui/Button';
import { VOICE_DEMO, GROK } from '~/lib/ultaura/constants';

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
  // Text input state
  const [customText, setCustomText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Playback state
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio ref for playback
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get the current text to play
  const currentText = selectedPreset
    ? VOICE_DEMO.PRESET_PHRASES.find((p) => p.id === selectedPreset)?.text || ''
    : customText;

  // Handle preset selection
  const handlePresetClick = (presetId: string) => {
    if (selectedPreset === presetId) {
      setSelectedPreset(null);
    } else {
      setSelectedPreset(presetId);
      setCustomText(''); // Clear custom text when preset is selected
    }
    setErrorMessage(null);
  };

  // Handle custom text change
  const handleCustomTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
        setErrorMessage('Please enter some text or select a preset phrase first.');
        return;
      }

      setSelectedVoice(voice);
      setPlayState('loading');
      setErrorMessage(null);

      try {
        const response = await fetch('/api/voice-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: currentText,
            voice: voice,
          }),
        });

        const data = await response.json();

        if (response.status === 503) {
          // API not yet available - show friendly message
          setPlayState('idle');
          setErrorMessage(
            'Voice demo coming soon! We\'re waiting for the xAI TTS API to launch.'
          );
          return;
        }

        if (response.status === 429) {
          setPlayState('error');
          setErrorMessage('Too many requests. Please wait a moment and try again.');
          return;
        }

        if (!response.ok) {
          setPlayState('error');
          setErrorMessage(data.error || 'Something went wrong. Please try again.');
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
        setErrorMessage('Failed to connect. Please check your internet connection.');
      }
    },
    [currentText, selectedVoice, playState]
  );

  // Handle audio end
  const handleAudioEnd = () => {
    setPlayState('idle');
    setSelectedVoice(null);
  };

  return (
    <div className="flex flex-col space-y-24 pb-24">
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} onEnded={handleAudioEnd} className="hidden" />

      {/* Hero */}
      <div className="bg-muted/30 py-24">
        <Container>
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Hear the difference
            </div>
            <Heading type={1}>Meet the voices of Ultaura</Heading>
            <SubHeading className="max-w-2xl mx-auto">
              Five distinct voice personalities, each designed to feel warm,
              natural, and genuinely engaging.
            </SubHeading>
          </div>
        </Container>
      </div>

      {/* Text Input Section */}
      <Container>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center">
            <Heading type={2}>What should they say?</Heading>
            <p className="mt-2 text-muted-foreground">
              Choose a preset phrase or write your own
            </p>
          </div>

          {/* Preset Phrase Buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            {VOICE_DEMO.PRESET_PHRASES.map((phrase) => (
              <button
                key={phrase.id}
                onClick={() => handlePresetClick(phrase.id)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${
                    selectedPreset === phrase.id
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }
                `}
              >
                {phrase.label}
              </button>
            ))}
          </div>

          {/* Custom Text Input */}
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={selectedPreset ? '' : customText}
                onChange={handleCustomTextChange}
                placeholder={
                  selectedPreset
                    ? VOICE_DEMO.PRESET_PHRASES.find((p) => p.id === selectedPreset)
                        ?.text
                    : 'Or type your own text here...'
                }
                disabled={!!selectedPreset}
                maxLength={VOICE_DEMO.MAX_TEXT_LENGTH}
                rows={3}
                className={`
                  w-full rounded-xl border bg-background px-4 py-3 text-foreground
                  placeholder:text-muted-foreground focus:outline-none focus:ring-2
                  focus:ring-primary/50 resize-none transition-colors
                  ${
                    selectedPreset
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border'
                  }
                `}
              />
              <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                {(selectedPreset
                  ? VOICE_DEMO.PRESET_PHRASES.find((p) => p.id === selectedPreset)
                      ?.text.length || 0
                  : customText.length
                )}{' '}
                / {VOICE_DEMO.MAX_TEXT_LENGTH}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      </Container>

      {/* Voice Selector */}
      <Container>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <Heading type={2}>Choose a voice</Heading>
            <p className="mt-2 text-muted-foreground">
              Click a voice to hear your text spoken aloud
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {GROK.VOICES.map((voice) => {
              const voiceInfo = VOICE_DEMO.VOICE_INFO[voice];
              const isSelected = selectedVoice === voice;
              const isLoading = isSelected && playState === 'loading';
              const isPlaying = isSelected && playState === 'playing';

              return (
                <button
                  key={voice}
                  onClick={() => handlePlayVoice(voice)}
                  disabled={playState === 'loading' && !isSelected}
                  className={`
                    group relative flex flex-col items-center rounded-2xl border p-6
                    transition-all duration-200 text-left disabled:opacity-50
                    ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                        : 'border-border bg-background hover:border-primary/50 hover:shadow-md'
                    }
                  `}
                >
                  {/* Play/Stop/Loading Icon */}
                  <div
                    className={`
                      mb-4 rounded-full p-4 transition-colors
                      ${
                        isPlaying || isLoading
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                      }
                    `}
                  >
                    {isLoading ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : isPlaying ? (
                      <StopCircleIcon className="h-8 w-8" />
                    ) : (
                      <PlayCircleIcon className="h-8 w-8" />
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-foreground">
                    {voice}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {voiceInfo.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1 justify-center">
                    {voiceInfo.traits.map((trait) => (
                      <span
                        key={trait}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Interactive voice demo coming soon — API integration in progress
            </p>
          </div>
        </div>
      </Container>

      {/* Technology Features */}
      <div className="bg-muted/30 py-24">
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
                  className="flex items-start gap-4 rounded-xl border border-border bg-background p-5 shadow-sm"
                >
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <feature.icon className="h-5 w-5" />
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

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span>Powered by Grok Voice Agent</span>
            </div>
          </div>
        </Container>
      </div>

      {/* CTA Section */}
      <Container>
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <Heading type={2}>Ready to get started?</Heading>
          <p className="text-lg text-muted-foreground">
            Give your loved one a companion who&apos;s always happy to listen.
            Start with 20 free minutes, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" round href="/auth/sign-up">
              Start Free Trial
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
              )
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}

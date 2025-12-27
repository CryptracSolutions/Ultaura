'use client';

import { useState } from 'react';
import {
  PlayCircleIcon,
  PauseCircleIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  SparklesIcon,
  ClockIcon,
  HandRaisedIcon,
  SpeakerWaveIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import Button from '~/core/ui/Button';

// Voice sample data - matches GROK.VOICES from constants
const VOICE_SAMPLES = [
  {
    id: 'ara',
    name: 'Ara',
    description: 'Warm and nurturing',
    traits: ['Gentle', 'Comforting', 'Patient'],
  },
  {
    id: 'eve',
    name: 'Eve',
    description: 'Bright and cheerful',
    traits: ['Upbeat', 'Friendly', 'Energetic'],
  },
  {
    id: 'leo',
    name: 'Leo',
    description: 'Calm and reassuring',
    traits: ['Steady', 'Warm', 'Thoughtful'],
  },
  {
    id: 'rex',
    name: 'Rex',
    description: 'Clear and articulate',
    traits: ['Clear', 'Confident', 'Engaging'],
  },
  {
    id: 'sal',
    name: 'Sal',
    description: 'Conversational and natural',
    traits: ['Natural', 'Relaxed', 'Personable'],
  },
];

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

export default function DemoPage() {
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Placeholder for audio playback - will be implemented when samples are ready
  const handlePlayVoice = (voiceId: string) => {
    if (selectedVoice === voiceId && isPlaying) {
      setIsPlaying(false);
    } else {
      setSelectedVoice(voiceId);
      setIsPlaying(true);
      // Audio playback will be added when samples are available
      setTimeout(() => setIsPlaying(false), 3000);
    }
  };

  return (
    <div className="flex flex-col space-y-24 pb-24">
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

      {/* Voice Selector */}
      <Container>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <Heading type={2}>Choose a voice</Heading>
            <p className="mt-2 text-muted-foreground">
              Click to preview each voice personality
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {VOICE_SAMPLES.map((voice) => (
              <button
                key={voice.id}
                onClick={() => handlePlayVoice(voice.id)}
                className={`
                  group relative flex flex-col items-center rounded-2xl border p-6
                  transition-all duration-200 text-left
                  ${
                    selectedVoice === voice.id
                      ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                      : 'border-border bg-background hover:border-primary/50 hover:shadow-md'
                  }
                `}
              >
                {/* Play/Pause Icon */}
                <div
                  className={`
                    mb-4 rounded-full p-4 transition-colors
                    ${
                      selectedVoice === voice.id && isPlaying
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                    }
                  `}
                >
                  {selectedVoice === voice.id && isPlaying ? (
                    <PauseCircleIcon className="h-8 w-8" />
                  ) : (
                    <PlayCircleIcon className="h-8 w-8" />
                  )}
                </div>

                <h3 className="text-lg font-semibold text-foreground">
                  {voice.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {voice.description}
                </p>

                <div className="mt-3 flex flex-wrap gap-1 justify-center">
                  {voice.traits.map((trait) => (
                    <span
                      key={trait}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Voice samples coming soon. Sign up for early access to be
              notified.
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

import { GROK } from './constants';

export type GrokVoice = (typeof GROK.VOICES)[number];
export type VoiceId = 'ara' | 'eve' | 'leo' | 'rex' | 'sal';

export type VoiceOption = {
  id: VoiceId;
  apiName: GrokVoice;
  animationPath: string; // Path to Lottie JSON animation
  traitIds: string[];
};

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'ara',
    apiName: 'Ara',
    animationPath: '/voices/ara.json',
    traitIds: ['gentle', 'comforting', 'patient'],
  },
  {
    id: 'sal',
    apiName: 'Sal',
    animationPath: '/voices/sal.json',
    traitIds: ['natural', 'relaxed', 'personable'],
  },
  {
    id: 'rex',
    apiName: 'Rex',
    animationPath: '/voices/rex.json',
    traitIds: ['clear', 'confident', 'engaging'],
  },
  {
    id: 'eve',
    apiName: 'Eve',
    animationPath: '/voices/eve.json',
    traitIds: ['upbeat', 'friendly', 'energetic'],
  },
  {
    id: 'leo',
    apiName: 'Leo',
    animationPath: '/voices/leo.json',
    traitIds: ['steady', 'warm', 'thoughtful'],
  },
];

export const DEFAULT_GROK_VOICE: GrokVoice = GROK.DEFAULT_VOICE;

export const isGrokVoice = (value: string): value is GrokVoice =>
  (GROK.VOICES as readonly string[]).includes(value);

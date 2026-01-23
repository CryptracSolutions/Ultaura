import { GROK } from './constants';

export type GrokVoice = (typeof GROK.VOICES)[number];
export type VoiceId = 'ara' | 'eve' | 'leo' | 'rex' | 'sal';

export type VoiceOption = {
  id: VoiceId;
  apiName: GrokVoice;
  iconPath: string;
  traitIds: string[];
};

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'ara',
    apiName: 'Ara',
    iconPath: '/voices/ara.svg',
    traitIds: ['gentle', 'comforting', 'patient'],
  },
  {
    id: 'eve',
    apiName: 'Eve',
    iconPath: '/voices/eve.svg',
    traitIds: ['upbeat', 'friendly', 'energetic'],
  },
  {
    id: 'leo',
    apiName: 'Leo',
    iconPath: '/voices/leo.svg',
    traitIds: ['steady', 'warm', 'thoughtful'],
  },
  {
    id: 'rex',
    apiName: 'Rex',
    iconPath: '/voices/rex.svg',
    traitIds: ['clear', 'confident', 'engaging'],
  },
  {
    id: 'sal',
    apiName: 'Sal',
    iconPath: '/voices/sal.svg',
    traitIds: ['natural', 'relaxed', 'personable'],
  },
];

export const DEFAULT_GROK_VOICE: GrokVoice = GROK.DEFAULT_VOICE;

export const isGrokVoice = (value: string): value is GrokVoice =>
  (GROK.VOICES as readonly string[]).includes(value);

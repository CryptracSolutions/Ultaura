import type { CompanionPromptParams } from './index.js';
import { compilePrompt } from './index.js';

export function buildVoiceRealtimePrompt(params: CompanionPromptParams): string {
  return compilePrompt('voice_realtime', params);
}

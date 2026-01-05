import type { CompanionPromptParams, PromptProfile } from '../profiles/index.js';
import { compilePrompt } from '../profiles/index.js';

export function buildCompanionPrompt(
  params: CompanionPromptParams,
  profile: PromptProfile = 'voice_realtime'
): string {
  return compilePrompt(profile, params);
}

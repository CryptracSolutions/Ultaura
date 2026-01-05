import type { CompanionPromptParams } from './index.js';
import { compilePrompt } from './index.js';

export function buildAdminPreviewPrompt(params: CompanionPromptParams): string {
  return compilePrompt('admin_preview', params);
}

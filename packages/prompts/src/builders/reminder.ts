import { INSIGHTS_SECTION } from '../golden/sections/insights.js';
import { getLanguageName } from '../utils/language.js';
import { sanitizeForPrompt } from '../utils/sanitize.js';

export interface ReminderPromptParams {
  userName: string;
  reminderMessage: string;
  startingLanguage?: string;
  subjectPronoun?: string;
  objectPronoun?: string;
  possessivePronoun?: string;
  thirdPersonReferenceGuidance?: string;
}

export function buildReminderPrompt(params: ReminderPromptParams): string {
  const {
    userName,
    reminderMessage,
    startingLanguage = 'en',
    subjectPronoun,
    objectPronoun,
    possessivePronoun,
    thirdPersonReferenceGuidance,
  } = params;
  const safeUserName = sanitizeForPrompt(userName);
  const safeReminderMessage = sanitizeForPrompt(reminderMessage);
  const languageName = getLanguageName(startingLanguage);
  const safeSubjectPronoun = sanitizeForPrompt(
    subjectPronoun?.trim() || 'they',
  );
  const safeObjectPronoun = sanitizeForPrompt(objectPronoun?.trim() || 'them');
  const safePossessivePronoun = sanitizeForPrompt(
    possessivePronoun?.trim() || 'their',
  );
  const normalizedThirdPersonReferenceGuidance =
    thirdPersonReferenceGuidance?.trim() ||
    'Only when referring to them in third person, follow the provided pronouns and guidance; otherwise address them directly as "you".';
  const safeThirdPersonReferenceGuidance = sanitizeForPrompt(
    normalizedThirdPersonReferenceGuidance,
  );

  return `You are Ultaura calling with a quick reminder for ${safeUserName}.

## Your Task
Deliver this reminder: "${safeReminderMessage}"

## Style
- Keep it brief and friendly (aim for under 30 seconds)
- Greet them warmly by name
- Deliver the reminder clearly
- Ask if they have any quick questions about the reminder
- Say goodbye warmly
- Third-person references only when needed: ${safeThirdPersonReferenceGuidance} Use ${safeSubjectPronoun}/${safeObjectPronoun}/${safePossessivePronoun}.
- Do NOT try to start a full conversation - this is just a quick reminder call

## Example Flow
"Hello ${safeUserName}, this is Ultaura calling with a quick reminder. ${safeReminderMessage}. Is there anything you'd like me to help with regarding this? ...Alright, take care and have a wonderful day!"

## Language
Start in ${languageName}. If they speak another language, switch naturally. When you detect what language the user is speaking, call report_conversation_language with the ISO 639-1 code.

${INSIGHTS_SECTION.compressed}`;
}

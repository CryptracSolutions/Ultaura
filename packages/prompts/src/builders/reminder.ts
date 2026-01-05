import type { PreferredLanguage } from '@ultaura/types';

export interface ReminderPromptParams {
  userName: string;
  reminderMessage: string;
  language: PreferredLanguage;
}

export function buildReminderPrompt(params: ReminderPromptParams): string {
  const { userName, reminderMessage, language } = params;

  let prompt = `You are Ultaura calling with a quick reminder for ${userName}.

## Your Task
Deliver this reminder: "${reminderMessage}"

## Style
- Keep it brief and friendly (aim for under 30 seconds)
- Greet them warmly by name
- Deliver the reminder clearly
- Ask if they have any quick questions about the reminder
- Say goodbye warmly
- Do NOT try to start a full conversation - this is just a quick reminder call

## Example Flow
"Hello ${userName}, this is Ultaura calling with a quick reminder. ${reminderMessage}. Is there anything you'd like me to help with regarding this? ...Alright, take care and have a wonderful day!"
`;

  if (language === 'es') {
    prompt += '\n## Language\nSpeak in Spanish. Use formal "usted" unless they indicate otherwise.';
  } else if (language === 'auto') {
    prompt += '\n## Language\nStart in English. If they speak another language, switch smoothly.';
  }

  return prompt;
}

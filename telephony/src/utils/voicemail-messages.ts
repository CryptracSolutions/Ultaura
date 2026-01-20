import { normalizeLanguageCode } from '@ultaura/prompts';

type VoicemailBehavior = 'brief' | 'detailed';

type VoicemailTemplates = {
  brief: (name: string) => string;
  detailed: (name: string) => string;
  reminderBrief: (name: string) => string;
  reminderDetailed: (name: string) => string;
};

const VOICEMAIL_TEMPLATES: Record<string, VoicemailTemplates> = {
  en: {
    brief: (name) => `Hi ${name}, this is Ultaura. I'll call back soon. Take care!`,
    detailed: (name) => `Hi ${name}, this is Ultaura. I was calling for your check-in. I'll try again later. Take care!`,
    reminderBrief: (name) =>
      `Hi ${name}, this is Ultaura. I was calling about a reminder. I'll try again later. Take care!`,
    reminderDetailed: (name) =>
      `Hi ${name}, this is Ultaura. I was calling about a reminder I have for you. I'll try again later. Take care!`,
  },
  es: {
    brief: (name) => `Hola ${name}, soy Ultaura. Te llamare pronto. Cuidate!`,
    detailed: (name) =>
      `Hola ${name}, soy Ultaura. Te llamaba para tu llamada de bienestar. Volvere a intentarlo mas tarde. Cuidate!`,
    reminderBrief: (name) =>
      `Hola ${name}, soy Ultaura. Te llamaba por un recordatorio. Volvere a intentarlo mas tarde. Cuidate!`,
    reminderDetailed: (name) =>
      `Hola ${name}, soy Ultaura. Te llamaba por un recordatorio que tengo para ti. Volvere a intentarlo mas tarde. Cuidate!`,
  },
  fr: {
    brief: (name) => `Bonjour ${name}, c'est Ultaura. Je rappellerai bientot. Prenez soin de vous!`,
    detailed: (name) =>
      `Bonjour ${name}, c'est Ultaura. Je vous appelais pour votre appel de bien-etre. Je reessaierai plus tard. Prenez soin de vous!`,
    reminderBrief: (name) =>
      `Bonjour ${name}, c'est Ultaura. Je vous appelais au sujet d'un rappel. Je reessaierai plus tard. Prenez soin de vous!`,
    reminderDetailed: (name) =>
      `Bonjour ${name}, c'est Ultaura. Je vous appelais au sujet d'un rappel que j'ai pour vous. Je reessaierai plus tard. Prenez soin de vous!`,
  },
  de: {
    brief: (name) => `Hallo ${name}, hier ist Ultaura. Ich rufe bald wieder an. Passen Sie auf sich auf!`,
    detailed: (name) =>
      `Hallo ${name}, hier ist Ultaura. Ich habe wegen Ihres Check-ins angerufen. Ich versuche es spaeter noch einmal. Passen Sie auf sich auf!`,
    reminderBrief: (name) =>
      `Hallo ${name}, hier ist Ultaura. Ich habe wegen einer Erinnerung angerufen. Ich versuche es spaeter noch einmal. Passen Sie auf sich auf!`,
    reminderDetailed: (name) =>
      `Hallo ${name}, hier ist Ultaura. Ich habe wegen einer Erinnerung fuer Sie angerufen. Ich versuche es spaeter noch einmal. Passen Sie auf sich auf!`,
  },
  it: {
    brief: (name) => `Ciao ${name}, sono Ultaura. Ti richiamero presto. Abbi cura di te!`,
    detailed: (name) =>
      `Ciao ${name}, sono Ultaura. Ti chiamavo per il tuo check-in. Riprovero piu tardi. Abbi cura di te!`,
    reminderBrief: (name) =>
      `Ciao ${name}, sono Ultaura. Ti chiamavo per un promemoria. Riprovero piu tardi. Abbi cura di te!`,
    reminderDetailed: (name) =>
      `Ciao ${name}, sono Ultaura. Ti chiamavo per un promemoria che ho per te. Riprovero piu tardi. Abbi cura di te!`,
  },
  pt: {
    brief: (name) => `Oi ${name}, aqui e a Ultaura. Vou ligar de novo em breve. Se cuide!`,
    detailed: (name) =>
      `Oi ${name}, aqui e a Ultaura. Eu estava ligando para seu check-in. Vou tentar mais tarde. Se cuide!`,
    reminderBrief: (name) =>
      `Oi ${name}, aqui e a Ultaura. Eu estava ligando sobre um lembrete. Vou tentar mais tarde. Se cuide!`,
    reminderDetailed: (name) =>
      `Oi ${name}, aqui e a Ultaura. Eu estava ligando sobre um lembrete que tenho para voce. Vou tentar mais tarde. Se cuide!`,
  },
  ja: {
    brief: (name) => `こんにちは${name}さん、ウルタウラです。またすぐにお電話します。お元気で。`,
    detailed: (name) =>
      `こんにちは${name}さん、ウルタウラです。お元気確認のお電話でした。また後でお電話します。お元気で。`,
    reminderBrief: (name) =>
      `こんにちは${name}さん、ウルタウラです。リマインダーの件でお電話しました。また後でお電話します。お元気で。`,
    reminderDetailed: (name) =>
      `こんにちは${name}さん、ウルタウラです。お伝えしたいリマインダーがありお電話しました。また後でお電話します。お元気で。`,
  },
  ko: {
    brief: (name) => `${name}님, 안녕하세요. 울타우라입니다. 곧 다시 전화드릴게요. 건강히 지내세요.`,
    detailed: (name) =>
      `${name}님, 안녕하세요. 울타우라입니다. 안부 확인을 위해 전화드렸어요. 나중에 다시 전화드릴게요. 건강히 지내세요.`,
    reminderBrief: (name) =>
      `${name}님, 안녕하세요. 울타우라입니다. 리마인더 때문에 전화드렸어요. 나중에 다시 전화드릴게요. 건강히 지내세요.`,
    reminderDetailed: (name) =>
      `${name}님, 안녕하세요. 울타우라입니다. 전해드릴 리마인더가 있어서 전화드렸어요. 나중에 다시 전화드릴게요. 건강히 지내세요.`,
  },
  zh: {
    brief: (name) => `您好，${name}，我是Ultaura。很快再给您打电话。请保重！`,
    detailed: (name) =>
      `您好，${name}，我是Ultaura。我是来做您的关怀通话的。稍后我会再联系您。请保重！`,
    reminderBrief: (name) =>
      `您好，${name}，我是Ultaura。我打电话是关于一个提醒。稍后我会再联系您。请保重！`,
    reminderDetailed: (name) =>
      `您好，${name}，我是Ultaura。我打电话是关于我给您的一个提醒。稍后我会再联系您。请保重！`,
  },
};

export function getVoicemailMessage(options: {
  name: string;
  language: string;
  preferredLanguageIso: string | null;
  behavior: VoicemailBehavior;
  isReminderCall: boolean;
}): string {
  const { name, language, preferredLanguageIso, behavior, isReminderCall } = options;

  let effectiveLanguage = language;
  if (preferredLanguageIso === null) {
    effectiveLanguage = 'en';
  } else if (preferredLanguageIso && VOICEMAIL_TEMPLATES[preferredLanguageIso]) {
    effectiveLanguage = preferredLanguageIso;
  }

  const normalized = normalizeLanguageCode(effectiveLanguage);
  const templates = VOICEMAIL_TEMPLATES[normalized] ?? VOICEMAIL_TEMPLATES.en;

  if (isReminderCall) {
    return behavior === 'detailed'
      ? templates.reminderDetailed(name)
      : templates.reminderBrief(name);
  }

  return behavior === 'detailed' ? templates.detailed(name) : templates.brief(name);
}

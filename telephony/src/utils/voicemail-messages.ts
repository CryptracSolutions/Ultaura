import { normalizeLanguageCode } from '@ultaura/prompts';

type VoicemailBehavior = 'brief' | 'detailed';

type VoicemailTemplates = {
  brief: (name: string) => string;
  detailed: (name: string) => string;
  reminderDetailed: (name: string, reminderMessage: string) => string;
};

const VOICEMAIL_TEMPLATES: Record<string, VoicemailTemplates> = {
  en: {
    brief: (name) => `Hi ${name}, this is Ultaura. I'll call back soon. Take care!`,
    detailed: (name) => `Hi ${name}, this is Ultaura. I was calling for your check-in. I'll try again later. Take care!`,
    reminderDetailed: (name, message) =>
      `Hi ${name}, this is Ultaura. I was calling to remind you: ${message}. I'll try again later. Take care!`,
  },
  es: {
    brief: (name) => `Hola ${name}, soy Ultaura. Te llamare pronto. Cuidate!`,
    detailed: (name) =>
      `Hola ${name}, soy Ultaura. Te llamaba para tu llamada de bienestar. Volvere a intentarlo mas tarde. Cuidate!`,
    reminderDetailed: (name, message) =>
      `Hola ${name}, soy Ultaura. Te llamaba para recordarte: ${message}. Volvere a intentarlo mas tarde. Cuidate!`,
  },
  fr: {
    brief: (name) => `Bonjour ${name}, c'est Ultaura. Je rappellerai bientot. Prenez soin de vous!`,
    detailed: (name) =>
      `Bonjour ${name}, c'est Ultaura. Je vous appelais pour votre appel de bien-etre. Je reessaierai plus tard. Prenez soin de vous!`,
    reminderDetailed: (name, message) =>
      `Bonjour ${name}, c'est Ultaura. Je vous appelais pour vous rappeler: ${message}. Je reessaierai plus tard. Prenez soin de vous!`,
  },
  de: {
    brief: (name) => `Hallo ${name}, hier ist Ultaura. Ich rufe bald wieder an. Passen Sie auf sich auf!`,
    detailed: (name) =>
      `Hallo ${name}, hier ist Ultaura. Ich habe wegen Ihres Check-ins angerufen. Ich versuche es spaeter noch einmal. Passen Sie auf sich auf!`,
    reminderDetailed: (name, message) =>
      `Hallo ${name}, hier ist Ultaura. Ich wollte Sie erinnern: ${message}. Ich versuche es spaeter noch einmal. Passen Sie auf sich auf!`,
  },
  it: {
    brief: (name) => `Ciao ${name}, sono Ultaura. Ti richiamero presto. Abbi cura di te!`,
    detailed: (name) =>
      `Ciao ${name}, sono Ultaura. Ti chiamavo per il tuo check-in. Riprovero piu tardi. Abbi cura di te!`,
    reminderDetailed: (name, message) =>
      `Ciao ${name}, sono Ultaura. Ti chiamavo per ricordarti: ${message}. Riprovero piu tardi. Abbi cura di te!`,
  },
  pt: {
    brief: (name) => `Oi ${name}, aqui e a Ultaura. Vou ligar de novo em breve. Se cuide!`,
    detailed: (name) =>
      `Oi ${name}, aqui e a Ultaura. Eu estava ligando para seu check-in. Vou tentar mais tarde. Se cuide!`,
    reminderDetailed: (name, message) =>
      `Oi ${name}, aqui e a Ultaura. Eu estava ligando para lembrar voce: ${message}. Vou tentar mais tarde. Se cuide!`,
  },
  ja: {
    brief: (name) => `こんにちは${name}さん、ウルタウラです。またすぐにお電話します。お元気で。`,
    detailed: (name) =>
      `こんにちは${name}さん、ウルタウラです。お元気確認のお電話でした。また後でお電話します。お元気で。`,
    reminderDetailed: (name, message) =>
      `こんにちは${name}さん、ウルタウラです。お知らせのためにお電話しました：${message}。また後でお電話します。お元気で。`,
  },
  ko: {
    brief: (name) => `${name}님, 안녕하세요. 울타우라입니다. 곧 다시 전화드릴게요. 건강히 지내세요.`,
    detailed: (name) =>
      `${name}님, 안녕하세요. 울타우라입니다. 안부 확인을 위해 전화드렸어요. 나중에 다시 전화드릴게요. 건강히 지내세요.`,
    reminderDetailed: (name, message) =>
      `${name}님, 안녕하세요. 울타우라입니다. 다음 내용을 알려드리려고 전화드렸어요: ${message}. 나중에 다시 전화드릴게요. 건강히 지내세요.`,
  },
  zh: {
    brief: (name) => `您好，${name}，我是Ultaura。很快再给您打电话。请保重！`,
    detailed: (name) =>
      `您好，${name}，我是Ultaura。我是来做您的关怀通话的。稍后我会再联系您。请保重！`,
    reminderDetailed: (name, message) =>
      `您好，${name}，我是Ultaura。我打电话是提醒您：${message}。稍后我会再联系您。请保重！`,
  },
};

export function getVoicemailMessage(options: {
  name: string;
  language: string;
  behavior: VoicemailBehavior;
  isReminderCall: boolean;
  reminderMessage?: string | null;
}): string {
  const { name, language, behavior, isReminderCall, reminderMessage } = options;
  const normalized = normalizeLanguageCode(language);
  const templates = VOICEMAIL_TEMPLATES[normalized] ?? VOICEMAIL_TEMPLATES.en;

  if (behavior === 'detailed' && isReminderCall && reminderMessage) {
    return templates.reminderDetailed(name, reminderMessage);
  }

  return behavior === 'detailed' ? templates.detailed(name) : templates.brief(name);
}

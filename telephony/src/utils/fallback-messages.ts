import { normalizeLanguageCode } from '@ultaura/prompts';

type FallbackMessageType = 'retry_wait' | 'retry_failed';

type FallbackMessageSet = Record<FallbackMessageType, string>;

const FALLBACK_MESSAGES: Record<string, FallbackMessageSet> = {
  en: {
    retry_wait: "I'm having a brief connection issue. Please hold on just a moment.",
    retry_failed: "I'm so sorry, but I'm experiencing technical difficulties and need to end our call. I'll try calling you back soon. Take care!",
  },
  es: {
    retry_wait: 'Estoy teniendo un peque\u00f1o problema de conexi\u00f3n. Por favor espere un momento.',
    retry_failed: 'Lo siento mucho, pero estoy experimentando dificultades t\u00e9cnicas y necesito terminar nuestra llamada. \u00a1Intentar\u00e9 llamarte pronto! \u00a1Cu\u00eddate!'
  },
  fr: {
    retry_wait: 'Je rencontre un petit probl\u00e8me de connexion. Veuillez patienter un moment.',
    retry_failed: 'Je suis vraiment d\u00e9sol\u00e9, je rencontre des difficult\u00e9s techniques et je dois mettre fin \u00e0 notre appel. Je vous rappellerai bient\u00f4t. Prenez soin de vous !',
  },
  de: {
    retry_wait: 'Ich habe kurz ein Verbindungsproblem. Bitte bleiben Sie einen Moment dran.',
    retry_failed: 'Es tut mir sehr leid, aber ich habe technische Schwierigkeiten und muss unser Gespr\u00e4ch beenden. Ich rufe Sie bald zur\u00fcck. Passen Sie gut auf sich auf!'
  },
  it: {
    retry_wait: 'Sto avendo un breve problema di connessione. Per favore attendi un momento.',
    retry_failed: 'Mi dispiace molto, ma sto riscontrando difficolt\u00e0 tecniche e devo terminare la nostra chiamata. Ti richiamer\u00f2 presto. Abbi cura di te!'
  },
  pt: {
    retry_wait: 'Estou com um pequeno problema de conex\u00e3o. Por favor, aguarde um momento.',
    retry_failed: 'Sinto muito, mas estou com dificuldades t\u00e9cnicas e preciso encerrar nossa liga\u00e7\u00e3o. Vou te ligar de volta em breve. Cuide-se!'
  },
  ja: {
    retry_wait: '\u63a5\u7d9a\u306b\u5c11\u3057\u554f\u984c\u304c\u3042\u308a\u307e\u3059\u3002\u5c11\u3005\u304a\u5f85\u3061\u304f\u3060\u3055\u3044\u3002',
    retry_failed: '\u7533\u3057\u8a33\u3042\u308a\u307e\u305b\u3093\u304c\u3001\u6280\u8853\u7684\u306a\u554f\u984c\u306e\u305f\u3081\u901a\u8a71\u3092\u7d42\u4e86\u3059\u308b\u5fc5\u8981\u304c\u3042\u308a\u307e\u3059\u3002\u3059\u3050\u306b\u304a\u304b\u3051\u76f4\u3057\u3057\u307e\u3059\u3002\u304a\u4f53\u306b\u6c17\u3092\u3064\u3051\u3066\u304f\u3060\u3055\u3044\uff01'
  },
  ko: {
    retry_wait: '\uc5f0\uacb0\uc5d0 \uc7a0\uc2dc \ubb38\uc81c\uac00 \uc788\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc\ub9cc \uae30\ub2e4\ub824 \uc8fc\uc138\uc694.',
    retry_failed: '\uc815\ub9d0 \uc8c4\uc1a1\ud558\uc9c0\ub9cc \uae30\uc220\uc801\uc778 \ubb38\uc81c\ub85c \ud1b5\ud654\ub97c \uc885\ub8cc\ud574\uc57c \ud569\ub2c8\ub2e4. \uace7 \ub2e4\uc2dc \uc804\ud654\ub4dc\ub9b4\uac8c\uc694. \uac74\uac15\ud558\uc138\uc694!'
  },
  zh: {
    retry_wait: '\u6211\u8fd9\u8fb9\u9047\u5230\u4e86\u4e00\u70b9\u8fde\u63a5\u95ee\u9898\uff0c\u8bf7\u7a0d\u7b49\u4e00\u4e0b\u3002',
    retry_failed: '\u975e\u5e38\u62b1\u6b49\uff0c\u6211\u9047\u5230\u4e86\u6280\u672f\u95ee\u9898\uff0c\u9700\u8981\u7ed3\u675f\u6211\u4eec\u7684\u901a\u8bdd\u3002\u6211\u4f1a\u5c3d\u5feb\u518d\u7ed9\u60a8\u6253\u7535\u8bdd\u3002\u8bf7\u4fdd\u91cd\uff01'
  },
};

export function getFallbackMessage(language: string, type: FallbackMessageType): string {
  const normalized = normalizeLanguageCode(language || 'en');
  const messages = FALLBACK_MESSAGES[normalized] ?? FALLBACK_MESSAGES.en;
  return messages[type];
}

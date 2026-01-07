import { normalizeLanguageCode } from '@ultaura/prompts';

type FallbackMessageType = 'retry_wait' | 'retry_failed';

type FallbackMessageSet = Record<FallbackMessageType, string>;

const FALLBACK_MESSAGES: Record<string, FallbackMessageSet> = {
  en: {
    retry_wait: "I'm sorry, I'm having a little trouble right now. Let me try again.",
    retry_failed: "I apologize, I'll need to call you back. Take care!",
  },
  es: {
    retry_wait: 'Lo siento, estoy teniendo un peque\u00f1o problema. D\u00e9jame intentar de nuevo.',
    retry_failed: 'Me disculpo, tendr\u00e9 que llamarte de nuevo. \u00a1Cu\u00eddate!'
  },
  fr: {
    retry_wait: "Je suis d\u00e9sol\u00e9, j'ai un petit probl\u00e8me. Laissez-moi r\u00e9essayer.",
    retry_failed: "Je m'excuse, je devrai vous rappeler. Prenez soin de vous!",
  },
  de: {
    retry_wait: 'Es tut mir leid, ich habe gerade ein kleines Problem. Lass mich es noch einmal versuchen.',
    retry_failed: 'Ich entschuldige mich, ich muss Sie zur\u00fcckrufen. Pass auf dich auf!'
  },
  it: {
    retry_wait: 'Mi dispiace, sto avendo un piccolo problema. Fammi riprovare.',
    retry_failed: 'Mi scuso, dovr\u00f2 richiamarti. Abbi cura di te!'
  },
  pt: {
    retry_wait: 'Desculpe, estou tendo um pequeno problema. Deixe-me tentar novamente.',
    retry_failed: 'Pe\u00e7o desculpas, precisarei ligar de volta. Cuide-se!'
  },
  ja: {
    retry_wait: '\u7533\u3057\u8a33\u3042\u308a\u307e\u305b\u3093\u3001\u5c11\u3057\u554f\u984c\u304c\u767a\u751f\u3057\u3066\u3044\u307e\u3059\u3002\u3082\u3046\u4e00\u5ea6\u8a66\u3057\u3066\u307f\u307e\u3059\u3002',
    retry_failed: '\u7533\u3057\u8a33\u3042\u308a\u307e\u305b\u3093\u304c\u3001\u5f8c\u307b\u3069\u304a\u96fb\u8a71\u3044\u305f\u3057\u307e\u3059\u3002\u304a\u4f53\u306b\u6c17\u3092\u3064\u3051\u3066\u304f\u3060\u3055\u3044\uff01'
  },
  ko: {
    retry_wait: '\uc8c4\uc1a1\ud569\ub2c8\ub2e4, \uc57d\uac04\uc758 \ubb38\uc81c\uac00 \uc788\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \ubcfc\uac8c\uc694.',
    retry_failed: '\uc8c4\uc1a1\ud569\ub2c8\ub2e4, \ub2e4\uc2dc \uc804\ud654\ub4dc\ub824\uc57c \ud560 \uac83 \uac19\uc2b5\ub2c8\ub2e4. \uac74\uac15\ud558\uc138\uc694!'
  },
  zh: {
    retry_wait: '\u62b1\u6b49\uff0c\u6211\u73b0\u5728\u9047\u5230\u4e86\u4e00\u70b9\u95ee\u9898\u3002\u8ba9\u6211\u518d\u8bd5\u4e00\u6b21\u3002',
    retry_failed: '\u62b1\u6b49\uff0c\u6211\u9700\u8981\u7a0d\u540e\u518d\u7ed9\u60a8\u6253\u7535\u8bdd\u3002\u4fdd\u91cd\uff01'
  },
};

export function getFallbackMessage(language: string, type: FallbackMessageType): string {
  const normalized = normalizeLanguageCode(language || 'en');
  const messages = FALLBACK_MESSAGES[normalized] ?? FALLBACK_MESSAGES.en;
  return messages[type];
}

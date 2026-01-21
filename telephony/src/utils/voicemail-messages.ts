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
    brief: (name) => `Hola ${name}, soy Ultaura. Te llamaré pronto. ¡Cuídate!`,
    detailed: (name) =>
      `Hola ${name}, soy Ultaura. Te llamaba para tu check-in. Volveré a intentarlo más tarde. ¡Cuídate!`,
    reminderBrief: (name) =>
      `Hola ${name}, soy Ultaura. Te llamaba por un recordatorio. Volveré a intentarlo más tarde. ¡Cuídate!`,
    reminderDetailed: (name) =>
      `Hola ${name}, soy Ultaura. Te llamaba por un recordatorio que tengo para ti. Volveré a intentarlo más tarde. ¡Cuídate!`,
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
  nl: {
    brief: (name) => `Hoi ${name}, met Ultaura. Ik bel je binnenkort terug. Zorg goed voor jezelf!`,
    detailed: (name) =>
      `Hoi ${name}, met Ultaura. Ik belde voor je check-in. Ik probeer het later opnieuw. Zorg goed voor jezelf!`,
    reminderBrief: (name) =>
      `Hoi ${name}, met Ultaura. Ik belde over een herinnering. Ik probeer het later opnieuw. Zorg goed voor jezelf!`,
    reminderDetailed: (name) =>
      `Hoi ${name}, met Ultaura. Ik belde over een herinnering die ik voor je heb. Ik probeer het later opnieuw. Zorg goed voor jezelf!`,
  },
  ru: {
    brief: (name) => `Здравствуйте, ${name}, это Ultaura. Я перезвоню вам скоро. Берегите себя!`,
    detailed: (name) =>
      `Здравствуйте, ${name}, это Ultaura. Я звонила, чтобы сделать короткий check-in. Я попробую позже. Берегите себя!`,
    reminderBrief: (name) =>
      `Здравствуйте, ${name}, это Ultaura. Я звонила по поводу напоминания. Я попробую позже. Берегите себя!`,
    reminderDetailed: (name) =>
      `Здравствуйте, ${name}, это Ultaura. Я звонила по поводу напоминания, которое у меня для вас. Я попробую позже. Берегите себя!`,
  },
  ar: {
    brief: (name) => `مرحباً ${name}، معك Ultaura. سأتصل بك مرة أخرى قريباً. اعتنِ بنفسك!`,
    detailed: (name) =>
      `مرحباً ${name}، معك Ultaura. كنت أتصل للاطمئنان عليك. سأحاول مرة أخرى لاحقاً. اعتنِ بنفسك!`,
    reminderBrief: (name) =>
      `مرحباً ${name}، معك Ultaura. كنت أتصل بخصوص تذكير. سأحاول مرة أخرى لاحقاً. اعتنِ بنفسك!`,
    reminderDetailed: (name) =>
      `مرحباً ${name}، معك Ultaura. كنت أتصل بخصوص تذكير لدي لك. سأحاول مرة أخرى لاحقاً. اعتنِ بنفسك!`,
  },
  hi: {
    brief: (name) => `नमस्ते ${name}, यह Ultaura है। मैं जल्द ही फिर से कॉल करूंगा। अपना ख्याल रखें!`,
    detailed: (name) =>
      `नमस्ते ${name}, यह Ultaura है। मैं आपके check-in के लिए कॉल कर रहा था। मैं बाद में फिर कोशिश करूंगा। अपना ख्याल रखें!`,
    reminderBrief: (name) =>
      `नमस्ते ${name}, यह Ultaura है। मैं एक रिमाइंडर के बारे में कॉल कर रहा था। मैं बाद में फिर कोशिश करूंगा। अपना ख्याल रखें!`,
    reminderDetailed: (name) =>
      `नमस्ते ${name}, यह Ultaura है। मैं आपके लिए एक रिमाइंडर के बारे में कॉल कर रहा था। मैं बाद में फिर कोशिश करूंगा। अपना ख्याल रखें!`,
  },
  tr: {
    brief: (name) => `Merhaba ${name}, ben Ultaura. Yakında tekrar arayacağım. Kendine iyi bak!`,
    detailed: (name) =>
      `Merhaba ${name}, ben Ultaura. Check-in için aramıştım. Daha sonra tekrar deneyeceğim. Kendine iyi bak!`,
    reminderBrief: (name) =>
      `Merhaba ${name}, ben Ultaura. Bir hatırlatma için aramıştım. Daha sonra tekrar deneyeceğim. Kendine iyi bak!`,
    reminderDetailed: (name) =>
      `Merhaba ${name}, ben Ultaura. Senin için bir hatırlatma hakkında aramıştım. Daha sonra tekrar deneyeceğim. Kendine iyi bak!`,
  },
  pl: {
    brief: (name) => `Cześć ${name}, tu Ultaura. Oddzwonię wkrótce. Trzymaj się!`,
    detailed: (name) =>
      `Cześć ${name}, tu Ultaura. Dzwonię w sprawie Twojego check-inu. Spróbuję ponownie później. Trzymaj się!`,
    reminderBrief: (name) =>
      `Cześć ${name}, tu Ultaura. Dzwonię w sprawie przypomnienia. Spróbuję ponownie później. Trzymaj się!`,
    reminderDetailed: (name) =>
      `Cześć ${name}, tu Ultaura. Dzwonię w sprawie przypomnienia, które mam dla Ciebie. Spróbuję ponownie później. Trzymaj się!`,
  },
  sv: {
    brief: (name) => `Hej ${name}, det här är Ultaura. Jag ringer tillbaka snart. Ta hand om dig!`,
    detailed: (name) =>
      `Hej ${name}, det här är Ultaura. Jag ringde för din check-in. Jag försöker igen senare. Ta hand om dig!`,
    reminderBrief: (name) =>
      `Hej ${name}, det här är Ultaura. Jag ringde om en påminnelse. Jag försöker igen senare. Ta hand om dig!`,
    reminderDetailed: (name) =>
      `Hej ${name}, det här är Ultaura. Jag ringde om en påminnelse jag har till dig. Jag försöker igen senare. Ta hand om dig!`,
  },
  da: {
    brief: (name) => `Hej ${name}, det er Ultaura. Jeg ringer tilbage snart. Pas godt på dig selv!`,
    detailed: (name) =>
      `Hej ${name}, det er Ultaura. Jeg ringede for din check-in. Jeg prøver igen senere. Pas godt på dig selv!`,
    reminderBrief: (name) =>
      `Hej ${name}, det er Ultaura. Jeg ringede om en påmindelse. Jeg prøver igen senere. Pas godt på dig selv!`,
    reminderDetailed: (name) =>
      `Hej ${name}, det er Ultaura. Jeg ringede om en påmindelse, jeg har til dig. Jeg prøver igen senere. Pas godt på dig selv!`,
  },
  no: {
    brief: (name) => `Hei ${name}, det er Ultaura. Jeg ringer tilbake snart. Ta vare på deg selv!`,
    detailed: (name) =>
      `Hei ${name}, det er Ultaura. Jeg ringte for din check-in. Jeg prøver igjen senere. Ta vare på deg selv!`,
    reminderBrief: (name) =>
      `Hei ${name}, det er Ultaura. Jeg ringte om en påminnelse. Jeg prøver igjen senere. Ta vare på deg selv!`,
    reminderDetailed: (name) =>
      `Hei ${name}, det er Ultaura. Jeg ringte om en påminnelse jeg har til deg. Jeg prøver igjen senere. Ta vare på deg selv!`,
  },
  fi: {
    brief: (name) => `Hei ${name}, täällä Ultaura. Soitan pian uudestaan. Pidä huolta itsestäsi!`,
    detailed: (name) =>
      `Hei ${name}, täällä Ultaura. Soitin kuulumistarkistusta varten. Yritän myöhemmin uudestaan. Pidä huolta itsestäsi!`,
    reminderBrief: (name) =>
      `Hei ${name}, täällä Ultaura. Soitin muistutuksesta. Yritän myöhemmin uudestaan. Pidä huolta itsestäsi!`,
    reminderDetailed: (name) =>
      `Hei ${name}, täällä Ultaura. Soitin muistutuksesta, joka minulla on sinulle. Yritän myöhemmin uudestaan. Pidä huolta itsestäsi!`,
  },
  cs: {
    brief: (name) => `Ahoj ${name}, tady Ultaura. Brzy zavolám zpátky. Opatruj se!`,
    detailed: (name) =>
      `Ahoj ${name}, tady Ultaura. Volám kvůli tvému check-inu. Zkusím to později znovu. Opatruj se!`,
    reminderBrief: (name) =>
      `Ahoj ${name}, tady Ultaura. Volám kvůli připomínce. Zkusím to později znovu. Opatruj se!`,
    reminderDetailed: (name) =>
      `Ahoj ${name}, tady Ultaura. Volám kvůli připomínce, kterou pro tebe mám. Zkusím to později znovu. Opatruj se!`,
  },
  th: {
    brief: (name) => `สวัสดี ${name} นี่คือ Ultaura ฉันจะโทรกลับอีกครั้งเร็ว ๆ นี้ ดูแลตัวเองนะ`,
    detailed: (name) =>
      `สวัสดี ${name} นี่คือ Ultaura ฉันโทรมาเพื่อเช็คอินของคุณ ฉันจะลองใหม่อีกครั้งภายหลัง ดูแลตัวเองนะ`,
    reminderBrief: (name) =>
      `สวัสดี ${name} นี่คือ Ultaura ฉันโทรมาเรื่องการเตือนความจำ ฉันจะลองใหม่อีกครั้งภายหลัง ดูแลตัวเองนะ`,
    reminderDetailed: (name) =>
      `สวัสดี ${name} นี่คือ Ultaura ฉันโทรมาเรื่องการเตือนความจำที่มีให้คุณ ฉันจะลองใหม่อีกครั้งภายหลัง ดูแลตัวเองนะ`,
  },
  vi: {
    brief: (name) => `Chào ${name}, tôi là Ultaura. Tôi sẽ gọi lại sớm. Bạn hãy giữ gìn sức khỏe nhé!`,
    detailed: (name) =>
      `Chào ${name}, tôi là Ultaura. Tôi gọi để hỏi thăm bạn. Tôi sẽ thử lại sau. Bạn hãy giữ gìn sức khỏe nhé!`,
    reminderBrief: (name) =>
      `Chào ${name}, tôi là Ultaura. Tôi gọi về một lời nhắc. Tôi sẽ thử lại sau. Bạn hãy giữ gìn sức khỏe nhé!`,
    reminderDetailed: (name) =>
      `Chào ${name}, tôi là Ultaura. Tôi gọi về lời nhắc mà tôi có cho bạn. Tôi sẽ thử lại sau. Bạn hãy giữ gìn sức khỏe nhé!`,
  },
  id: {
    brief: (name) => `Halo ${name}, saya Ultaura. Saya akan menelepon kembali segera. Jaga diri baik-baik!`,
    detailed: (name) =>
      `Halo ${name}, saya Ultaura. Saya menelepon untuk check-in Anda. Saya akan coba lagi nanti. Jaga diri baik-baik!`,
    reminderBrief: (name) =>
      `Halo ${name}, saya Ultaura. Saya menelepon tentang sebuah pengingat. Saya akan coba lagi nanti. Jaga diri baik-baik!`,
    reminderDetailed: (name) =>
      `Halo ${name}, saya Ultaura. Saya menelepon tentang pengingat yang saya punya untuk Anda. Saya akan coba lagi nanti. Jaga diri baik-baik!`,
  },
  ms: {
    brief: (name) => `Hai ${name}, saya Ultaura. Saya akan hubungi semula tidak lama lagi. Jaga diri!`,
    detailed: (name) =>
      `Hai ${name}, saya Ultaura. Saya menelefon untuk check-in anda. Saya akan cuba lagi nanti. Jaga diri!`,
    reminderBrief: (name) =>
      `Hai ${name}, saya Ultaura. Saya menelefon tentang peringatan. Saya akan cuba lagi nanti. Jaga diri!`,
    reminderDetailed: (name) =>
      `Hai ${name}, saya Ultaura. Saya menelefon tentang peringatan yang saya ada untuk anda. Saya akan cuba lagi nanti. Jaga diri!`,
  },
  tl: {
    brief: (name) => `Kumusta ${name}, ako si Ultaura. Tatawag ako ulit sa lalong madaling panahon. Ingat ka!`,
    detailed: (name) =>
      `Kumusta ${name}, ako si Ultaura. Tumawag ako para sa check-in mo. Susubukan ko ulit mamaya. Ingat ka!`,
    reminderBrief: (name) =>
      `Kumusta ${name}, ako si Ultaura. Tumawag ako tungkol sa isang paalala. Susubukan ko ulit mamaya. Ingat ka!`,
    reminderDetailed: (name) =>
      `Kumusta ${name}, ako si Ultaura. Tumawag ako tungkol sa paalalang mayroon ako para sa iyo. Susubukan ko ulit mamaya. Ingat ka!`,
  },
  uk: {
    brief: (name) => `Привіт, ${name}, це Ultaura. Я передзвоню незабаром. Бережіть себе!`,
    detailed: (name) =>
      `Привіт, ${name}, це Ultaura. Я дзвонила, щоб дізнатися, як ви. Спробую ще раз пізніше. Бережіть себе!`,
    reminderBrief: (name) =>
      `Привіт, ${name}, це Ultaura. Я дзвонила щодо нагадування. Спробую ще раз пізніше. Бережіть себе!`,
    reminderDetailed: (name) =>
      `Привіт, ${name}, це Ultaura. Я дзвонила щодо нагадування, яке маю для вас. Спробую ще раз пізніше. Бережіть себе!`,
  },
  el: {
    brief: (name) => `Γεια σου ${name}, είμαι η Ultaura. Θα σε καλέσω σύντομα ξανά. Να προσέχεις!`,
    detailed: (name) =>
      `Γεια σου ${name}, είμαι η Ultaura. Σε κάλεσα για το check-in σου. Θα προσπαθήσω ξανά αργότερα. Να προσέχεις!`,
    reminderBrief: (name) =>
      `Γεια σου ${name}, είμαι η Ultaura. Σε κάλεσα για μια υπενθύμιση. Θα προσπαθήσω ξανά αργότερα. Να προσέχεις!`,
    reminderDetailed: (name) =>
      `Γεια σου ${name}, είμαι η Ultaura. Σε κάλεσα για μια υπενθύμιση που έχω για εσένα. Θα προσπαθήσω ξανά αργότερα. Να προσέχεις!`,
  },
  he: {
    brief: (name) => `שלום ${name}, כאן Ultaura. אתקשר שוב בקרוב. שמור/י על עצמך!`,
    detailed: (name) =>
      `שלום ${name}, כאן Ultaura. התקשרתי כדי לבדוק מה שלומך. אנסה שוב מאוחר יותר. שמור/י על עצמך!`,
    reminderBrief: (name) =>
      `שלום ${name}, כאן Ultaura. התקשרתי לגבי תזכורת. אנסה שוב מאוחר יותר. שמור/י על עצמך!`,
    reminderDetailed: (name) =>
      `שלום ${name}, כאן Ultaura. התקשרתי לגבי תזכורת שיש לי בשבילך. אנסה שוב מאוחר יותר. שמור/י על עצמך!`,
  },
  ro: {
    brief: (name) => `Salut ${name}, sunt Ultaura. Te sun înapoi în curând. Ai grijă de tine!`,
    detailed: (name) =>
      `Salut ${name}, sunt Ultaura. Te-am sunat pentru check-in-ul tău. Voi încerca din nou mai târziu. Ai grijă de tine!`,
    reminderBrief: (name) =>
      `Salut ${name}, sunt Ultaura. Te-am sunat despre un memento. Voi încerca din nou mai târziu. Ai grijă de tine!`,
    reminderDetailed: (name) =>
      `Salut ${name}, sunt Ultaura. Te-am sunat despre un memento pe care îl am pentru tine. Voi încerca din nou mai târziu. Ai grijă de tine!`,
  },
  hu: {
    brief: (name) => `Szia ${name}, itt Ultaura. Hamarosan visszahívlak. Vigyázz magadra!`,
    detailed: (name) =>
      `Szia ${name}, itt Ultaura. A check-in miatt hívtalak. Később újra próbálom. Vigyázz magadra!`,
    reminderBrief: (name) =>
      `Szia ${name}, itt Ultaura. Egy emlékeztető miatt hívtalak. Később újra próbálom. Vigyázz magadra!`,
    reminderDetailed: (name) =>
      `Szia ${name}, itt Ultaura. Egy emlékeztető miatt hívtalak, amit neked készítettem. Később újra próbálom. Vigyázz magadra!`,
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
  } else if (preferredLanguageIso) {
    const normalizedPreferred = normalizeLanguageCode(preferredLanguageIso);
    if (VOICEMAIL_TEMPLATES[normalizedPreferred]) {
      effectiveLanguage = normalizedPreferred;
    }
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

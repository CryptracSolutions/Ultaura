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
  nl: {
    retry_wait: 'Ik heb even een verbindingsprobleem. Blijf alstublieft heel even aan de lijn.',
    retry_failed: 'Het spijt me, maar ik heb technische problemen en moet het gesprek beëindigen. Ik bel je snel terug. Zorg goed voor jezelf!',
  },
  ru: {
    retry_wait: 'У меня небольшая проблема с подключением. Пожалуйста, подождите минутку.',
    retry_failed: 'Мне очень жаль, но у меня технические неполадки, и мне нужно завершить разговор. Я скоро перезвоню. Берегите себя!',
  },
  ar: {
    retry_wait: 'لدي مشكلة بسيطة في الاتصال. من فضلك انتظر لحظة.',
    retry_failed: 'أنا آسف جدًا، لكن لدي مشاكل تقنية وأحتاج إلى إنهاء المكالمة. سأتصل بك مرة أخرى قريبًا. اعتنِ بنفسك!',
  },
  hi: {
    retry_wait: 'मुझे कनेक्शन में थोड़ी समस्या हो रही है। कृपया एक क्षण प्रतीक्षा करें।',
    retry_failed: 'मुझे बहुत खेद है, लेकिन मुझे तकनीकी समस्या हो रही है और मुझे कॉल समाप्त करनी होगी। मैं जल्द ही आपको फिर से कॉल करूँगा। अपना ख्याल रखें!',
  },
  tr: {
    retry_wait: 'Kısa bir bağlantı sorunu yaşıyorum. Lütfen bir an bekleyin.',
    retry_failed: 'Çok üzgünüm, teknik bir sorun yaşıyorum ve aramayı sonlandırmam gerekiyor. Yakında tekrar arayacağım. Kendinize iyi bakın!',
  },
  pl: {
    retry_wait: 'Mam krótkie problemy z połączeniem. Proszę chwilę poczekać.',
    retry_failed: 'Bardzo mi przykro, ale mam problemy techniczne i muszę zakończyć rozmowę. Wkrótce zadzwonię ponownie. Proszę o siebie dbać!',
  },
  sv: {
    retry_wait: 'Jag har ett kort anslutningsproblem. Vänligen vänta en liten stund.',
    retry_failed: 'Jag är verkligen ledsen, men jag har tekniska problem och behöver avsluta samtalet. Jag ringer upp igen snart. Ta hand om dig!',
  },
  da: {
    retry_wait: 'Jeg har et kort forbindelsesproblem. Vent venligst et øjeblik.',
    retry_failed: 'Jeg er virkelig ked af det, men jeg har tekniske problemer og er nødt til at afslutte opkaldet. Jeg ringer tilbage snart. Pas godt på dig selv!',
  },
  no: {
    retry_wait: 'Jeg har et kort tilkoblingsproblem. Vennligst vent et lite øyeblikk.',
    retry_failed: 'Jeg er veldig lei meg, men jeg har tekniske problemer og må avslutte samtalen. Jeg ringer tilbake snart. Ta vare på deg selv!',
  },
  fi: {
    retry_wait: 'Minulla on pieni yhteysongelma. Odota hetki.',
    retry_failed: 'Olen pahoillani, mutta minulla on teknisiä ongelmia ja minun täytyy lopettaa puhelu. Soitan pian takaisin. Pidä huolta itsestäsi!',
  },
  cs: {
    retry_wait: 'Mám krátký problém s připojením. Prosím, chvíli vydržte.',
    retry_failed: 'Je mi to moc líto, ale mám technické potíže a musím hovor ukončit. Brzy vám znovu zavolám. Opatrujte se!',
  },
  th: {
    retry_wait: 'ฉันมีปัญหาการเชื่อมต่อเล็กน้อย โปรดรอสักครู่',
    retry_failed: 'ขอโทษจริงๆ แต่ฉันมีปัญหาทางเทคนิคและจำเป็นต้องจบการสนทนา ฉันจะโทรกลับหาคุณเร็วๆ นี้ ดูแลตัวเองด้วยนะ',
  },
  vi: {
    retry_wait: 'Tôi đang gặp một vấn đề kết nối nhỏ. Vui lòng đợi một lát.',
    retry_failed: 'Tôi rất xin lỗi, nhưng tôi đang gặp sự cố kỹ thuật và cần phải kết thúc cuộc gọi. Tôi sẽ gọi lại sớm. Bạn hãy giữ gìn sức khỏe nhé!',
  },
  id: {
    retry_wait: 'Saya sedang mengalami masalah koneksi sebentar. Mohon tunggu sejenak.',
    retry_failed: 'Maaf sekali, saya sedang mengalami kendala teknis dan harus mengakhiri panggilan ini. Saya akan menelepon kembali segera. Jaga diri baik-baik!',
  },
  ms: {
    retry_wait: 'Saya mengalami masalah sambungan seketika. Sila tunggu sebentar.',
    retry_failed: 'Maaf, saya mengalami masalah teknikal dan perlu menamatkan panggilan ini. Saya akan menelefon semula tidak lama lagi. Jaga diri baik-baik!',
  },
  tl: {
    retry_wait: 'May sandali akong problema sa koneksyon. Pakihintay muna.',
    retry_failed: 'Pasensya na, may teknikal na problema ako at kailangan kong tapusin ang tawag. Tatawag ulit ako sa lalong madaling panahon. Ingat ka!',
  },
  uk: {
    retry_wait: 'У мене коротка проблема зі з’єднанням. Будь ласка, зачекайте хвилинку.',
    retry_failed: 'Мені дуже шкода, але в мене технічні проблеми і я мушу завершити дзвінок. Я скоро передзвоню. Бережіть себе!',
  },
  el: {
    retry_wait: 'Έχω ένα μικρό πρόβλημα σύνδεσης. Παρακαλώ περιμένετε μια στιγμή.',
    retry_failed: 'Λυπάμαι πολύ, αλλά αντιμετωπίζω τεχνικές δυσκολίες και πρέπει να τερματίσω την κλήση. Θα σας καλέσω ξανά σύντομα. Να προσέχετε!',
  },
  he: {
    retry_wait: 'יש לי בעיית חיבור קצרה. אנא המתן רגע.',
    retry_failed: 'אני ממש מצטער/ת, אבל יש לי בעיות טכניות ואני צריך/ה לסיים את השיחה. אתקשר שוב בקרוב. שמור/י על עצמך!',
  },
  ro: {
    retry_wait: 'Am o mică problemă de conexiune. Te rog să aștepți un moment.',
    retry_failed: 'Îmi pare foarte rău, dar am dificultăți tehnice și trebuie să închei apelul. Te voi suna din nou curând. Ai grijă de tine!',
  },
  hu: {
    retry_wait: 'Rövid ideig kapcsolódási problémám van. Kérem, várjon egy pillanatot.',
    retry_failed: 'Nagyon sajnálom, de technikai nehézségeim vannak, és be kell fejeznem a hívást. Hamarosan újra felhívom. Vigyázzon magára!',
  },
};

export function getFallbackMessage(language: string, type: FallbackMessageType): string {
  const normalized = normalizeLanguageCode(language || 'en');
  const messages = FALLBACK_MESSAGES[normalized] ?? FALLBACK_MESSAGES.en;
  return messages[type];
}

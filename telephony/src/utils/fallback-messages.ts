import { normalizeLanguageCode } from '@ultaura/prompts';

type FallbackMessageType = 'retry_wait' | 'retry_failed' | 'handoff_bridge' | 'handoff_failed';

type FallbackMessageSet = Record<FallbackMessageType, string>;

const FALLBACK_MESSAGES: Record<string, FallbackMessageSet> = {
  en: {
    retry_wait: "I'm having a brief connection issue. Please hold on just a moment.",
    retry_failed: "I'm so sorry, but I'm experiencing technical difficulties and need to end our call. I'll try calling you back soon. Take care!",
    handoff_bridge: "Let me gather my thoughts for a moment...",
    handoff_failed: "I've really enjoyed our conversation today. Let's pick this up next time!",
  },
  es: {
    retry_wait: 'Estoy teniendo un peque\u00f1o problema de conexi\u00f3n. Por favor espere un momento.',
    retry_failed: 'Lo siento mucho, pero estoy experimentando dificultades t\u00e9cnicas y necesito terminar nuestra llamada. \u00a1Intentar\u00e9 llamarte pronto! \u00a1Cu\u00eddate!',
    handoff_bridge: "D\u00e9jame organizar mis ideas un momento...",
    handoff_failed: "He disfrutado mucho nuestra conversaci\u00f3n hoy. \u00a1Sigamos la pr\u00f3xima vez!",
  },
  fr: {
    retry_wait: 'Je rencontre un petit probl\u00e8me de connexion. Veuillez patienter un moment.',
    retry_failed: 'Je suis vraiment d\u00e9sol\u00e9, je rencontre des difficult\u00e9s techniques et je dois mettre fin \u00e0 notre appel. Je vous rappellerai bient\u00f4t. Prenez soin de vous !',
    handoff_bridge: "Laissez-moi rassembler mes pens\u00e9es un instant...",
    handoff_failed: "J'ai vraiment appr\u00e9ci\u00e9 notre conversation aujourd'hui. Reprenons la prochaine fois !",
  },
  de: {
    retry_wait: 'Ich habe kurz ein Verbindungsproblem. Bitte bleiben Sie einen Moment dran.',
    retry_failed: 'Es tut mir sehr leid, aber ich habe technische Schwierigkeiten und muss unser Gespr\u00e4ch beenden. Ich rufe Sie bald zur\u00fcck. Passen Sie gut auf sich auf!',
    handoff_bridge: "Lassen Sie mich kurz meine Gedanken sammeln...",
    handoff_failed: "Ich habe unser Gespr\u00e4ch heute wirklich genossen. Machen wir beim n\u00e4chsten Mal weiter!",
  },
  it: {
    retry_wait: 'Sto avendo un breve problema di connessione. Per favore attendi un momento.',
    retry_failed: 'Mi dispiace molto, ma sto riscontrando difficolt\u00e0 tecniche e devo terminare la nostra chiamata. Ti richiamer\u00f2 presto. Abbi cura di te!',
    handoff_bridge: "Lasciatemi raccogliere i pensieri un momento...",
    handoff_failed: "Mi \u00e8 piaciuta molto la nostra conversazione oggi. Continuiamo la prossima volta!",
  },
  pt: {
    retry_wait: 'Estou com um pequeno problema de conex\u00e3o. Por favor, aguarde um momento.',
    retry_failed: 'Sinto muito, mas estou com dificuldades t\u00e9cnicas e preciso encerrar nossa liga\u00e7\u00e3o. Vou te ligar de volta em breve. Cuide-se!',
    handoff_bridge: "Deixe-me organizar meus pensamentos por um momento...",
    handoff_failed: "Gostei muito da nossa conversa hoje. Vamos continuar na pr\u00f3xima vez!",
  },
  ja: {
    retry_wait: '\u63a5\u7d9a\u306b\u5c11\u3057\u554f\u984c\u304c\u3042\u308a\u307e\u3059\u3002\u5c11\u3005\u304a\u5f85\u3061\u304f\u3060\u3055\u3044\u3002',
    retry_failed: '\u7533\u3057\u8a33\u3042\u308a\u307e\u305b\u3093\u304c\u3001\u6280\u8853\u7684\u306a\u554f\u984c\u306e\u305f\u3081\u901a\u8a71\u3092\u7d42\u4e86\u3059\u308b\u5fc5\u8981\u304c\u3042\u308a\u307e\u3059\u3002\u3059\u3050\u306b\u304a\u304b\u3051\u76f4\u3057\u3057\u307e\u3059\u3002\u304a\u4f53\u306b\u6c17\u3092\u3064\u3051\u3066\u304f\u3060\u3055\u3044\uff01',
    handoff_bridge: "\u5c11\u3057\u8003\u3048\u3092\u307e\u3068\u3081\u3055\u305b\u3066\u304f\u3060\u3055\u3044...",
    handoff_failed: "\u4eca\u65e5\u306e\u304a\u8a71\u3001\u3068\u3066\u3082\u697d\u3057\u304b\u3063\u305f\u3067\u3059\u3002\u6b21\u56de\u307e\u305f\u7d9a\u3051\u307e\u3057\u3087\u3046\uff01",
  },
  ko: {
    retry_wait: '\uc5f0\uacb0\uc5d0 \uc7a0\uc2dc \ubb38\uc81c\uac00 \uc788\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc\ub9cc \uae30\ub2e4\ub824 \uc8fc\uc138\uc694.',
    retry_failed: '\uc815\ub9d0 \uc8c4\uc1a1\ud558\uc9c0\ub9cc \uae30\uc220\uc801\uc778 \ubb38\uc81c\ub85c \ud1b5\ud654\ub97c \uc885\ub8cc\ud574\uc57c \ud569\ub2c8\ub2e4. \uace7 \ub2e4\uc2dc \uc804\ud654\ub4dc\ub9b4\uac8c\uc694. \uac74\uac15\ud558\uc138\uc694!',
    handoff_bridge: "\uc7a0\uc2dc \uc0dd\uac01\uc744 \uc815\ub9ac\ud560\uac8c\uc694...",
    handoff_failed: "\uc624\ub298 \ub300\ud654 \uc815\ub9d0 \uc990\uac70\uc6e0\uc5b4\uc694. \ub2e4\uc74c\uc5d0 \uc774\uc5b4\uc11c \ud574\uc694!",
  },
  zh: {
    retry_wait: '\u6211\u8fd9\u8fb9\u9047\u5230\u4e86\u4e00\u70b9\u8fde\u63a5\u95ee\u9898\uff0c\u8bf7\u7a0d\u7b49\u4e00\u4e0b\u3002',
    retry_failed: '\u975e\u5e38\u62b1\u6b49\uff0c\u6211\u9047\u5230\u4e86\u6280\u672f\u95ee\u9898\uff0c\u9700\u8981\u7ed3\u675f\u6211\u4eec\u7684\u901a\u8bdd\u3002\u6211\u4f1a\u5c3d\u5feb\u518d\u7ed9\u60a8\u6253\u7535\u8bdd\u3002\u8bf7\u4fdd\u91cd\uff01',
    handoff_bridge: "\u8ba9\u6211\u6574\u7406\u4e00\u4e0b\u601d\u7eea...",
    handoff_failed: "\u4eca\u5929\u7684\u804a\u5929\u771f\u6109\u5feb\u3002\u4e0b\u6b21\u6211\u4eec\u7ee7\u7eed\u5427\uff01",
  },
  nl: {
    retry_wait: 'Ik heb even een verbindingsprobleem. Blijf alstublieft heel even aan de lijn.',
    retry_failed: 'Het spijt me, maar ik heb technische problemen en moet het gesprek be\u00ebindigen. Ik bel je snel terug. Zorg goed voor jezelf!',
    handoff_bridge: "Laat me even mijn gedachten verzamelen...",
    handoff_failed: "Ik heb echt genoten van ons gesprek vandaag. Laten we de volgende keer verder praten!",
  },
  ru: {
    retry_wait: '\u0423 \u043c\u0435\u043d\u044f \u043d\u0435\u0431\u043e\u043b\u044c\u0448\u0430\u044f \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0430 \u0441 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435\u043c. \u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435 \u043c\u0438\u043d\u0443\u0442\u043a\u0443.',
    retry_failed: '\u041c\u043d\u0435 \u043e\u0447\u0435\u043d\u044c \u0436\u0430\u043b\u044c, \u043d\u043e \u0443 \u043c\u0435\u043d\u044f \u0442\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u043d\u0435\u043f\u043e\u043b\u0430\u0434\u043a\u0438, \u0438 \u043c\u043d\u0435 \u043d\u0443\u0436\u043d\u043e \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440. \u042f \u0441\u043a\u043e\u0440\u043e \u043f\u0435\u0440\u0435\u0437\u0432\u043e\u043d\u044e. \u0411\u0435\u0440\u0435\u0433\u0438\u0442\u0435 \u0441\u0435\u0431\u044f!',
    handoff_bridge: "\u0414\u0430\u0439\u0442\u0435 \u043c\u043d\u0435 \u0441\u043e\u0431\u0440\u0430\u0442\u044c\u0441\u044f \u0441 \u043c\u044b\u0441\u043b\u044f\u043c\u0438...",
    handoff_failed: "\u041c\u043d\u0435 \u043e\u0447\u0435\u043d\u044c \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u0441\u044f \u043d\u0430\u0448 \u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440 \u0441\u0435\u0433\u043e\u0434\u043d\u044f. \u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u043c \u0432 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0440\u0430\u0437!",
  },
  ar: {
    retry_wait: '\u0644\u062f\u064a \u0645\u0634\u0643\u0644\u0629 \u0628\u0633\u064a\u0637\u0629 \u0641\u064a \u0627\u0644\u0627\u062a\u0635\u0627\u0644. \u0645\u0646 \u0641\u0636\u0644\u0643 \u0627\u0646\u062a\u0638\u0631 \u0644\u062d\u0638\u0629.',
    retry_failed: '\u0623\u0646\u0627 \u0622\u0633\u0641 \u062c\u062f\u064b\u0627\u060c \u0644\u0643\u0646 \u0644\u062f\u064a \u0645\u0634\u0627\u0643\u0644 \u062a\u0642\u0646\u064a\u0629 \u0648\u0623\u062d\u062a\u0627\u062c \u0625\u0644\u0649 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0629. \u0633\u0623\u062a\u0635\u0644 \u0628\u0643 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u0642\u0631\u064a\u0628\u064b\u0627. \u0627\u0639\u062a\u0646\u0650 \u0628\u0646\u0641\u0633\u0643!',
    handoff_bridge: "\u062f\u0639\u0646\u064a \u0623\u062c\u0645\u0639 \u0623\u0641\u0643\u0627\u0631\u064a \u0644\u0644\u062d\u0638\u0629...",
    handoff_failed: "\u0644\u0642\u062f \u0627\u0633\u062a\u0645\u062a\u0639\u062a \u0643\u062b\u064a\u0631\u0627\u064b \u0628\u0645\u062d\u0627\u062f\u062b\u062a\u0646\u0627 \u0627\u0644\u064a\u0648\u0645. \u0644\u0646\u0643\u0645\u0644 \u0641\u064a \u0627\u0644\u0645\u0631\u0629 \u0627\u0644\u0642\u0627\u062f\u0645\u0629!",
  },
  hi: {
    retry_wait: '\u092e\u0941\u091d\u0947 \u0915\u0928\u0947\u0915\u094d\u0936\u0928 \u092e\u0947\u0902 \u0925\u094b\u0921\u093c\u0940 \u0938\u092e\u0938\u094d\u092f\u093e \u0939\u094b \u0930\u0939\u0940 \u0939\u0948\u0964 \u0915\u0943\u092a\u092f\u093e \u090f\u0915 \u0915\u094d\u0937\u0923 \u092a\u094d\u0930\u0924\u0940\u0915\u094d\u0937\u093e \u0915\u0930\u0947\u0902\u0964',
    retry_failed: '\u092e\u0941\u091d\u0947 \u092c\u0939\u0941\u0924 \u0916\u0947\u0926 \u0939\u0948, \u0932\u0947\u0915\u0928 \u092e\u0941\u091d\u0947 \u0924\u0915\u0928\u0940\u0915\u0940 \u0938\u092e\u0938\u094d\u092f\u093e \u0939\u094b \u0930\u0939\u0940 \u0939\u0948 \u0914\u0930 \u092e\u0941\u091d\u0947 \u0915\u0949\u0932 \u0938\u092e\u093e\u092a\u094d\u0924 \u0915\u0930\u0928\u0940 \u0939\u094b\u0917\u0940\u0964 \u092e\u0948\u0902 \u091c\u0932\u094d\u0926 \u0939\u0940 \u0906\u092a\u0915\u094b \u092b\u093f\u0930 \u0938\u0947 \u0915\u0949\u0932 \u0915\u0930\u0942\u0901\u0917\u093e\u0964 \u0905\u092a\u0928\u093e \u0916\u094d\u092f\u093e\u0932 \u0930\u0916\u0947\u0902!',
    handoff_bridge: "\u092e\u0941\u091d\u0947 \u090f\u0915 \u092a\u0932 \u0905\u092a\u0928\u0947 \u0935\u093f\u091a\u093e\u0930 \u0907\u0915\u0920\u094d\u0920\u093e \u0915\u0930\u0928\u0947 \u0926\u0940\u091c\u093f\u090f...",
    handoff_failed: "\u0906\u091c \u0915\u0940 \u092c\u093e\u0924\u091a\u0940\u0924 \u092c\u0939\u0941\u0924 \u0905\u091a\u094d\u091b\u0940 \u0930\u0939\u0940\u0964 \u0905\u0917\u0932\u0940 \u092c\u093e\u0930 \u092b\u093f\u0930 \u092c\u093e\u0924 \u0915\u0930\u0947\u0902\u0917\u0947!",
  },
  tr: {
    retry_wait: 'K\u0131sa bir ba\u011flant\u0131 sorunu ya\u015f\u0131yorum. L\u00fctfen bir an bekleyin.',
    retry_failed: '\u00c7ok \u00fcz\u00fcn\u00fcm, teknik bir sorun ya\u015f\u0131yorum ve aramay\u0131 sonland\u0131rmam gerekiyor. Yak\u0131nda tekrar arayaca\u011f\u0131m. Kendinize iyi bak\u0131n!',
    handoff_bridge: "Bir an d\u00fc\u015f\u00fcncelerimi toparlamama izin verin...",
    handoff_failed: "Bug\u00fcnk\u00fc sohbetimizden \u00e7ok keyif ald\u0131m. Bir dahaki sefere devam edelim!",
  },
  pl: {
    retry_wait: 'Mam kr\u00f3tkie problemy z po\u0142\u0105czeniem. Prosz\u0119 chwil\u0119 poczeka\u0107.',
    retry_failed: 'Bardzo mi przykro, ale mam problemy techniczne i musz\u0119 zako\u0144czy\u0107 rozmow\u0119. Wkr\u00f3tce zadzwoni\u0119 ponownie. Prosz\u0119 o siebie dba\u0107!',
    handoff_bridge: "Pozw\u00f3lcie, \u017ce zbior\u0119 my\u015bli na chwil\u0119...",
    handoff_failed: "Naprawd\u0119 podoba\u0142a mi si\u0119 nasza dzisiejsza rozmowa. Kontynuujmy nast\u0119pnym razem!",
  },
  sv: {
    retry_wait: 'Jag har ett kort anslutningsproblem. V\u00e4nligen v\u00e4nta en liten stund.',
    retry_failed: 'Jag \u00e4r verkligen ledsen, men jag har tekniska problem och beh\u00f6ver avsluta samtalet. Jag ringer upp igen snart. Ta hand om dig!',
    handoff_bridge: "L\u00e5t mig samla mina tankar en stund...",
    handoff_failed: "Jag har verkligen njutit av v\u00e5rt samtal idag. Vi forts\u00e4tter n\u00e4sta g\u00e5ng!",
  },
  da: {
    retry_wait: 'Jeg har et kort forbindelsesproblem. Vent venligst et \u00f8jeblik.',
    retry_failed: 'Jeg er virkelig ked af det, men jeg har tekniske problemer og er n\u00f8dt til at afslutte opkaldet. Jeg ringer tilbage snart. Pas godt p\u00e5 dig selv!',
    handoff_bridge: "Lad mig samle mine tanker et \u00f8jeblik...",
    handoff_failed: "Jeg har virkelig nydt vores samtale i dag. Lad os forts\u00e6tte n\u00e6ste gang!",
  },
  no: {
    retry_wait: 'Jeg har et kort tilkoblingsproblem. Vennligst vent et lite \u00f8yeblikk.',
    retry_failed: 'Jeg er veldig lei meg, men jeg har tekniske problemer og m\u00e5 avslutte samtalen. Jeg ringer tilbake snart. Ta vare p\u00e5 deg selv!',
    handoff_bridge: "La meg samle tankene mine et \u00f8yeblikk...",
    handoff_failed: "Jeg har virkelig likt samtalen v\u00e5r i dag. La oss fortsette neste gang!",
  },
  fi: {
    retry_wait: 'Minulla on pieni yhteysongelma. Odota hetki.',
    retry_failed: 'Olen pahoillani, mutta minulla on teknisi\u00e4 ongelmia ja minun t\u00e4ytyy lopettaa puhelu. Soitan pian takaisin. Pid\u00e4 huolta itsest\u00e4si!',
    handoff_bridge: "Anna minun ker\u00e4t\u00e4 ajatukseni hetkeksi...",
    handoff_failed: "Nautin todella t\u00e4m\u00e4np\u00e4iv\u00e4isest\u00e4 keskustelustamme. Jatketaan ensi kerralla!",
  },
  cs: {
    retry_wait: 'M\u00e1m kr\u00e1tk\u00fd probl\u00e9m s p\u0159ipojen\u00edm. Pros\u00edm, chv\u00edli vydr\u017ete.',
    retry_failed: 'Je mi to moc l\u00edto, ale m\u00e1m technick\u00e9 pot\u00ed\u017ee a mus\u00edm hovor ukon\u010dit. Brzy v\u00e1m znovu zavolám. Opatrujte se!',
    handoff_bridge: "Nechte m\u011b chv\u00edli sebrat my\u0161lenky...",
    handoff_failed: "Dne\u0161n\u00ed rozhovor m\u011b opravdu bavil. Pokra\u010dujme p\u0159\u00ed\u0161t\u011b!",
  },
  th: {
    retry_wait: '\u0e09\u0e31\u0e19\u0e21\u0e35\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e01\u0e32\u0e23\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d\u0e40\u0e25\u0e47\u0e01\u0e19\u0e49\u0e2d\u0e22 \u0e42\u0e1b\u0e23\u0e14\u0e23\u0e2d\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48',
    retry_failed: '\u0e02\u0e2d\u0e42\u0e17\u0e29\u0e08\u0e23\u0e34\u0e07\u0e46 \u0e41\u0e15\u0e48\u0e09\u0e31\u0e19\u0e21\u0e35\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e17\u0e32\u0e07\u0e40\u0e17\u0e04\u0e19\u0e34\u0e04\u0e41\u0e25\u0e30\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19\u0e15\u0e49\u0e2d\u0e07\u0e08\u0e1a\u0e01\u0e32\u0e23\u0e2a\u0e19\u0e17\u0e19\u0e32 \u0e09\u0e31\u0e19\u0e08\u0e30\u0e42\u0e17\u0e23\u0e01\u0e25\u0e31\u0e1a\u0e2b\u0e32\u0e04\u0e38\u0e13\u0e40\u0e23\u0e47\u0e27\u0e46 \u0e19\u0e35\u0e49 \u0e14\u0e39\u0e41\u0e25\u0e15\u0e31\u0e27\u0e40\u0e2d\u0e07\u0e14\u0e49\u0e27\u0e22\u0e19\u0e30',
    handoff_bridge: "\u0e02\u0e2d\u0e23\u0e27\u0e1a\u0e23\u0e27\u0e21\u0e04\u0e27\u0e32\u0e21\u0e04\u0e34\u0e14\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48\u0e19\u0e30\u0e04\u0e30...",
    handoff_failed: "\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49\u0e04\u0e38\u0e22\u0e01\u0e31\u0e19\u0e2a\u0e19\u0e38\u0e01\u0e21\u0e32\u0e01\u0e04\u0e48\u0e30 \u0e44\u0e27\u0e49\u0e04\u0e38\u0e22\u0e01\u0e31\u0e19\u0e43\u0e2b\u0e21\u0e48\u0e04\u0e23\u0e31\u0e49\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e30\u0e04\u0e30!",
  },
  vi: {
    retry_wait: 'T\u00f4i \u0111ang g\u1eb7p m\u1ed9t v\u1ea5n \u0111\u1ec1 k\u1ebft n\u1ed1i nh\u1ecf. Vui l\u00f2ng \u0111\u1ee3i m\u1ed9t l\u00e1t.',
    retry_failed: 'T\u00f4i r\u1ea5t xin l\u1ed7i, nh\u01b0ng t\u00f4i \u0111ang g\u1eb7p s\u1ef1 c\u1ed1 k\u1ef9 thu\u1eadt v\u00e0 c\u1ea7n ph\u1ea3i k\u1ebft th\u00fac cu\u1ed9c g\u1ecdi. T\u00f4i s\u1ebd g\u1ecdi l\u1ea1i s\u1edbm. B\u1ea1n h\u00e3y gi\u1eef g\u00ecn s\u1ee9c kh\u1ecfe nh\u00e9!',
    handoff_bridge: "\u0110\u1ec3 t\u00f4i s\u1eafp x\u1ebfp suy ngh\u0129 m\u1ed9t ch\u00fat...",
    handoff_failed: "T\u00f4i r\u1ea5t th\u00edch cu\u1ed9c tr\u00f2 chuy\u1ec7n h\u00f4m nay. L\u1ea7n sau ch\u00fang ta n\u00f3i ti\u1ebfp nh\u00e9!",
  },
  id: {
    retry_wait: 'Saya sedang mengalami masalah koneksi sebentar. Mohon tunggu sejenak.',
    retry_failed: 'Maaf sekali, saya sedang mengalami kendala teknis dan harus mengakhiri panggilan ini. Saya akan menelepon kembali segera. Jaga diri baik-baik!',
    handoff_bridge: "Biarkan saya mengumpulkan pikiran sejenak...",
    handoff_failed: "Saya sangat menikmati percakapan kita hari ini. Mari kita lanjutkan lain kali!",
  },
  ms: {
    retry_wait: 'Saya mengalami masalah sambungan seketika. Sila tunggu sebentar.',
    retry_failed: 'Maaf, saya mengalami masalah teknikal dan perlu menamatkan panggilan ini. Saya akan menelefon semula tidak lama lagi. Jaga diri baik-baik!',
    handoff_bridge: "Biar saya kumpulkan fikiran seketika...",
    handoff_failed: "Saya sangat menikmati perbualan kita hari ini. Mari kita sambung lain kali!",
  },
  tl: {
    retry_wait: 'May sandali akong problema sa koneksyon. Pakihintay muna.',
    retry_failed: 'Pasensya na, may teknikal na problema ako at kailangan kong tapusin ang tawag. Tatawag ulit ako sa lalong madaling panahon. Ingat ka!',
    handoff_bridge: "Sandali lang, isipin ko muna...",
    handoff_failed: "Nag-enjoy talaga ako sa usapan natin ngayon. Ituloy natin sa susunod!",
  },
  uk: {
    retry_wait: '\u0423 \u043c\u0435\u043d\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u0430 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0430 \u0437\u0456 \u0437\u2019\u0454\u0434\u043d\u0430\u043d\u043d\u044f\u043c. \u0411\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u0437\u0430\u0447\u0435\u043a\u0430\u0439\u0442\u0435 \u0445\u0432\u0438\u043b\u0438\u043d\u043a\u0443.',
    retry_failed: '\u041c\u0435\u043d\u0456 \u0434\u0443\u0436\u0435 \u0448\u043a\u043e\u0434\u0430, \u0430\u043b\u0435 \u0432 \u043c\u0435\u043d\u0435 \u0442\u0435\u0445\u043d\u0456\u0447\u043d\u0456 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0438 \u0456 \u044f \u043c\u0443\u0448\u0443 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0438 \u0434\u0437\u0432\u0456\u043d\u043e\u043a. \u042f \u0441\u043a\u043e\u0440\u043e \u043f\u0435\u0440\u0435\u0434\u0437\u0432\u043e\u043d\u044e. \u0411\u0435\u0440\u0435\u0436\u0456\u0442\u044c \u0441\u0435\u0431\u0435!',
    handoff_bridge: "\u0414\u043e\u0437\u0432\u043e\u043b\u044c\u0442\u0435 \u043c\u0435\u043d\u0456 \u0437\u0456\u0431\u0440\u0430\u0442\u0438\u0441\u044f \u0437 \u0434\u0443\u043c\u043a\u0430\u043c\u0438...",
    handoff_failed: "\u041c\u0435\u043d\u0456 \u0434\u0443\u0436\u0435 \u0441\u043f\u043e\u0434\u043e\u0431\u0430\u043b\u0430\u0441\u044c \u043d\u0430\u0448\u0430 \u0440\u043e\u0437\u043c\u043e\u0432\u0430 \u0441\u044c\u043e\u0433\u043e\u0434\u043d\u0456. \u041f\u0440\u043e\u0434\u043e\u0432\u0436\u0438\u043c\u043e \u043d\u0430\u0441\u0442\u0443\u043f\u043d\u043e\u0433\u043e \u0440\u0430\u0437\u0443!",
  },
  el: {
    retry_wait: '\u0388\u03c7\u03c9 \u03ad\u03bd\u03b1 \u03bc\u03b9\u03ba\u03c1\u03cc \u03c0\u03c1\u03cc\u03b2\u03bb\u03b7\u03bc\u03b1 \u03c3\u03cd\u03bd\u03b4\u03b5\u03c3\u03b7\u03c2. \u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03ce \u03c0\u03b5\u03c1\u03b9\u03bc\u03ad\u03bd\u03b5\u03c4\u03b5 \u03bc\u03b9\u03b1 \u03c3\u03c4\u03b9\u03b3\u03bc\u03ae.',
    retry_failed: '\u039b\u03c5\u03c0\u03ac\u03bc\u03b1\u03b9 \u03c0\u03bf\u03bb\u03cd, \u03b1\u03bb\u03bb\u03ac \u03b1\u03bd\u03c4\u03b9\u03bc\u03b5\u03c4\u03c9\u03c0\u03af\u03b6\u03c9 \u03c4\u03b5\u03c7\u03bd\u03b9\u03ba\u03ad\u03c2 \u03b4\u03c5\u03c3\u03ba\u03bf\u03bb\u03af\u03b5\u03c2 \u03ba\u03b1\u03b9 \u03c0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03bd\u03b1 \u03c4\u03b5\u03c1\u03bc\u03b1\u03c4\u03af\u03c3\u03c9 \u03c4\u03b7\u03bd \u03ba\u03bb\u03ae\u03c3\u03b7. \u0398\u03b1 \u03c3\u03b1\u03c2 \u03ba\u03b1\u03bb\u03ad\u03c3\u03c9 \u03be\u03b1\u03bd\u03ac \u03c3\u03cd\u03bd\u03c4\u03bf\u03bc\u03b1. \u039d\u03b1 \u03c0\u03c1\u03bf\u03c3\u03ad\u03c7\u03b5\u03c4\u03b5!',
    handoff_bridge: "\u0391\u03c6\u03ae\u03c3\u03c4\u03b5 \u03bc\u03b5 \u03bd\u03b1 \u03bc\u03b1\u03b6\u03ad\u03c8\u03c9 \u03c4\u03b9\u03c2 \u03c3\u03ba\u03ad\u03c8\u03b5\u03b9\u03c2 \u03bc\u03bf\u03c5...",
    handoff_failed: "\u0391\u03c0\u03cc\u03bb\u03b1\u03c5\u03c3\u03b1 \u03c0\u03bf\u03bb\u03cd \u03c4\u03b7 \u03c3\u03c5\u03b6\u03ae\u03c4\u03b7\u03c3\u03ae \u03bc\u03b1\u03c2 \u03c3\u03ae\u03bc\u03b5\u03c1\u03b1. \u0391\u03c2 \u03c3\u03c5\u03bd\u03b5\u03c7\u03af\u03c3\u03bf\u03c5\u03bc\u03b5 \u03c4\u03b7\u03bd \u03b5\u03c0\u03cc\u03bc\u03b5\u03bd\u03b7 \u03c6\u03bf\u03c1\u03ac!",
  },
  he: {
    retry_wait: '\u05d9\u05e9 \u05dc\u05d9 \u05d1\u05e2\u05d9\u05d9\u05ea \u05d7\u05d9\u05d1\u05d5\u05e8 \u05e7\u05e6\u05e8\u05d4. \u05d0\u05e0\u05d0 \u05d4\u05de\u05ea\u05df \u05e8\u05d2\u05e2.',
    retry_failed: '\u05d0\u05e0\u05d9 \u05de\u05de\u05e9 \u05de\u05e6\u05d8\u05e2\u05e8/\u05ea, \u05d0\u05d1\u05dc \u05d9\u05e9 \u05dc\u05d9 \u05d1\u05e2\u05d9\u05d5\u05ea \u05d8\u05db\u05e0\u05d9\u05d5\u05ea \u05d5\u05d0\u05e0\u05d9 \u05e6\u05e8\u05d9\u05da/\u05d4 \u05dc\u05e1\u05d9\u05d9\u05dd \u05d0\u05ea \u05d4\u05e9\u05d9\u05d7\u05d4. \u05d0\u05ea\u05e7\u05e9\u05e8 \u05e9\u05d5\u05d1 \u05d1\u05e7\u05e8\u05d5\u05d1. \u05e9\u05de\u05d5\u05e8/\u05d9 \u05e2\u05dc \u05e2\u05e6\u05de\u05da!',
    handoff_bridge: "\u05ea\u05e0\u05d5 \u05dc\u05d9 \u05dc\u05d0\u05e1\u05d5\u05e3 \u05d0\u05ea \u05d4\u05de\u05d7\u05e9\u05d1\u05d5\u05ea \u05e9\u05dc\u05d9 \u05dc\u05e8\u05d2\u05e2...",
    handoff_failed: "\u05de\u05de\u05e9 \u05e0\u05d4\u05e0\u05d9\u05ea\u05d9 \u05de\u05d4\u05e9\u05d9\u05d7\u05d4 \u05e9\u05dc\u05e0\u05d5 \u05d4\u05d9\u05d5\u05dd. \u05e0\u05de\u05e9\u05d9\u05da \u05d1\u05e4\u05e2\u05dd \u05d4\u05d1\u05d0\u05d4!",
  },
  ro: {
    retry_wait: 'Am o mic\u0103 problem\u0103 de conexiune. Te rog s\u0103 a\u0219tep\u021bi un moment.',
    retry_failed: '\u00cemi pare foarte r\u0103u, dar am dificult\u0103\u021bi tehnice \u0219i trebuie s\u0103 \u00eenchei apelul. Te voi suna din nou cur\u00e2nd. Ai grij\u0103 de tine!',
    handoff_bridge: "L\u0103sa\u021bi-m\u0103 s\u0103-mi adun g\u00e2ndurile o clip\u0103...",
    handoff_failed: "Mi-a pl\u0103cut foarte mult conversa\u021bia noastr\u0103 de azi. S\u0103 continu\u0103m data viitoare!",
  },
  hu: {
    retry_wait: 'R\u00f6vid ideig kapcsol\u00f3d\u00e1si probl\u00e9m\u00e1m van. K\u00e9rem, v\u00e1rjon egy pillanatot.',
    retry_failed: 'Nagyon sajn\u00e1lom, de technikai neh\u00e9zs\u00e9geim vannak, \u00e9s be kell fejeznem a h\u00edv\u00e1st. Hamarosan \u00fajra felh\u00edvom. Vigy\u00e1zzon mag\u00e1ra!',
    handoff_bridge: "Hadd gy\u0171jtsem \u00f6ssze a gondolataimat egy pillanatra...",
    handoff_failed: "Nagyon \u00e9lveztem a mai besz\u00e9lget\u00e9s\u00fcnket. Folytassuk legk\u00f6zelebb!",
  },
};

export function getFallbackMessage(language: string, type: FallbackMessageType): string {
  const normalized = normalizeLanguageCode(language || 'en');
  const messages = FALLBACK_MESSAGES[normalized] ?? FALLBACK_MESSAGES.en;
  return messages[type];
}

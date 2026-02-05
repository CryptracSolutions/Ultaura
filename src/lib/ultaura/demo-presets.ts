export const DEMO_PRESET_IDS = [
  'morning-check-in',
  'medication-reminder',
  'gentle-activity',
  'family-touchpoint',
] as const;

export type DemoPresetId = (typeof DEMO_PRESET_IDS)[number];

export type DemoPreset = {
  id: DemoPresetId;
  label: string;
  text: string;
};

type SupportedDemoLanguage =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'ja'
  | 'ko'
  | 'zh';

const SUPPORTED_DEMO_LANGUAGES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ja',
  'ko',
  'zh',
] as const satisfies readonly SupportedDemoLanguage[];

type DemoPresetCopy = {
  label: string;
  text: string;
};

const PRESET_COPY: Record<
  SupportedDemoLanguage,
  Record<DemoPresetId, DemoPresetCopy>
> = {
  en: {
    'morning-check-in': {
      label: 'Morning Check-In',
      text: 'Good morning! How did you sleep, and what sounds nice for today?',
    },
    'medication-reminder': {
      label: 'Medication Reminder',
      text: 'Friendly reminder: it is time for your medication. Would you like me to wait while you take it?',
    },
    'gentle-activity': {
      label: 'Gentle Activity',
      text: 'Want a gentle activity idea? We can try light stretching or a short walk.',
    },
    'family-touchpoint': {
      label: 'Family Touchpoint',
      text: 'Would you like help sharing a quick update with your family today?',
    },
  },
  es: {
    'morning-check-in': {
      label: 'Chequeo Matutino',
      text: 'Buenos días. ¿Cómo dormiste y qué te gustaría hacer hoy?',
    },
    'medication-reminder': {
      label: 'Recordatorio de Medicación',
      text: 'Recordatorio amable: es hora de tu medicación. ¿Quieres que espere mientras la tomas?',
    },
    'gentle-activity': {
      label: 'Actividad Suave',
      text: '¿Te gustaría una actividad suave? Podemos hacer estiramientos ligeros o una caminata corta.',
    },
    'family-touchpoint': {
      label: 'Contacto con la Familia',
      text: '¿Quieres ayuda para compartir una actualización breve con tu familia hoy?',
    },
  },
  fr: {
    'morning-check-in': {
      label: 'Bilan du Matin',
      text: 'Bonjour. Comment avez-vous dormi et qu’aimeriez-vous faire aujourd’hui ?',
    },
    'medication-reminder': {
      label: 'Rappel de Médicaments',
      text: 'Petit rappel : c’est l’heure de vos médicaments. Voulez-vous que j’attende pendant la prise ?',
    },
    'gentle-activity': {
      label: 'Activité Douce',
      text: 'Envie d’une activité douce ? On peut faire des étirements légers ou une courte marche.',
    },
    'family-touchpoint': {
      label: 'Lien Familial',
      text: 'Souhaitez-vous de l’aide pour envoyer une courte nouvelle à votre famille aujourd’hui ?',
    },
  },
  de: {
    'morning-check-in': {
      label: 'Morgendlicher Check-in',
      text: 'Guten Morgen. Wie haben Sie geschlafen und was wäre heute schön für Sie?',
    },
    'medication-reminder': {
      label: 'Medikamenten-Erinnerung',
      text: 'Freundliche Erinnerung: Es ist Zeit für Ihre Medikamente. Soll ich warten, während Sie sie nehmen?',
    },
    'gentle-activity': {
      label: 'Sanfte Aktivität',
      text: 'Lust auf eine sanfte Aktivität? Wir können leichte Dehnübungen oder einen kurzen Spaziergang machen.',
    },
    'family-touchpoint': {
      label: 'Familienkontakt',
      text: 'Möchten Sie heute eine kurze Nachricht an Ihre Familie senden?',
    },
  },
  it: {
    'morning-check-in': {
      label: 'Controllo Mattutino',
      text: 'Buongiorno. Come hai dormito e cosa ti andrebbe di fare oggi?',
    },
    'medication-reminder': {
      label: 'Promemoria Farmaci',
      text: 'Promemoria gentile: è il momento dei farmaci. Vuoi che aspetti mentre li prendi?',
    },
    'gentle-activity': {
      label: 'Attività Leggera',
      text: 'Ti va un’attività leggera? Possiamo fare stretching dolce o una breve passeggiata.',
    },
    'family-touchpoint': {
      label: 'Contatto Famiglia',
      text: 'Vuoi aiuto per condividere oggi un breve aggiornamento con la tua famiglia?',
    },
  },
  pt: {
    'morning-check-in': {
      label: 'Check-in da Manhã',
      text: 'Bom dia. Como você dormiu e o que seria bom fazer hoje?',
    },
    'medication-reminder': {
      label: 'Lembrete de Medicação',
      text: 'Lembrete amigável: está na hora da sua medicação. Quer que eu espere enquanto você toma?',
    },
    'gentle-activity': {
      label: 'Atividade Leve',
      text: 'Quer uma atividade leve? Podemos fazer alongamentos suaves ou uma caminhada curta.',
    },
    'family-touchpoint': {
      label: 'Contato com a Família',
      text: 'Quer ajuda para enviar uma atualização rápida para sua família hoje?',
    },
  },
  ja: {
    'morning-check-in': {
      label: '朝のチェックイン',
      text: 'おはようございます。昨夜はよく眠れましたか？今日はどんな一日にしたいですか？',
    },
    'medication-reminder': {
      label: 'お薬リマインダー',
      text: 'やさしいお知らせです。お薬の時間です。飲み終わるまでお待ちしましょうか？',
    },
    'gentle-activity': {
      label: 'やさしい活動',
      text: '軽い活動をしてみますか？やさしいストレッチや短い散歩がおすすめです。',
    },
    'family-touchpoint': {
      label: '家族への近況',
      text: '今日、ご家族に短い近況を伝えるお手伝いをしましょうか？',
    },
  },
  ko: {
    'morning-check-in': {
      label: '아침 안부 확인',
      text: '좋은 아침이에요. 밤에 잘 주무셨나요? 오늘은 무엇을 하고 싶으세요?',
    },
    'medication-reminder': {
      label: '복약 알림',
      text: '따뜻한 안내예요. 약 드실 시간입니다. 드실 때까지 기다려 드릴까요?',
    },
    'gentle-activity': {
      label: '가벼운 활동',
      text: '가벼운 활동을 해볼까요? 부드러운 스트레칭이나 짧은 산책이 좋아요.',
    },
    'family-touchpoint': {
      label: '가족 소통',
      text: '오늘 가족에게 짧은 근황을 전할 수 있게 도와드릴까요?',
    },
  },
  zh: {
    'morning-check-in': {
      label: '晨间问候',
      text: '早上好。昨晚睡得怎么样？今天想做点什么？',
    },
    'medication-reminder': {
      label: '用药提醒',
      text: '温馨提醒：现在是用药时间。需要我陪您等到服药完成吗？',
    },
    'gentle-activity': {
      label: '轻松活动',
      text: '想来点轻松活动吗？可以做些舒缓拉伸或短时间散步。',
    },
    'family-touchpoint': {
      label: '家人联系',
      text: '今天需要我帮您向家人发送一条简短近况吗？',
    },
  },
};

function resolveDemoLanguage(locale: string): SupportedDemoLanguage {
  const normalized = locale.trim().toLowerCase();
  if (!normalized) {
    return 'en';
  }

  if (SUPPORTED_DEMO_LANGUAGES.includes(normalized as SupportedDemoLanguage)) {
    return normalized as SupportedDemoLanguage;
  }

  const [base] = normalized.split(/[-_]/);
  if (SUPPORTED_DEMO_LANGUAGES.includes(base as SupportedDemoLanguage)) {
    return base as SupportedDemoLanguage;
  }

  return 'en';
}

export function getDemoPresetsForLocale(locale: string): DemoPreset[] {
  const language = resolveDemoLanguage(locale);
  const languageCopy = PRESET_COPY[language];

  return DEMO_PRESET_IDS.map((id) => ({
    id,
    label: languageCopy[id].label,
    text: languageCopy[id].text,
  }));
}

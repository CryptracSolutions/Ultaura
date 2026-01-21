import { francAll } from 'franc-min';
import { LANGUAGE_NAMES } from '@ultaura/prompts';

const SUPPORTED_ISO_639_1 = new Set(Object.keys(LANGUAGE_NAMES));

const ISO_639_3_TO_1: Record<string, string> = {
  // Latin script
  eng: 'en',
  spa: 'es',
  fra: 'fr',
  fre: 'fr',
  deu: 'de',
  ger: 'de',
  ita: 'it',
  por: 'pt',
  nld: 'nl',
  dut: 'nl',
  rus: 'ru',
  tur: 'tr',
  pol: 'pl',
  swe: 'sv',
  dan: 'da',
  fin: 'fi',
  ces: 'cs',
  cze: 'cs',
  ron: 'ro',
  rum: 'ro',
  hun: 'hu',
  ell: 'el',
  gre: 'el',
  ukr: 'uk',

  // Arabic/Hebrew/Indic
  ara: 'ar',
  arb: 'ar',
  heb: 'he',
  hin: 'hi',

  // CJK
  jpn: 'ja',
  kor: 'ko',
  cmn: 'zh',
  zho: 'zh',

  // SE Asia
  tha: 'th',
  vie: 'vi',
  ind: 'id',
  msa: 'ms',
  tgl: 'tl',
  fil: 'tl',

  // Norwegian variants (normalize to 'no')
  nor: 'no',
  nob: 'no',
  nno: 'no',
};

export function detectLanguageFromText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 20) {
    return null;
  }

  const candidates = francAll(trimmed, { minLength: 10 }) as Array<[string, number]>;
  for (const [iso6393] of candidates) {
    if (iso6393 === 'und') {
      continue;
    }

    const mapped = ISO_639_3_TO_1[iso6393];
    if (mapped && SUPPORTED_ISO_639_1.has(mapped)) {
      return mapped;
    }
  }

  return null;
}


import 'server-only';

import type { HealthAutocompleteOption } from '@ultaura/types';

const NLM_TIMEOUT_MS = 3000;

// NLM Clinical Tables API returns a 4-element array:
// [totalCount, codeArray, extraFieldsObj, displayStrings]
type NlmApiResponse = [number, string[], Record<string, unknown>, string[][]];

async function fetchNlmApi(url: string): Promise<NlmApiResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NLM_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    return data as NlmApiResponse;
  } catch (err) {
    console.error('[health/autocomplete] NLM API fetch failed:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchConditions(
  query: string
): Promise<HealthAutocompleteOption[]> {
  if (!query.trim()) return [];

  const url = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(query)}&maxList=10`;

  const data = await fetchNlmApi(url);
  if (!data) return [];

  const codes: string[] = data[1] ?? [];
  const displayStrings: string[][] = data[3] ?? [];

  const results: HealthAutocompleteOption[] = [];

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const fields = displayStrings[i];
    if (!code || !fields) continue;

    // sf=code,name — fields[0] is code, fields[1] is name
    const name = fields[1] ?? fields[0] ?? code;
    const label = `${code} — ${name}`;

    results.push({
      provider: 'icd10cm_clinical_tables',
      label,
      normalizedName: name,
      standardizedId: { system: 'ICD-10-CM', code },
    });
  }

  return results;
}

export async function searchMedications(
  query: string
): Promise<HealthAutocompleteOption[]> {
  if (!query.trim()) return [];

  const url = `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?sf=DISPLAY_NAME&terms=${encodeURIComponent(query)}&maxList=10`;

  const data = await fetchNlmApi(url);
  if (!data) return [];

  const rxcuis: string[] = data[1] ?? [];
  const displayStrings: string[][] = data[3] ?? [];

  const results: HealthAutocompleteOption[] = [];

  for (let i = 0; i < rxcuis.length; i++) {
    const rxcui = rxcuis[i];
    const fields = displayStrings[i];
    if (!rxcui || !fields) continue;

    // sf=DISPLAY_NAME — fields[0] is the display name
    const displayName = fields[0] ?? rxcui;

    results.push({
      provider: 'rxterms_rxnorm',
      label: displayName,
      normalizedName: displayName,
      standardizedId: { system: 'RxNorm', code: rxcui },
    });
  }

  return results;
}

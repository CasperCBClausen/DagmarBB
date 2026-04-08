/**
 * Automatic translation service using MyMemory (https://mymemory.translated.net).
 *
 * No API key required.
 * Free: 1,000 words/day per IP.
 * Optional: set MYMEMORY_EMAIL in .env to get 10,000 words/day (still free).
 *
 * To add dynamic translation to any other model:
 *   1. Add `translations Json @default("{}")` to the Prisma model
 *   2. Call `translateToAllLanguages(text)` in the create/update route
 *   3. On the client: translations?.[i18n.language] ?? translations?.en ?? originalText
 */

export const SUPPORTED_LANGS = ['da', 'en', 'de', 'es', 'fr', 'nl', 'it'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
export type Translations = Record<string, string>;

async function callMyMemory(text: string, targetLang: string): Promise<string> {
  const email = process.env.MYMEMORY_EMAIL
    ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}`
    : '';
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${targetLang}${email}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory responded ${res.status}`);

  const data = (await res.json()) as {
    responseStatus: number;
    responseData: { translatedText: string };
  };

  if (data.responseStatus !== 200) throw new Error(`MyMemory error: ${data.responseStatus}`);
  return data.responseData.translatedText;
}

/**
 * Translates `text` into all supported languages.
 * Returns { da, en, de, es, fr } — original text used as fallback on any error.
 * Never throws.
 */
export async function translateToAllLanguages(text: string): Promise<Translations> {
  const result: Translations = Object.fromEntries(SUPPORTED_LANGS.map(l => [l, text]));

  await Promise.all(
    SUPPORTED_LANGS.map(async lang => {
      try {
        result[lang] = await callMyMemory(text, lang);
      } catch {
        // keep original text as fallback for this language
      }
    })
  );

  return result;
}

/**
 * Pick the best available translation for a given UI language code.
 * Falls back to 'en', then to the original text.
 */
export function pickTranslation(
  originalText: string,
  translations: Translations | null | undefined,
  lang: string
): string {
  if (!translations || typeof translations !== 'object') return originalText;
  const t = translations as Record<string, string>;
  return t[lang] ?? t['en'] ?? originalText;
}

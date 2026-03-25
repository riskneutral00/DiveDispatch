/**
 * Supported locales and default locale for i18n.
 * Matches seed data locales + Korean.
 */
export const SUPPORTED_LOCALES = [
  "en",
  "zh-CN",
  "zh-TW",
  "th",
  "fr",
  "ko",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

/**
 * Resolve the best locale from cookie value and Accept-Language header.
 * Priority: cookie > Accept-Language > default.
 * Returns DEFAULT_LOCALE if no supported locale is found.
 */
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | undefined,
): SupportedLocale {
  const supported: ReadonlyArray<string> = SUPPORTED_LOCALES;

  // 1. Cookie takes priority
  if (cookieValue && supported.includes(cookieValue)) {
    return cookieValue as SupportedLocale;
  }

  // 2. Parse Accept-Language header
  if (acceptLanguage) {
    const candidates = acceptLanguage
      .split(",")
      .map((part) => {
        const [lang, qPart] = part.trim().split(";");
        const q = qPart ? parseFloat(qPart.replace("q=", "")) : 1;
        return { lang: lang.trim(), q };
      })
      .sort((a, b) => b.q - a.q);

    for (const { lang } of candidates) {
      // Exact match first
      if (supported.includes(lang)) {
        return lang as SupportedLocale;
      }
      // Try base language match (e.g., "fr-FR" -> "fr")
      const base = lang.split("-")[0];
      const baseMatch = SUPPORTED_LOCALES.find(
        (s) => s === base || s.startsWith(base + "-"),
      );
      if (baseMatch) {
        return baseMatch;
      }
    }
  }

  // 3. Fallback
  return DEFAULT_LOCALE;
}

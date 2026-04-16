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

export function normalizeLocale(input: string | undefined | null): SupportedLocale {
  if (!input) return DEFAULT_LOCALE;
  const supported: ReadonlyArray<string> = SUPPORTED_LOCALES;
  if (supported.includes(input)) return input as SupportedLocale;
  const base = input.split("-")[0];
  if (supported.includes(base)) return base as SupportedLocale;
  const baseMatch = SUPPORTED_LOCALES.find((s) => s.startsWith(`${base}-`));
  if (baseMatch) return baseMatch;
  return DEFAULT_LOCALE;
}

export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | undefined,
): SupportedLocale {
  const supported: ReadonlyArray<string> = SUPPORTED_LOCALES;

  if (cookieValue && supported.includes(cookieValue)) {
    return cookieValue as SupportedLocale;
  }

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
      if (supported.includes(lang)) {
        return lang as SupportedLocale;
      }
      const base = lang.split("-")[0];
      const baseMatch = SUPPORTED_LOCALES.find(
        (s) => s === base || s.startsWith(base + "-"),
      );
      if (baseMatch) {
        return baseMatch;
      }
    }
  }

  return DEFAULT_LOCALE;
}

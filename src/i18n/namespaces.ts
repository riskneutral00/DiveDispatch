/**
 * Canonical next-intl namespaces — keep keys in sync across `messages/*.json`.
 * Migration order and conventions: `docs/I18N_ROLLOUT.md`.
 */
export const I18N_NAMESPACES = [
  "app",
  "common",
  "errors",
  "nav",
  "auth",
  "booking",
  "portal",
  "medical",
  "waiver",
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

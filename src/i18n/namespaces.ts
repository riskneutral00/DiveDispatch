/**
 * Canonical next-intl namespaces — keep keys in sync across `messages/*.json`.
 * Migration order and conventions: `docs/I18N_ROLLOUT.md`.
 */
export const I18N_NAMESPACES = [
  "app",
  "nav",
  "auth",
  "booking",
  "common",
  "onboarding",
  "errors",
  "portal",
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

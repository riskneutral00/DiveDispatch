/** Canonical starter skin slugs (single source for seed + client ordering). */
export const STARTER_SLUGS = [
  "abyss",
  "marble",
  "desert",
  "lagoon",
] as const;

export type StarterSlug = (typeof STARTER_SLUGS)[number];

/** Global display order for palette / “first in bucket” resolution. */
export const CANONICAL_SKIN_ORDER: readonly string[] = [
  "abyss",
  "marble",
  "desert",
  "lagoon",
];

// @generated — do not edit. Run `npm run gen:seed-slugs` to regenerate from ultraplan/canonical.json.
// comments-ok: generated-file marker

export const SEED_USER_SLUGS_BY_ENTRY = {
  "compressor_1": "wkxhew",
  "compressor_2": "h0a5zl",
  "equipment_manager_1": "n7rq5j",
  "equipment_manager_2": "v8sr2p",
  "equipment_manager_3": "q9bz7r",
  "boat_2": "p5ky3w",
  "instructor_1": "ryan-clarke",
  "instructor_2": "li-ming",
  "instructor_3": "wei-chen",
  "instructor_4": "arisa-kanchanaburi",
  "pool_2": "z8mv4c",
  "pool_3": "b3wt9f",
  "pool_4": "g2hn6x",
  "agent": "ax3k7p",
} as const

export const SEED_ORG_SLUGS_BY_ENTRY = {
  "compressor_1": "scuba-market-thailand",
  "compressor_2": "compressor-shop-chalong-pier",
  "equipment_manager_1": "hug-ocean",
  "equipment_manager_2": "scuba-revolution-phuket",
  "equipment_manager_3": "nicole-dive-center",
  "boat_1": "hug-ocean",
  "boat_2": "mandarin-queen",
  "instructor_1": "ryan-clarke",
  "instructor_2": "li-ming",
  "instructor_3": "wei-chen",
  "instructor_4": "arisa-kanchanaburi",
  "pool_1": "hug-ocean",
  "pool_2": "neptune",
  "pool_3": "water-pro",
  "pool_4": "shark-bites",
  "dive_center_1": "hug-ocean",
  "dive_center_2": "nicole-dive-center",
  "agent": "alex-walker",
} as const

export const SEED_CLERK_USER_ID_HINTS = {
  "arisa-kanchanaburi": "user_seed_arisa-kanchanaburi",
  "ax3k7p": "user_seed_ax3k7p",
  "b3wt9f": "user_seed_b3wt9f",
  "g2hn6x": "user_seed_g2hn6x",
  "h0a5zl": "user_seed_h0a5zl",
  "li-ming": "user_seed_li-ming",
  "n7rq5j": "user_seed_n7rq5j",
  "p5ky3w": "user_seed_p5ky3w",
  "q9bz7r": "user_seed_q9bz7r",
  "ryan-clarke": "user_seed_ryan-clarke",
  "v8sr2p": "user_seed_v8sr2p",
  "wei-chen": "user_seed_wei-chen",
  "wkxhew": "user_seed_wkxhew",
  "z8mv4c": "user_seed_z8mv4c",
} as const

export const SEED_CLERK_ORG_ID_HINTS = {
  "alex-walker": "org_seed_alex-walker",
  "arisa-kanchanaburi": "org_seed_arisa-kanchanaburi",
  "compressor-shop-chalong-pier": "org_seed_compressor-shop-chalong-pier",
  "hug-ocean": "org_seed_hug-ocean",
  "li-ming": "org_seed_li-ming",
  "mandarin-queen": "org_seed_mandarin-queen",
  "neptune": "org_seed_neptune",
  "nicole-dive-center": "org_seed_nicole-dive-center",
  "ryan-clarke": "org_seed_ryan-clarke",
  "scuba-market-thailand": "org_seed_scuba-market-thailand",
  "scuba-revolution-phuket": "org_seed_scuba-revolution-phuket",
  "shark-bites": "org_seed_shark-bites",
  "water-pro": "org_seed_water-pro",
  "wei-chen": "org_seed_wei-chen",
} as const

export type SeedStakeholderId = keyof typeof SEED_USER_SLUGS_BY_ENTRY
export type SeedOrgStakeholderId = keyof typeof SEED_ORG_SLUGS_BY_ENTRY
export type SeedUserSlug = keyof typeof SEED_CLERK_USER_ID_HINTS
export type SeedOrgSlug = keyof typeof SEED_CLERK_ORG_ID_HINTS

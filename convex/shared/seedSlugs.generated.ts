// @generated — do not edit. Run `npm run gen:seed-slugs` to regenerate from ultraplan/canonical.json.
// comments-ok: generated-file marker

export const SEED_USER_SLUGS_BY_ENTRY = {
  "compressor_1": "wkxhew",
  "compressor_2": "h0a5zl",
  "equipment_manager_1": "n7rq5j",
  "equipment_manager_2": "v8sr2p",
  "equipment_manager_3": "q9bz7r",
  "boat_2": "p5ky3w",
  "instructor_1": "geprkx",
  "instructor_2": "lkp3zm",
  "instructor_3": "wc8qg2",
  "instructor_4": "z039zt",
  "pool_2": "z8mv4c",
  "pool_3": "b3wt9f",
  "pool_4": "g2hn6x",
  "agent": "ax3k7p",
} as const

export const SEED_ORG_SLUGS_BY_ENTRY = {
  "compressor_1": "wkxhew",
  "compressor_2": "h0a5zl",
  "equipment_manager_1": "n7rq5j",
  "equipment_manager_2": "v8sr2p",
  "equipment_manager_3": "q9bz7r",
  "boat_1": "n7rq5j",
  "boat_2": "p5ky3w",
  "instructor_1": "geprkx",
  "instructor_2": "lkp3zm",
  "instructor_3": "wc8qg2",
  "instructor_4": "z039zt",
  "pool_1": "n7rq5j",
  "pool_2": "z8mv4c",
  "pool_3": "b3wt9f",
  "pool_4": "g2hn6x",
  "dive_center_1": "n7rq5j",
  "dive_center_2": "q9bz7r",
  "agent": "ax3k7p",
} as const

export const SEED_CLERK_USER_ID_HINTS = {
  "ax3k7p": "user_seed_ax3k7p",
  "b3wt9f": "user_seed_b3wt9f",
  "g2hn6x": "user_seed_g2hn6x",
  "geprkx": "user_seed_geprkx",
  "h0a5zl": "user_seed_h0a5zl",
  "lkp3zm": "user_seed_lkp3zm",
  "n7rq5j": "user_seed_n7rq5j",
  "p5ky3w": "user_seed_p5ky3w",
  "q9bz7r": "user_seed_q9bz7r",
  "v8sr2p": "user_seed_v8sr2p",
  "wc8qg2": "user_seed_wc8qg2",
  "wkxhew": "user_seed_wkxhew",
  "z039zt": "user_seed_z039zt",
  "z8mv4c": "user_seed_z8mv4c",
} as const

export const SEED_CLERK_ORG_ID_HINTS = {
  "ax3k7p": "org_seed_ax3k7p",
  "b3wt9f": "org_seed_b3wt9f",
  "g2hn6x": "org_seed_g2hn6x",
  "geprkx": "org_seed_geprkx",
  "h0a5zl": "org_seed_h0a5zl",
  "lkp3zm": "org_seed_lkp3zm",
  "n7rq5j": "org_seed_n7rq5j",
  "p5ky3w": "org_seed_p5ky3w",
  "q9bz7r": "org_seed_q9bz7r",
  "v8sr2p": "org_seed_v8sr2p",
  "wc8qg2": "org_seed_wc8qg2",
  "wkxhew": "org_seed_wkxhew",
  "z039zt": "org_seed_z039zt",
  "z8mv4c": "org_seed_z8mv4c",
} as const

export const SEED_USER_TO_ORG_SLUG = {
  "ax3k7p": "ax3k7p",
  "b3wt9f": "b3wt9f",
  "g2hn6x": "g2hn6x",
  "geprkx": "geprkx",
  "h0a5zl": "h0a5zl",
  "lkp3zm": "lkp3zm",
  "n7rq5j": "n7rq5j",
  "p5ky3w": "p5ky3w",
  "q9bz7r": "q9bz7r",
  "v8sr2p": "v8sr2p",
  "wc8qg2": "wc8qg2",
  "wkxhew": "wkxhew",
  "z039zt": "z039zt",
  "z8mv4c": "z8mv4c",
} as const

export const SEED_ORG_NAME_BY_SLUG = {
  "ax3k7p": "Alex Walker Dive Travel",
  "b3wt9f": "Water Pro",
  "g2hn6x": "Shark Bites",
  "geprkx": "Ryan Clarke",
  "h0a5zl": "Compressor Shop Chalong Pier",
  "lkp3zm": "Li Ming",
  "n7rq5j": "Hug Ocean",
  "p5ky3w": "Mandarin Queen",
  "q9bz7r": "Nicole Dive Center",
  "v8sr2p": "Scuba Revolution Phuket",
  "wc8qg2": "Wei Chen",
  "wkxhew": "Scuba Market Thailand",
  "z039zt": "Arisa Kanchanaburi",
  "z8mv4c": "Neptune",
} as const

export type SeedStakeholderId = keyof typeof SEED_USER_SLUGS_BY_ENTRY
export type SeedOrgStakeholderId = keyof typeof SEED_ORG_SLUGS_BY_ENTRY
export type SeedUserSlug = keyof typeof SEED_CLERK_USER_ID_HINTS
export type SeedOrgSlug = keyof typeof SEED_CLERK_ORG_ID_HINTS

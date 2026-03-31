#!/usr/bin/env bash
# UserPromptSubmit hook: resolves "log me into <business>" to the correct seed slug.
# Lookup table from convex/seedData.ts — update if seed users change.

INPUT=$(cat)
echo "$INPUT" | grep -qiE 'log me in.?to' || exit 0

# Extract business name after "log me in(-)to" (stop at JSON quote boundary)
NAME=$(echo "$INPUT" | sed -n 's/.*[Ll]og [Mm]e [Ii]n.* [Tt]o \([^"]*\).*/\1/p' \
  | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
[ -z "$NAME" ] && exit 0

LNAME=$(echo "$NAME" | tr '[:upper:]' '[:lower:]')

case "$LNAME" in
  *compressor*|*chalong*)          SLUG=x4kp2m;    EMAIL="compressor-chalong+clerk_test@divedispatch.dev";    MATCH="Compressor Shop Chalong Pier" ;;
  *hug*ocean*boat*)                SLUG=n7rq5j-bt; EMAIL="hug-ocean-boat+clerk_test@divedispatch.dev";       MATCH="Hug Ocean Boat" ;;
  *hug*ocean*pool*)                SLUG=n7rq5j-pl; EMAIL="hug-ocean-pool+clerk_test@divedispatch.dev";       MATCH="Hug Ocean Pool" ;;
  *hug*ocean*equip*)               SLUG=n7rq5j-eq; EMAIL="hug-ocean-equipment+clerk_test@divedispatch.dev";  MATCH="Hug Ocean Equipment" ;;
  *hug*ocean*)                     SLUG=n7rq5j;    EMAIL="hug-ocean+clerk_test@divedispatch.dev";            MATCH="Hug Ocean" ;;
  *water*pro*)                     SLUG=b3wt9f;    EMAIL="water-pro+clerk_test@divedispatch.dev";            MATCH="Water Pro" ;;
  *neptune*pool*)                  SLUG=z8mv4c-pl; EMAIL="neptune-pool+clerk_test@divedispatch.dev";         MATCH="Neptune Pool" ;;
  *neptune*equip*)                 SLUG=z8mv4c-eq; EMAIL="neptune-equipment+clerk_test@divedispatch.dev";    MATCH="Neptune Equipment" ;;
  *neptune*)                       SLUG=z8mv4c;    EMAIL="neptune+clerk_test@divedispatch.dev";              MATCH="Neptune" ;;
  *shark*bite*)                    SLUG=g2hn6x;    EMAIL="shark-bites+clerk_test@divedispatch.dev";          MATCH="Shark Bites" ;;
  *phuket*dc*boat*|*phuket*dive*boat*) SLUG=p5ky3w-bt; EMAIL="phuket-dc-boat+clerk_test@divedispatch.dev";  MATCH="Phuket DC Boat" ;;
  *phuket*dc*equip*|*phuket*dive*equip*) SLUG=p5ky3w-eq; EMAIL="phuket-dc-equipment+clerk_test@divedispatch.dev"; MATCH="Phuket DC Equipment" ;;
  *phuket*dive*)                   SLUG=p5ky3w;    EMAIL="phuket-dive-center+clerk_test@divedispatch.dev";   MATCH="Phuket Dive Center" ;;
  *nicole*equip*)                  SLUG=q9bz7r-eq; EMAIL="nicole-dc-equipment+clerk_test@divedispatch.dev";  MATCH="Nicole DC Equipment" ;;
  *nicole*)                        SLUG=q9bz7r;    EMAIL="nicole-dive-center+clerk_test@divedispatch.dev";   MATCH="Nicole Dive Center" ;;
  *manta*)                         SLUG=v6js2t;    EMAIL="manta-dive-center+clerk_test@divedispatch.dev";    MATCH="Manta Dive Center" ;;
  *scubanick*equip*)               SLUG=m4fx8d-eq; EMAIL="scubanicks-equipment+clerk_test@divedispatch.dev"; MATCH="ScubaNicks Equipment" ;;
  *scubanick*)                     SLUG=m4fx8d;    EMAIL="scubanicks+clerk_test@divedispatch.dev";           MATCH="ScubaNicks" ;;
  *scuba*deep*boat*)               SLUG=h3cp6n-bt; EMAIL="scuba-deep-boat+clerk_test@divedispatch.dev";     MATCH="Scuba Deep Boat" ;;
  *scuba*deep*equip*)              SLUG=h3cp6n-eq; EMAIL="scuba-deep-equipment+clerk_test@divedispatch.dev"; MATCH="Scuba Deep Equipment" ;;
  *scuba*deep*)                    SLUG=h3cp6n;    EMAIL="scuba-deep+clerk_test@divedispatch.dev";           MATCH="Scuba Deep" ;;
  *pray*)                          SLUG=t7gw1k;    EMAIL="pray-dive-center+clerk_test@divedispatch.dev";    MATCH="Pray Dive Center" ;;
  *sirolo*)                        SLUG=sirolo;    EMAIL="sirolo+clerk_test@divedispatch.dev";               MATCH="Sirolo" ;;
  *ryan*clarke*|*ryan*)            SLUG=ryan-clarke; EMAIL="ryan-clarke+clerk_test@divedispatch.dev";       MATCH="Ryan Clarke" ;;
  *arisa*)                         SLUG=arisa-kanchanaburi; EMAIL="arisa-kanchanaburi+clerk_test@divedispatch.dev"; MATCH="Arisa" ;;
  *amanda*)                        SLUG=r5yz4q;    EMAIL="amanda+clerk_test@divedispatch.dev";               MATCH="Amanda" ;;
  *)                               exit 0 ;;
esac
PASS="REDACTED"

# Delete all @divedispatch.dev Clerk accounts and recreate seed users fresh
# --force prunes orphaned accounts + updates existing ones → avoids hitting Clerk account limits
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../.." && npm run seed:clerk -- --force >/dev/null 2>&1 || true

printf '{"user_message":"[Hook] Matched %s -> slug: %s (Clerk users synced). Use dev:token to sign in: npm run dev:token -- %s | Email: %s | Password: %s | OTP (if prompted): 424242"}' "$MATCH" "$SLUG" "$SLUG" "$EMAIL" "$PASS"

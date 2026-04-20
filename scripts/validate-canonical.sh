#!/usr/bin/env bash
# SP5-pre: validate ultraplan/canonical.json against canonical.schema.json.
# Exit 0 on pass; non-zero + errors printed on fail.
set -euo pipefail

cd "$(dirname "$0")/.."

SCHEMA="ultraplan/canonical.schema.json"
DATA="ultraplan/canonical.json"

if [ ! -f "$SCHEMA" ]; then
  echo "validate-canonical: $SCHEMA not found" >&2
  exit 2
fi
if [ ! -f "$DATA" ]; then
  echo "validate-canonical: $DATA not found" >&2
  exit 2
fi

npx --yes ajv-cli validate \
  -s "$SCHEMA" \
  -d "$DATA" \
  -c ajv-formats \
  --all-errors \
  --strict=false

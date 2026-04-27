# Seed Users — Single Source of Truth

All auth skills (`clerk-signin`, `clerk-switch`, navigator agent) reference this file for user lookup.

## Users

| Name | Slug | RoleSlug | Role | Email |
|------|------|----------|------|-------|
| Sea Fun (Rene) | `sea-fun` | `dive-center` | DC + Compressor + Equipment + Boat + Instructor + Venue | `rene_balot+clerk_test@seafundivers.com` |
| Hug Ocean | `n7rq5j` | `dive-center` | DC + Boat + Pool + Equipment | `hug-ocean+clerk_test@divedispatch.dev` |
| Nicole | `q9bz7r` | `dive-center` | DC + Equipment | `nicole-dive-center+clerk_test@divedispatch.dev` |
| Sirolo | `sirolo` | `dive-center` | DC + Boat + Equipment | `sirolo+clerk_test@divedispatch.dev` |
| Ryan Clarke | `ryan-clarke` | `instructor` | Instructor | `ryan-clarke+clerk_test@divedispatch.dev` |
| Arisa | `arisa-kanchanaburi` | `dive-master` | DiveMaster | `arisa-kanchanaburi+clerk_test@divedispatch.dev` |
| Amanda | `r5yz4q` | `agent` | Agent | `amanda+clerk_test@divedispatch.dev` |

## Constants

- **Password (all users):** `divedispatch123`
- **OTP (if prompted):** `424242`
- **Dashboard URL pattern:** `/{slug}/{roleSlug}/dashboard` (user slug first, role second)
- **Default user:** Hug Ocean (`n7rq5j`)

## Fuzzy Matching

Match the search term against Name, Slug, or Email. Use the first match. Common aliases:

| Request | Resolves To |
|---------|-------------|
| `sea-fun`, `seafun`, `rene` | Sea Fun (Rene) |
| `hug`, `ocean`, `default` | Hug Ocean |
| `nicole` | Nicole |
| `sirolo` | Sirolo |
| `ryan`, `instructor` | Ryan Clarke |
| `arisa`, `divemaster`, `dive-master` | Arisa |
| `amanda`, `agent` | Amanda |

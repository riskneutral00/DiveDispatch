# Clerk Organizations Configuration

> Manual configuration required in Clerk Dashboard. This document specifies the exact settings.
> Referenced by `auth-model.md`. Last updated: 2026-04-06.

## JWT Template

Clerk Dashboard → JWT Templates → `convex`

Add these custom claims:

```json
{
  "org_id": "{{org.id}}",
  "org_role": "{{org.role}}",
  "org_slug": "{{org.slug}}",
  "org_permissions": "{{org.permissions}}"
}
```

Without these claims, `authorize()` operates in fallback mode (existing auth patterns).

## Organizations Setup

Enable Organizations in Clerk Dashboard. Each operational unit = one Clerk Organization:
- A dive center operation
- A liveaboard operation
- A resort dive operation

One owner running multiple operations = admin in multiple separate Clerk Orgs.

## Permission Tiers

Clerk Dashboard → Organizations → Roles

| Clerk Role | Permissions | Who |
|---|---|---|
| `org:admin` | `org:bookings:manage`, `org:resources:manage`, `org:themes:manage`, `org:members:manage`, `org:settings:manage` | Dive center owner, liveaboard owner |
| `org:manager` | `org:bookings:manage`, `org:resources:manage`, `org:themes:read` | Senior staff, operations lead |
| `org:member` | `org:bookings:create`, `org:bookings:read`, `org:resources:read` | Staff instructor, assigned resource |
| `org:viewer` | `org:bookings:read`, `org:resources:read` | Accountant, observer |

## Permissions Registry

Flat list to register in Clerk Dashboard → Organizations → Permissions:

- `org:bookings:manage` — CRUD all bookings in org
- `org:bookings:create` — create bookings only
- `org:bookings:read` — view bookings
- `org:resources:manage` — add/remove/edit resource assignments
- `org:resources:read` — view resource directory
- `org:themes:manage` — create/edit themes (fixes `themes.upsert` security hole)
- `org:themes:read` — view themes
- `org:members:manage` — invite/remove org members
- `org:settings:manage` — org-level settings

## Key Distinctions

- Clerk roles (~4) are permission tiers, NOT 1:1 with DD's 12 stakeholder types
- `userRoles` table tracks domain stakeholder type (Instructor, Boat, Equipment, etc.) — NOT replaced by Clerk
- Clerk caps at 10 custom roles per instance — do not create per-stakeholder roles
- JWT carries only the active organization's permissions — cross-org checks require Convex-side lookup

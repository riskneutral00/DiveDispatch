# DiveDispatch

**Multi-stakeholder booking platform for the scuba diving industry.**

<!-- badges -->
<!-- ![Build](https://img.shields.io/github/actions/workflow/status/...) -->
<!-- ![License](https://img.shields.io/badge/license-TBD-lightgrey) -->

---

## Overview

DiveDispatch is the connective tissue between every business in the dive supply chain. One booking flows through the dive center that organizes the trip, the instructor who teaches it, the boat that carries everyone, the equipment manager who packs the gear, and the compressor that fills the tanks — all coordinated in real time.

Operators create bookings from a staff dashboard. The system checks availability across all required resources, places atomic holds on inventory, and fans out acceptance requests to each stakeholder. Customers complete their paperwork (waivers, medical questionnaire, gear sizing) through a tokenized portal link — no account required.

The UI is built on a **Liquid Glass** aesthetic — glassmorphism with backdrop blur, luminous borders, and fully themeable skins. Themes are a core product feature, not a cosmetic afterthought: every component is driven by CSS custom properties, and each theme ships with both light and dark palettes.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router) | Server/client rendering, routing |
| Backend | Convex | Real-time database, mutations, subscriptions |
| Auth | Clerk | Staff authentication, user management |
| Styling | Tailwind CSS 4 + CSS custom properties | Utility classes + themeable design tokens |
| Validation | Zod 4 | Client-side form validation |
| i18n | next-intl | Internationalization |
| Icons | Lucide React | Icon system |
| E2E Testing | Playwright | End-to-end browser tests |
| Unit Testing | Vitest | Unit/integration tests |

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** (comes with Node)
- **Convex CLI** — `npm install -g convex`
- **Clerk account** — [clerk.com](https://clerk.com) (free tier works)

### Install

```bash
git clone <repo-url>
cd DiveDispatch
npm install
```

### Environment Setup

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `CONVEX_DEPLOYMENT` | Convex deployment identifier |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL (public) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (public) |
| `CLERK_SECRET_KEY` | Clerk secret key (server-only) |
| `CLERK_ISSUER_URL` | Clerk JWT issuer URL for Convex auth |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in route (default: `/sign-in`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up route (default: `/sign-up`) |
| `NEXT_PUBLIC_APP_URL` | App base URL (default: `http://localhost:3000`) |
| `RESEND_API_KEY` | Resend API key for transactional email (optional) |
| `DEV_MODE` | Enable dev-only features (default: `true`) |

### Run

Start the Convex backend and Next.js dev server in separate terminals:

```bash
# Terminal 1 — Convex
npx convex dev

# Terminal 2 — Next.js
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed the Database

```bash
# Wipe existing data + seed fresh
npm run seed:force

# Create matching Clerk users
npm run seed:clerk

# Or do both in one command
npm run seed:force:all
```

Seed credentials: email format `{name}@divedispatch.dev`, password `REDACTED`.

## Project Structure

```
DiveDispatch/
├── convex/                   # Convex backend (schema, mutations, queries, seeds)
├── docs/                     # Domain knowledge (DOMAIN_KNOWLEDGE.md)
├── e2e/                      # Playwright end-to-end tests
├── messages/                 # i18n translation files
├── public/                   # Static assets
├── scripts/                  # CLI scripts (Clerk seeding)
├── src/
│   ├── app/
│   │   ├── (auth)/           # Sign-in / sign-up routes
│   │   ├── (dashboard)/      # Staff dashboard (booking, directory, resources, settings)
│   │   ├── (portal)/         # Customer portal (tokenized, no auth)
│   │   ├── admin/            # Admin routes
│   │   └── api/              # API routes
│   ├── components/
│   │   ├── booking/          # Booking-specific components
│   │   ├── common/           # Shared UI components
│   │   ├── dashboard/        # Dashboard layout components
│   │   ├── glass/            # Liquid Glass design system (GlassCard, GlassButton, etc.)
│   │   ├── portal/           # Customer portal components
│   │   └── ui/               # Base UI primitives
│   ├── lib/
│   │   ├── booking/          # Booking business logic
│   │   ├── constants/        # Static data (gear sizing, roles, countries)
│   │   ├── hooks/            # React hooks
│   │   ├── types/            # TypeScript type definitions
│   │   ├── utils/            # Utility functions
│   │   └── validators/       # Zod validation schemas
│   └── themes/               # Theme definitions (CSS custom properties)
└── tests/                    # Vitest unit tests
```

## Architecture

### Dependency Direction

```
convex/  ←  lib/  ←  components/  ←  app/
```

Never import upstream. `convex/` knows nothing about React. `lib/` knows nothing about components.

### Provider Nesting Order

Order is critical — wrong nesting causes silent auth failures:

```
ClerkProvider → ConvexProviderWithClerk → ThemeProvider
```

### Auth Boundary

- **Staff routes:** Clerk auth required. Mutations validate Clerk identity at entry.
- **Customer portal:** Tokenized BookingLink (UUID). No Clerk auth needed.
- Every mutation modifying a booking verifies caller ownership via `users.slug`.

## Key Concepts

### Booking Lifecycle

A booking moves through four statuses: **Draft → Upcoming → Completed → Cancelled**. A booking auto-advances from Draft to Upcoming when both the operator's booking form and the customer's portal form are complete (and no medical hard-blocks exist). Cancellation is terminal — no undo.

### Reservation States

Each resource hold on a booking is a Reservation: **PendingAcceptance → Confirmed** (stakeholder accepts) or **PendingAcceptance → Vacated** (decline/cancel/expiry). Vacated reservations release inventory back to the pool.

### Availability Snapshots

Inventory is tracked via `AvailabilitySnapshot` documents. Snapshot updates always occur in the **same Convex mutation** as the Reservation write — this guarantees no double-booking of exclusive units and correct decrement of pooled inventory.

### Equipment Fulfillment

Single-manager, strict-fail model. The operator selects one EquipmentManager per booking. If that manager lacks sufficient inventory, the entire booking conflicts — no cross-manager fallback, no split holds.

### 12 Stakeholder Roles

**Organizers** (create bookings): DiveCenter, Agent, Liveaboard, DiveResort, DiveHostel, DiveSite

**Resources** (confirm participation): Instructor, DiveMaster, Boat, Equipment, Pool, Compressor

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run seed` | Seed Convex database |
| `npm run seed:force` | Wipe + reseed Convex database |
| `npm run seed:clerk` | Create matching Clerk users |
| `npm run seed:force:all` | Wipe + reseed database + Clerk users |
| `npm run wipe:all` | Wipe all Convex data |
| `npm test` | Run Vitest unit tests |

## Testing

**E2E is the primary testing strategy.** Playwright tests cover critical user journeys across the full stack — Clerk auth, Convex mutations, reactive UI, and state transitions. Unit tests are reserved for genuinely complex, non-obvious business logic.

```bash
# Unit tests
npm test

# E2E tests (requires dev server running)
npx playwright test
```

## Contributing

- TypeScript strict mode. No `any` types.
- Prefer immutability — spread operators, `.map()`, `.filter()`.
- Functions < 50 lines. Files < 800 lines.
- Only "why" comments.
- Use Glass components or CSS variables for all styling. Never hardcode colors.
- Use Lucide icons exclusively.

See [`CLAUDE.md`](./CLAUDE.md) for full development guidelines.

## License

TBD

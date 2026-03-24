# DiveDispatch

**Multi-stakeholder booking platform for the scuba diving industry.**

![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)
![Built with Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Built with Convex](https://img.shields.io/badge/Convex-real--time-ff6b35?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDdWMTdMMTIgMjJMMjAgMTdWN0wxMiAyWiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

> **Status:** Active development &middot; Pre-launch &middot; Built by [Risk Neutral](https://github.com/riskneutral00)

<!-- TODO: Add hero screenshot or GIF here once available -->
<!-- ![DiveDispatch Dashboard](docs/assets/hero.png) -->

---

## The Problem

Running a dive operation means coordinating instructors, boats, gear, tanks, and customers — usually over WhatsApp groups and spreadsheets. One booking touches half a dozen independent businesses, and if any of them double-books, the whole trip falls apart.

## The Solution

DiveDispatch replaces that with a single booking that flows through every stakeholder in real time. An operator creates a booking from the staff dashboard. The system checks availability across all required resources, places atomic holds on inventory, and fans out acceptance requests to each stakeholder. Customers complete their paperwork through a tokenized link — no account required.

## Why DiveDispatch?

- **Multi-stakeholder coordination** — One booking, many businesses. Each confirms their slice independently.
- **Atomic inventory** — No double-bookings, no partial holds, no race conditions. All-or-nothing.
- **Zero-friction customer portal** — Tokenized link for waivers, medical forms, and gear sizing. Works on any phone, no sign-up needed.
- **Themeable by design** — Liquid Glass aesthetic with swappable skins, light/dark palettes, and CSS custom property theming baked into every component.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router) | Server/client rendering with React Server Components |
| Backend | Convex | Real-time database with ACID mutations and live subscriptions |
| Auth | Clerk | Passwordless staff auth with JWT integration |
| Styling | Tailwind CSS 4 + CSS custom properties | Utility classes layered on themeable design tokens |
| Validation | Zod 4 | End-to-end type-safe validation |
| i18n | next-intl | Full internationalization support |
| E2E Testing | Playwright | Browser-based end-to-end tests |
| Unit Testing | Vitest | Fast unit and integration tests |

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** (comes with Node)
- **Convex CLI** — `npm install -g convex`
- **Clerk account** — [clerk.com](https://clerk.com) (free tier works)

### Install

```bash
git clone https://github.com/riskneutral00/DiveDispatch.git
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

After seeding, credentials are printed to the terminal. See the seed scripts for details.

## How It Works

A booking moves through four statuses: **Draft → Upcoming → Completed → Cancelled**. Each resource hold is a Reservation that stakeholders independently confirm or decline. Inventory is tracked via atomic snapshots — updated in the same mutation as the reservation write, guaranteeing consistency.

12 stakeholder roles span two categories:

- **Organizers** (create bookings): DiveCenter, Agent, Liveaboard, DiveResort, DiveHostel, DiveSite
- **Resources** (confirm participation): Instructor, DiveMaster, Boat, Equipment, Pool, Compressor

For full domain knowledge — booking lifecycle, reservation states, availability snapshots, equipment fulfillment — see [`docs/DOMAIN_KNOWLEDGE.md`](./docs/DOMAIN_KNOWLEDGE.md).

## Architecture

### Dependency Direction

```
convex/  ←  lib/  ←  components/  ←  app/
```

Never import upstream. `convex/` knows nothing about React. `lib/` knows nothing about components.

### Auth Boundary

- **Staff routes:** Clerk auth required. Mutations validate Clerk identity at entry.
- **Customer portal:** Tokenized BookingLink (UUID). No Clerk auth needed.
- Every mutation modifying a booking verifies caller ownership via `users.slug`.

<details>
<summary><strong>Project Structure</strong></summary>

```
DiveDispatch/
├── convex/                   # Convex backend (schema, mutations, queries, seeds)
├── docs/                     # Domain knowledge, LLM handoff docs
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
│   │   ├── glass/            # Liquid Glass design system
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

</details>

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
| `npm test` | Run Vitest unit tests |

## Testing

Tests follow a **cheapest-test-first** strategy. Unit tests cover pure logic. Behavioral tests cover state transitions. E2E tests are reserved for frontend-backend wiring that can't be caught at a lower level.

```bash
# Unit tests
npm test

# E2E tests (requires dev server running)
npx playwright test
```

## Contributing

Contributions welcome. Please open an issue to discuss before submitting a PR.

## License

[AGPL-3.0](./LICENSE)

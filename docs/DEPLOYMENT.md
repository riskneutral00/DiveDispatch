# DiveDispatch Deployment Guide

Deploy DiveDispatch from scratch: Vercel (Next.js frontend) + Convex (backend) + Clerk (auth) + Resend (email).

---

## 1. Prerequisites

- Node.js 20+
- npm 10+
- GitHub account with access to the DiveDispatch repo
- Accounts on: [Vercel](https://vercel.com), [Convex](https://dashboard.convex.dev), [Clerk](https://dashboard.clerk.com), [Resend](https://resend.com)
- (Optional) Google Maps API key for map features

## 2. Convex Setup

### 2.1 Create a Convex project

1. Go to [dashboard.convex.dev](https://dashboard.convex.dev) and create a new project.
2. Note the **Deployment URL** (looks like `https://your-project-123.convex.cloud`).

### 2.2 Deploy Convex functions

```bash
npx convex deploy
```

This pushes all functions in `convex/` to your production Convex deployment.

### 2.3 Set Convex environment variables

In the Convex dashboard, go to **Settings > Environment Variables** and set:

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Your Resend API key (used by Convex actions to send email) |
| `SITE_URL` | Your production URL, e.g. `https://divedispatch.com` (used to construct portal links in emails) |

These are **not** set in `.env.local` — they live in the Convex dashboard because Convex actions run server-side on Convex infrastructure.

## 3. Clerk Setup

### 3.1 Create a Clerk application

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) and create a new application.
2. Under **JWT Templates**, note the **Issuer URL** (looks like `https://your-clerk-instance.clerk.accounts.dev`).
3. Configure sign-in methods as needed (email, Google, etc.).

### 3.2 Connect Clerk to Convex

1. In the Convex dashboard, go to **Settings > Authentication**.
2. Add Clerk as a provider using the Issuer URL from above.

### 3.3 Production domain

1. In Clerk dashboard, go to **Domains** and add your production domain.
2. This ensures auth cookies are scoped correctly.

## 4. Vercel Setup

### 4.1 Create Vercel project

1. Go to [vercel.com](https://vercel.com) and create a new project.
2. **Import** the DiveDispatch GitHub repository.
3. Vercel auto-detects Next.js. Confirm these build settings:
   - **Framework Preset:** Next.js
   - **Build Command:** `next build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)

### 4.2 Environment variables

Set the following in Vercel's **Settings > Environment Variables**:

| Variable | Value | Description |
|---|---|---|
| `CONVEX_DEPLOYMENT` | `prod:your-project-123` | Convex deployment identifier (from Convex dashboard) |
| `NEXT_PUBLIC_CONVEX_URL` | `https://your-project-123.convex.cloud` | Public Convex endpoint for the frontend client |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk publishable key (from Clerk dashboard) |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk secret key (from Clerk dashboard, keep secret) |
| `CLERK_ISSUER_URL` | `https://your-clerk-instance.clerk.accounts.dev` | Clerk JWT issuer URL (used for Convex auth verification) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Route for sign-in page |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Route for sign-up page |
| `NEXT_PUBLIC_APP_URL` | `https://divedispatch.com` | Public-facing app URL (used for links, redirects) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIza...` | Google Maps JavaScript API key (optional, for map features) |

**Do NOT set** in Vercel:

| Variable | Why |
|---|---|
| `RESEND_API_KEY` | Set in Convex dashboard — email is sent from Convex actions, not Next.js |
| `SITE_URL` | Set in Convex dashboard — used by Convex actions to build portal URLs |
| `DEV_MODE` | Development only — never set in production |

### 4.3 Domain configuration

1. In Vercel, go to **Settings > Domains** and add your custom domain.
2. Update DNS records as Vercel instructs (CNAME or A record).
3. Vercel handles SSL automatically.
4. Ensure the same domain is configured in Clerk (Section 3.3).

## 5. Deploy

### 5.1 Automatic deploys

Vercel deploys automatically on every push to `main`. Preview deployments are created for pull requests.

### 5.2 Manual deploy

```bash
# Deploy Convex functions first
npx convex deploy

# Vercel deploys from Git, or trigger manually:
vercel --prod
```

Always deploy Convex before Vercel if both have changes — the frontend may call new functions that don't exist yet.

## 6. Pre-Deploy Checklist

Before every production deploy, verify:

- [ ] `npm run build` succeeds locally with no errors
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] All environment variables are set in Vercel (Section 4.2)
- [ ] Convex environment variables are set in Convex dashboard (Section 2.3)
- [ ] Convex functions are deployed (`npx convex deploy`)
- [ ] Clerk production domain is configured (Section 3.3)
- [ ] Clerk issuer URL is added to Convex auth settings (Section 3.2)
- [ ] DNS is pointed to Vercel (Section 4.3)

## 7. Post-Deploy Verification

After deploying:

1. Visit the production URL and confirm the page loads.
2. Sign in with Clerk and confirm auth works.
3. Create a test booking and verify data appears in Convex dashboard.
4. Trigger an email action and confirm delivery via Resend dashboard.
5. Check Convex dashboard logs for any function errors.

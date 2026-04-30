#!/usr/bin/env node
// Poka-yoke for `next dev`: clear `.next` before every dev start so a
// corrupt build cache (left behind by a killed/aborted Turbopack build)
// can never cause this symptom:
//
//   ENOENT: '.next/dev/server/app/.../page/build-manifest.json'
//   → every request 500s with "missing required error components, refreshing..."
//
// Detection-based heuristics (page.js without build-manifest.json) are
// fragile because Turbopack lazy-compiles pages on first request, so the
// "orphan page.js" state is also a normal transient. Cost of always
// clearing is one Turbopack rebuild (~300ms on this repo).
//
// Skipped when another `next-server` is already running, because
// `dev-auto.sh` allows concurrent dev servers on ports 3000-3003 and
// they share `.next` — clearing under a live server crashes it.
//
// Wired as the `predev` npm script so it runs automatically on `npm run dev`.

import { existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const NEXT_DIR = join(process.cwd(), '.next')

function devServerRunning() {
  try {
    const out = execFileSync('pgrep', ['-f', 'next-server'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.trim().length > 0
  } catch {
    return false
  }
}

if (!existsSync(NEXT_DIR)) {
  process.exit(0)
}

if (devServerRunning()) {
  process.exit(0)
}

process.stdout.write('▶ Clearing .next (predev poka-yoke)\n')
rmSync(NEXT_DIR, { recursive: true, force: true })

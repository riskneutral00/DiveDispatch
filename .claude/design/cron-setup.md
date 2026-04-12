# Auto-dispatch — launchd Setup (macOS)

Runs `/post-spec` on a timer against your local repo. No cloud, no token surprise — each firing is pure bash until a ready ticket actually exists.

## Components

| Piece | Role |
|---|---|
| `scripts/post-spec-poll.sh` | Fast-path check; invokes `claude -p /post-spec` only if there's a `ready` ticket with Spec + Acceptance. |
| `scripts/post-spec-sweeper.sh` | Pure-bash claim cleaner; releases `in_progress` tickets claimed by `cron-agent`/`post-spec` idle >60 min. No Claude invocation. |
| `~/Library/LaunchAgents/com.divedispatch.post-spec-poll.plist` | Fires poll every 15 min, 09:00–21:00 weekdays. |
| `~/Library/LaunchAgents/com.divedispatch.post-spec-sweeper.plist` | Fires sweeper every 30 min, always. |
| `.claude/hooks/gate-on-commit.sh` | Pre-commit hook; runs `claude -p /gate` headlessly on `git commit` and blocks on NO-GO. Already wired. |

Logs: `.claude/logs/{post-spec-poll,post-spec-sweeper,gate-on-commit}.log` (gitignored).

## Install (one-time)

### 1. Smoke-test the scripts

```bash
cd ~/Desktop/RiskNeutral/DiveDispatch
bash scripts/post-spec-poll.sh       # should log "no ready tickets" if none exist
bash scripts/post-spec-sweeper.sh    # silent unless something to release
cat .claude/logs/post-spec-poll.log
```

### 2. Write the plists

Copy-paste these into your terminal — the `cat > …` heredocs write the files directly.

```bash
cat > ~/Library/LaunchAgents/com.divedispatch.post-spec-poll.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.divedispatch.post-spec-poll</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/scripts/post-spec-poll.sh</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/Users/matthewlee/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key><string>/Users/matthewlee</string>
  </dict>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Weekday</key><integer>1</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Weekday</key><integer>1</integer><key>Minute</key><integer>15</integer></dict>
    <dict><key>Weekday</key><integer>1</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Weekday</key><integer>1</integer><key>Minute</key><integer>45</integer></dict>
  </array>
  <key>StandardOutPath</key><string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/.claude/logs/post-spec-poll.stdout</string>
  <key>StandardErrorPath</key><string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/.claude/logs/post-spec-poll.stderr</string>
</dict>
</plist>
EOF
```

**Note on StartCalendarInterval:** the snippet above only lists Monday (Weekday=1) for readability. To actually fire every 15 min Mon–Fri 09:00–21:00, you need 5 weekdays × 13 hours × 4 quarter-hours = 260 `<dict>` entries. That's tedious by hand. Two simpler alternatives:

- **`StartInterval` every 900 seconds (15 min), always on** — no calendar filter. The poll script exits fast when there's nothing to do, so cost is negligible. **Recommended.**
- Use a helper that generates the full calendar array.

Here's the simpler **StartInterval** version — use this instead:

```bash
cat > ~/Library/LaunchAgents/com.divedispatch.post-spec-poll.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.divedispatch.post-spec-poll</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/scripts/post-spec-poll.sh</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/Users/matthewlee/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key><string>/Users/matthewlee</string>
  </dict>
  <key>StartInterval</key><integer>900</integer>
  <key>StandardOutPath</key><string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/.claude/logs/post-spec-poll.stdout</string>
  <key>StandardErrorPath</key><string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/.claude/logs/post-spec-poll.stderr</string>
</dict>
</plist>
EOF

cat > ~/Library/LaunchAgents/com.divedispatch.post-spec-sweeper.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.divedispatch.post-spec-sweeper</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/scripts/post-spec-sweeper.sh</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch</string>
  <key>StartInterval</key><integer>1800</integer>
  <key>StandardOutPath</key><string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/.claude/logs/post-spec-sweeper.stdout</string>
  <key>StandardErrorPath</key><string>/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/.claude/logs/post-spec-sweeper.stderr</string>
</dict>
</plist>
EOF
```

### 3. Load them

```bash
launchctl load ~/Library/LaunchAgents/com.divedispatch.post-spec-poll.plist
launchctl load ~/Library/LaunchAgents/com.divedispatch.post-spec-sweeper.plist
launchctl list | grep divedispatch   # verify both registered
```

First poll fires within 900s. Watch `.claude/logs/post-spec-poll.log` — you should see `… no ready tickets` entries.

### 4. End-to-end test

1. Create a trivial ticket with real Spec + Acceptance via `/board`.
2. Wait for the next poll (≤15 min) or force-run: `bash scripts/post-spec-poll.sh`.
3. Confirm the log shows `invoking /post-spec (1 ready tickets)` and the ticket moves through pick → commit.

## Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.divedispatch.post-spec-poll.plist
launchctl unload ~/Library/LaunchAgents/com.divedispatch.post-spec-sweeper.plist
rm ~/Library/LaunchAgents/com.divedispatch.post-spec-poll.plist
rm ~/Library/LaunchAgents/com.divedispatch.post-spec-sweeper.plist
```

## Kill switches (temporary bypass, leave plist loaded)

- **Skip post-spec polls:** `launchctl setenv DD_SKIP_POSTSPEC 1`; undo with `launchctl unsetenv DD_SKIP_POSTSPEC`.
- **Skip /gate on commit:** `DD_SKIP_GATE=1 git commit …` (inline, one commit).
- **Permanent:** `launchctl unload …` (uninstall-then-reload is the clean path).

## Notes & trade-offs

- **Always-on polling.** `StartInterval: 900` fires 96×/day. The script exits in <1s when nothing's ready, so it's a rounding error on your laptop's runtime. Only when `/post-spec` actually runs does it consume tokens.
- **Laptop must be on.** If your laptop is asleep, launchd defers — no missed fires, but no execution during sleep either. Unlike `/schedule` (cloud), your laptop is the runtime.
- **No weekday filter by default.** Add `StartCalendarInterval` later if you want to restrict to work hours; the sweeper is cheap enough to leave 24/7.
- **`git commit` still triggers `/gate`.** That's hook-wired, independent of these plists.
- **`/vault` still manual.** Per rules — no auto-trigger.

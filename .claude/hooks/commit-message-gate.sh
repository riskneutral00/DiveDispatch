#!/bin/bash
# PreToolUse hook: Commit message quality gate
# Blocks vague commit messages (< 10 chars or missing conventional prefix)
python3 "$(dirname "$0")/commit-message-gate.py"

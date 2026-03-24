#!/bin/bash
# PreToolUse hook: Test co-location reminder
# Non-blocking warning when mutations/lib files are committed without tests
python3 "$(dirname "$0")/test-colocation-check.py"

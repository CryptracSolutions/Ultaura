#!/usr/bin/env bash
#
# check-sensitive-logs.sh
#
# SECURITY: This script checks for potentially dangerous logging patterns
# that could leak sensitive data (PII, PHI, conversation content) to logs.
#
# Patterns checked:
# 1. Direct logging of 'args' to recordDebugEvent without summarization
# 2. Logging sensitive keys without redaction
# 3. skipDebugLog: false (explicit opt-in to debug logging should be reviewed)
#
# Exit codes:
# 0 - No issues found
# 1 - Potential sensitive data logging detected

set -euo pipefail

TELEPHONY_DIR="${1:-telephony/src}"
FOUND_ISSUES=0

echo "Checking for sensitive data logging patterns in $TELEPHONY_DIR..."
echo ""

# Pattern 1: Check for raw 'args' being passed to recordDebugEvent
# This catches: recordDebugEvent(..., { ...args }) or recordDebugEvent(..., { args: args })
# But should NOT flag: { argsSummary: summarizeArgs(args) }
echo "=== Checking for raw args in recordDebugEvent ==="
if grep -rn -A 12 'recordDebugEvent' "$TELEPHONY_DIR" | grep -w 'args' | grep -v 'argsSummary' | grep -v 'summarizeArgs' | grep -v '\.test\.ts'; then
  echo "ERROR: Found recordDebugEvent calls with potentially raw 'args'"
  echo "       Use summarizeArgs(args) to create a safe summary instead."
  FOUND_ISSUES=1
else
  echo "OK: No raw args in recordDebugEvent"
fi
echo ""

# Pattern 2: Check for sensitive fields being logged without redaction
# These are fields that commonly contain PII/PHI
SENSITIVE_FIELDS="message|content|text|summary|narrative|transcript|memory|memories|value|context|response_given|observation"

echo "=== Checking for sensitive fields in console.log/logger calls ==="
if grep -rn -E "logger\\.(info|debug|warn)[[:space:]]*\\(" "$TELEPHONY_DIR" | grep -w -E "$SENSITIVE_FIELDS" | grep -v 'redact' | grep -v '\.test\.ts' | head -20; then
  echo ""
  echo "WARNING: Found logger calls that may include sensitive fields."
  echo "         Ensure these are properly redacted using redactSensitive()."
  # This is a warning, not a blocking error - review needed
fi
echo ""

# Pattern 3: Check for explicit skipDebugLog: false
# This is intentional opt-in, but should be reviewed
echo "=== Checking for explicit debug log opt-in (skipDebugLog: false) ==="
OPTINS=$(grep -rn -E 'skipDebugLog:[[:space:]]*false' "$TELEPHONY_DIR" 2>/dev/null | grep -v '\.test\.ts' || true)
if [ -n "$OPTINS" ]; then
  echo "INFO: Found explicit skipDebugLog: false (requires review):"
  echo "$OPTINS"
  echo ""
  echo "       These locations explicitly enable debug logging."
  echo "       Ensure payloads are properly sanitized."
  # Not blocking, but should be audited
fi
echo ""

# Pattern 4: Check for new tool handlers without skipDebugLog
echo "=== Checking for recordCallEvent without skipDebugLog ==="
if grep -rn "recordCallEvent(" "$TELEPHONY_DIR/routes/tools" 2>/dev/null | grep -v 'skipDebugLog' | grep -v '\.test\.ts' | head -10; then
  echo ""
  echo "WARNING: Found recordCallEvent calls without skipDebugLog option."
  echo "         The default is now skipDebugLog: true, but explicit is better."
fi
echo ""

if [ $FOUND_ISSUES -eq 1 ]; then
  echo "=============================================="
  echo "FAILED: Sensitive data logging issues detected"
  echo "=============================================="
  exit 1
fi

echo "=============================================="
echo "PASSED: No sensitive data logging issues found"
echo "=============================================="
exit 0

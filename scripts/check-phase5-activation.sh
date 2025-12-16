#!/bin/bash
# Phase 5 Activation Diagnostic Script (Shell version)
# Alternative to TypeScript version - simpler, faster

set -euo pipefail

echo "[DIAGNOSTIC] Fetching Railway logs..."
LOGS=$(railway logs --service xBOT --lines 500 2>&1 || {
  echo "❌ Failed to fetch logs"
  exit 1
})

echo "[DIAGNOSTIC] Analyzing logs..."
echo ""

# Count occurrences
SLOT_POLICY_COUNT=$(echo "$LOGS" | grep -c "\[SLOT_POLICY\]" || echo "0")
GEN_POLICY_COUNT=$(echo "$LOGS" | grep -c "\[GEN_POLICY\]" || echo "0")
VOICE_GUIDE_COUNT=$(echo "$LOGS" | grep -c "\[VOICE_GUIDE\]" || echo "0")
PHASE4_COUNT=$(echo "$LOGS" | grep -c "\[PHASE4" || echo "0")
PLAN_JOB_COUNT=$(echo "$LOGS" | grep -c -E "\[PLAN_JOB\]|planJob|CONTENT SLOT" || echo "0")

# Find evidence
SLOT_POLICY_LINES=$(echo "$LOGS" | grep "\[SLOT_POLICY\]" | head -5 || echo "")
GEN_POLICY_LINES=$(echo "$LOGS" | grep "\[GEN_POLICY\]" | head -5 || echo "")
VOICE_GUIDE_LINES=$(echo "$LOGS" | grep "\[VOICE_GUIDE\]" | head -5 || echo "")
PHASE4_LINES=$(echo "$LOGS" | grep "\[PHASE4" | head -5 || echo "")

# Find errors
ERRORS=$(echo "$LOGS" | grep -iE "Unknown generator|slotPolicyInitialized=false|generatorPolicyInitialized=false|policy fallback|error|exception|failed" | grep -v "no error" | head -10 || echo "")

# Generate report
REPORT_FILE="docs/reports/PHASE5_ACTIVATION_REPORT.md"
mkdir -p docs/reports

cat > "$REPORT_FILE" <<EOF
# Phase 5 Activation Report

**Generated:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")
**Source:** Railway xBOT service logs (last 500 lines)

## 1. Activation Summary

| Component | Status | Count |
|-----------|--------|-------|
| [SLOT_POLICY] | $([ "$SLOT_POLICY_COUNT" -gt 0 ] && echo "✅ YES" || echo "❌ NO") | $SLOT_POLICY_COUNT |
| [GEN_POLICY] | $([ "$GEN_POLICY_COUNT" -gt 0 ] && echo "✅ YES" || echo "❌ NO") | $GEN_POLICY_COUNT |
| [VOICE_GUIDE] | $([ "$VOICE_GUIDE_COUNT" -gt 0 ] && echo "✅ YES" || echo "❌ NO") | $VOICE_GUIDE_COUNT |
| [PHASE4][Router] | $([ "$PHASE4_COUNT" -gt 0 ] && echo "✅ YES" || echo "❌ NO") | $PHASE4_COUNT |

## 2. Evidence from Logs

### [SLOT_POLICY] Evidence
$([ -n "$SLOT_POLICY_LINES" ] && echo "$SLOT_POLICY_LINES" | sed 's/^/- `/;s/$/`/' || echo "❌ No [SLOT_POLICY] entries found")

### [GEN_POLICY] Evidence
$([ -n "$GEN_POLICY_LINES" ] && echo "$GEN_POLICY_LINES" | sed 's/^/- `/;s/$/`/' || echo "❌ No [GEN_POLICY] entries found")

### [VOICE_GUIDE] Evidence
$([ -n "$VOICE_GUIDE_LINES" ] && echo "$VOICE_GUIDE_LINES" | sed 's/^/- `/;s/$/`/' || echo "❌ No [VOICE_GUIDE] entries found")

### [PHASE4][Router] Evidence
$([ -n "$PHASE4_LINES" ] && echo "$PHASE4_LINES" | sed 's/^/- `/;s/$/`/' || echo "❌ No [PHASE4] entries found")

## 3. Plan Job Health

| Check | Status |
|-------|--------|
| planJob Running | $([ "$PLAN_JOB_COUNT" -gt 0 ] && echo "✅ YES" || echo "❌ NO") |

## 4. Errors / Warnings

$([ -n "$ERRORS" ] && echo "$ERRORS" | sed 's/^/- `/;s/$/`/' || echo "✅ No critical errors found")

## 5. System Health Status

$([ "$SLOT_POLICY_COUNT" -gt 0 ] && [ "$GEN_POLICY_COUNT" -gt 0 ] && [ "$VOICE_GUIDE_COUNT" -gt 0 ] && [ "$PHASE4_COUNT" -gt 0 ] && echo "✅ **FULLY ACTIVATED**: All Phase 5 components are active" || ([ "$PHASE4_COUNT" -gt 0 ] && echo "⚠️ **PARTIALLY ACTIVATED**: Phase 4 is active, Phase 5 policies waiting for initialization" || echo "❌ **NOT ACTIVATED**: No Phase 5 components detected"))

## 6. Recommendations

$([ "$SLOT_POLICY_COUNT" -gt 0 ] && [ "$GEN_POLICY_COUNT" -gt 0 ] && [ "$VOICE_GUIDE_COUNT" -gt 0 ] && [ "$PHASE4_COUNT" -gt 0 ] && echo "- ✅ Phase 5 is running correctly. Continue monitoring." || ([ "$PHASE4_COUNT" -gt 0 ] && echo "- ⚠️ Phase 4 is active, but Phase 5 policies are not yet initialized. Wait for next planJob execution." || echo "- ❌ Phase 5 not detected. Check flags and restart service if needed."))
EOF

echo "[DIAGNOSTIC] ✅ Report generated: $REPORT_FILE"
echo ""
cat "$REPORT_FILE"


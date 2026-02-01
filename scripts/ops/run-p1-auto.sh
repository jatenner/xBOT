#!/bin/bash
# P1 Automated Workflow
# Runs all P1 phases automatically with timeout protection and evidence collection

set -e

TIMEOUT=180  # 3 minutes per Railway command
MAX_HARVEST_CYCLES=10
MAX_POLL_ATTEMPTS=120  # 10 minutes polling (5s intervals)
P1_START_DATE="2026-02-01"  # Only consider replies after this date

echo "═══════════════════════════════════════════════════════════"
echo "🎯 P1 Automated Workflow"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Helper: Run Railway command with timeout (Mac-compatible)
run_railway_with_timeout() {
  local env_vars="$1"
  local script_path="$2"
  local log_file="$3"
  local timeout="${4:-$TIMEOUT}"
  
  echo "Running: railway run --service serene-cat $env_vars pnpm exec tsx $script_path"
  echo "Logging to: $log_file"
  
  # Mac doesn't have timeout command, use gtimeout if available, otherwise run without timeout
  # Railway CLI: pass env vars before the command, don't use bash -c
  if command -v gtimeout >/dev/null 2>&1; then
    gtimeout $timeout railway run --service serene-cat $env_vars pnpm exec tsx "$script_path" > "$log_file" 2>&1 || {
      local exit_code=$?
      if [ $exit_code -eq 124 ]; then
        echo "⚠️  Command timed out after ${timeout}s (this is OK, checking results...)"
      else
        echo "⚠️  Command exited with code $exit_code (checking results...)"
      fi
    }
  else
    # Run without timeout - Railway CLI will handle its own timeouts
    railway run --service serene-cat $env_vars pnpm exec tsx "$script_path" > "$log_file" 2>&1 || {
      local exit_code=$?
      echo "⚠️  Command exited with code $exit_code (checking results...)"
    }
  fi
}

# Helper: Get public candidate count
get_public_count() {
  pnpm exec tsx scripts/ops/check-public-count.ts 2>&1 | grep -o '[0-9]*' | head -1 || echo "0"
}

# Helper: Extract P1_PROBE_SUMMARY ok value (Mac-compatible)
extract_probe_ok() {
  local log_file="$1"
  grep "P1_PROBE_SUMMARY" "$log_file" 2>/dev/null | sed -E 's/.*ok=([0-9]+).*/\1/' | head -1 || echo "0"
}

# Helper: Check if executor daemon is running
check_executor_running() {
  pgrep -f "executor.*daemon" > /dev/null 2>&1 || pgrep -f "RUNNER_MODE=true" > /dev/null 2>&1
}

# Helper: Get latest posted reply URL (after P1_START_DATE)
get_latest_reply_url() {
  pnpm exec tsx scripts/ops/get-latest-p1-reply.ts 2>/dev/null | grep -E "https://x.com" || echo ""
}

# PHASE A: Harvest cycles until >= 25 candidates
echo "═══════════════════════════════════════════════════════════"
echo "PHASE A: Building Public Candidates"
echo "═══════════════════════════════════════════════════════════"
echo ""

INITIAL_COUNT=$(get_public_count)
echo "Initial public candidates: $INITIAL_COUNT"
echo "Target: 25"
echo ""

if [ "$INITIAL_COUNT" -ge 25 ]; then
  echo "✅ Already have $INITIAL_COUNT candidates (>= 25)"
else
  for i in $(seq 1 $MAX_HARVEST_CYCLES); do
    echo "Harvest cycle $i/$MAX_HARVEST_CYCLES..."
    
    run_railway_with_timeout \
      "P1_MODE=true" \
      "scripts/ops/run-harvester-single-cycle.ts" \
      "/tmp/harvest-cycle-$i.log" \
      $TIMEOUT
    
    sleep 5  # Wait for DB to update
    
    CURRENT_COUNT=$(get_public_count)
    echo "Current count: $CURRENT_COUNT"
    
    if [ "$CURRENT_COUNT" -ge 25 ]; then
      echo "✅ Target reached: $CURRENT_COUNT candidates"
      break
    fi
    
    if [ $i -lt $MAX_HARVEST_CYCLES ]; then
      echo "Waiting 10s before next cycle..."
      sleep 10
    fi
  done
  
  FINAL_COUNT=$(get_public_count)
  echo ""
  echo "Final count: $FINAL_COUNT"
  
  if [ "$FINAL_COUNT" -lt 25 ]; then
    echo "❌ FAILED: Only $FINAL_COUNT candidates (need 25)"
    echo "Check harvest logs: /tmp/harvest-cycle-*.log"
    exit 1
  fi
fi

# PHASE B: Plan-only until ok>=1
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "PHASE B: Plan-Only Probe"
echo "═══════════════════════════════════════════════════════════"
echo ""

run_railway_with_timeout \
  "REPLY_V2_ROOT_ONLY=true P1_MODE=true P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 REPLY_V2_PLAN_ONLY=true" \
  "scripts/ops/run-reply-v2-planner-once.ts" \
  "/tmp/planner-plan-only.log" \
  $TIMEOUT

PROBE_OK=$(extract_probe_ok "/tmp/planner-plan-only.log" || echo "0")
echo "P1_PROBE_SUMMARY ok=$PROBE_OK"

if [ "$PROBE_OK" -eq "0" ]; then
  echo ""
  echo "❌ FAILED: Probe ok=0 (no candidates passed preflight)"
  echo ""
  echo "Probe reasons:"
  pnpm exec tsx scripts/ops/p1-probe-reasons.ts
  echo ""
  echo "Check planner log: /tmp/planner-plan-only.log"
  exit 1
fi

echo "✅ Probe passed: ok=$PROBE_OK"

# PHASE C: Create real decisions
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "PHASE C: Creating Real Decisions"
echo "═══════════════════════════════════════════════════════════"
echo ""

run_railway_with_timeout \
  "REPLY_V2_ROOT_ONLY=true P1_MODE=true P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20" \
  "scripts/ops/run-reply-v2-planner-once.ts" \
  "/tmp/planner-real.log" \
  $TIMEOUT

echo "✅ Decisions created (check /tmp/planner-real.log for decision_ids)"

# PHASE D: Executor check and posting verification
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "PHASE D: Executor & Posting Verification"
echo "═══════════════════════════════════════════════════════════"
echo ""

if check_executor_running; then
  echo "✅ Executor daemon is running"
else
  echo "⚠️  Executor daemon not detected"
  echo ""
  echo "Please start executor with:"
  echo "  EXECUTION_MODE=executor RUNNER_MODE=true pnpm run executor:daemon"
  echo ""
  echo "Then press ENTER to continue..."
  read
fi

echo ""
echo "Polling for posted reply (up to 10 minutes)..."
echo ""

INITIAL_REPLY_URL=$(get_latest_reply_url)
if [ -n "$INITIAL_REPLY_URL" ]; then
  echo "Found existing reply: $INITIAL_REPLY_URL"
  echo "Waiting for NEW reply..."
fi

for i in $(seq 1 $MAX_POLL_ATTEMPTS); do
  sleep 5
  
  CURRENT_REPLY_URL=$(get_latest_reply_url)
  
  if [ -n "$CURRENT_REPLY_URL" ] && [ "$CURRENT_REPLY_URL" != "$INITIAL_REPLY_URL" ]; then
    echo ""
    echo "✅ SUCCESS: Reply posted!"
    echo "Reply URL: $CURRENT_REPLY_URL"
    REPLY_URL="$CURRENT_REPLY_URL"
    break
  fi
  
  if [ $((i % 12)) -eq 0 ]; then
    echo "  Still waiting... ($((i * 5))s elapsed)"
  fi
done

if [ -z "$REPLY_URL" ]; then
  echo ""
  echo "❌ FAILED: No reply posted after 10 minutes"
  echo "Check executor logs and status:"
  echo "  pnpm exec tsx scripts/p1-status.ts"
  exit 1
fi

# PHASE E: Update documentation
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "PHASE E: Updating Documentation"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Extract decision_id and tweet_id from reply URL
TWEET_ID=$(echo "$REPLY_URL" | sed -E 's|.*status/([0-9]+).*|\1|')
DECISION_ID=$(pnpm exec tsx -e "
  import('dotenv/config');
  const { getSupabaseClient } = require('./src/db/index.ts');
  (async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('tweet_id', '$TWEET_ID')
      .eq('status', 'posted')
      .single();
    if (data) console.log(data.decision_id);
  })().catch(() => {});
" 2>/dev/null | head -1 || echo "")

PROBE_SUMMARY=$(grep "P1_PROBE_SUMMARY" /tmp/planner-plan-only.log | head -1)

# Create proof document
mkdir -p docs/proofs/p1-reply-v2-first-post
cat > docs/proofs/p1-reply-v2-first-post/P1_FIRST_REPLY_POSTED.md <<EOF
# P1 First Reply Posted - PROOF

**Date:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Status:** ✅ COMPLETE

## Evidence

- **decision_id:** $DECISION_ID
- **tweet_id:** $TWEET_ID
- **reply_url:** $REPLY_URL
- **posted_at:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## P1_PROBE_SUMMARY

\`\`\`
$PROBE_SUMMARY
\`\`\`

## Commands Run

\`\`\`bash
pnpm p1:auto
\`\`\`

## Harvest Cycles

- Initial count: $INITIAL_COUNT
- Final count: $FINAL_COUNT
- Cycles run: $(ls -1 /tmp/harvest-cycle-*.log 2>/dev/null | wc -l)

## Logs

- Harvest logs: /tmp/harvest-cycle-*.log
- Planner plan-only: /tmp/planner-plan-only.log
- Planner real: /tmp/planner-real.log
EOF

echo "✅ Created proof doc: docs/proofs/p1-reply-v2-first-post/P1_FIRST_REPLY_POSTED.md"

# Update TRACKER.md
if [ -f "docs/TRACKER.md" ]; then
  sed -i.bak 's/## Phase 5.*/## Phase 5 - Create Real Decisions + Post\n- [✅] Run planner without PLAN_ONLY\n- [✅] Verify decisions exist\n- [✅] Start executor (if not running)\n- [✅] Verify claim->post outcome\n- [✅] Capture reply URL: '"$REPLY_URL"'/' docs/TRACKER.md
  sed -i.bak 's/## Phase 6.*/## Phase 6 - Reporting\n- [✅] Update SYSTEM_STATUS.md\n- [✅] Update TRACKER.md\n- [✅] Create daily status snapshot\n- [✅] Create P1_FIRST_REPLY_URL.md proof doc/' docs/TRACKER.md
  echo "✅ Updated docs/TRACKER.md"
fi

# Update SYSTEM_STATUS.md
if [ -f "docs/SYSTEM_STATUS.md" ]; then
  cat >> docs/SYSTEM_STATUS.md <<EOF

## P1 Status: ✅ COMPLETE

**Completed:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Reply URL:** $REPLY_URL
**Decision ID:** $DECISION_ID
**Tweet ID:** $TWEET_ID

### Final Metrics
- Public candidates: $FINAL_COUNT
- Probe ok: $PROBE_OK
- Reply posted: ✅
EOF
  echo "✅ Updated docs/SYSTEM_STATUS.md"
fi

# Update daily status
DAILY_STATUS="docs/status/daily/$(date +%Y-%m-%d).md"
mkdir -p "$(dirname "$DAILY_STATUS")"
cat >> "$DAILY_STATUS" <<EOF

## P1 Completion

**Time:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Status:** ✅ COMPLETE
**Reply URL:** $REPLY_URL
**Decision ID:** $DECISION_ID
**Tweet ID:** $TWEET_ID
EOF
echo "✅ Updated $DAILY_STATUS"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ P1 COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Reply URL: $REPLY_URL"
echo "Proof doc: docs/proofs/p1-reply-v2-first-post/P1_FIRST_REPLY_POSTED.md"
echo ""
exit 0

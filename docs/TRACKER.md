# P1 End-to-End Tracker

**Mission:** Get 1 Reply V2 successfully posted (reply URL) with DB evidence + proof doc.

## Status Legend
- ⏳ PLANNED: Task identified, not started
- 🔨 BUILT: Code/script exists, not verified
- ✅ PROVEN: Verified with evidence (logs/SQL)
- ❌ BLOCKED: Cannot proceed (requires manual action or fix)

## Phase 0 - Prep/Deploy
- [✅] Git clean and current commit verified
- [✅] Railway deployment started
- [⏳] Confirm serene-cat running deployed commit

## Phase 1 - Auth + Session Health Gate
- [✅] **ARCHITECTURAL CHANGE:** Executor owns authenticated browsing
  - **Railway (control-plane):** Runs public discovery WITHOUT auth requirement
  - **Executor (executor-plane):** Must be authenticated (fail-closed for posting)
  - **Auth source of truth:** Executor Chrome profile (local_chrome_profile)
- [✅] Session built from `.x_cookies.env` (auth_token YES, ct0 YES)
- [✅] Session pushed to Railway
- [⚠️] Railway auth diagnostic: `classification=challenge_wall` (not a blocker - public discovery works)

## Phase 2 - Harvest + Candidate Supply
- [✅] **PROVEN:** Public discovery works without Railway auth
  - **Evidence:** `public_search_health_low: 1 opportunity` found
  - **Harvester changes:** Allows public discovery when `logged_in=false`
  - **Seed harvesting:** Skipped on Railway (moved to executor-plane)
- [⏳] Run full harvest cycle on Railway (verify public_search_* increases)
- [⏳] Record counts in daily status

## Phase 3 - Planner Plan-Only
- [⏳] Run planner with REPLY_V2_PLAN_ONLY=true
- [⏳] Verify P1_PROBE_SUMMARY ok >= 1

## Phase 4 - Readiness Gate
- [⏳] Run check-p1-ready script
- [⏳] Verify no blockers

## Phase 5 - Create Real Decisions + Post
- [⏳] Run planner without PLAN_ONLY
- [⏳] Verify decisions exist
- [⏳] Start executor (if not running)
- [⏳] Verify claim->post outcome
- [⏳] Capture reply URL

## Phase 6 - Reporting
- [⏳] Update SYSTEM_STATUS.md
- [⏳] Update TRACKER.md
- [⏳] Create daily status snapshot
- [⏳] Create P1_FIRST_REPLY_URL.md proof doc

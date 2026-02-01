# xBOT Project Tracker

**Last Updated:** 2026-01-29  
**Overall Progress:** TBD (computed by status-report.ts)

## Status Legend

- **PLANNED**: Task identified, not started
- **BUILT**: Code implemented, not proven
- **PROVEN**: Working with proof doc in `docs/proofs/...`
- **BROKEN**: Previously working, now broken

## Infrastructure Lane

### Auth & Session Management
- [ ] **BUILT** Session sync Mac → Railway
  - Proof: `docs/proofs/auth/SESSION_SYNC.md`
- [ ] **BUILT** Auth freshness check (fail-closed)
  - Proof: `docs/proofs/auth/AUTH_FAIL_CLOSED.md`
- [ ] **BUILT** Executor safety (headless, stoppable)
  - Proof: `docs/proofs/infra/EXECUTOR_SAFETY.md`

### Database & Migrations
- [x] **PROVEN** Accessibility status tracking
  - Proof: `docs/proofs/p1-reply-v2-first-post/MIGRATION_APPLIED_PROOF.md`
- [x] **PROVEN** Forbidden authors table
  - Proof: `docs/proofs/p1-reply-v2-first-post/PUBLIC_DISCOVERY_LANE_IMPLEMENTED.md`

## Reply V2 Lane

### Discovery
- [ ] **BUILT** Public-only discovery lane
  - Proof: `docs/proofs/p1-reply-v2-first-post/RAILWAY_PUBLIC_DISCOVERY_FIX.md` (pending)
- [ ] **BUILT** Seed list fallback
  - Proof: `docs/proofs/p1-reply-v2-first-post/RAILWAY_PUBLIC_DISCOVERY_FIX.md` (pending)
- [ ] **BUILT** Empty result classifier
  - Proof: `docs/proofs/p1-reply-v2-first-post/RAILWAY_PUBLIC_DISCOVERY_FIX.md` (pending)

### Scheduling & Execution
- [x] **PROVEN** Accessibility filtering upstream
  - Proof: `docs/proofs/p1-reply-v2-first-post/MIGRATION_APPLIED_PROOF.md`
- [x] **PROVEN** P1 volume increase (20 attempts)
  - Proof: `docs/proofs/p1-reply-v2-first-post/MIGRATION_APPLIED_PROOF.md`
- [ ] **BUILT** P1 readiness check
  - Proof: `docs/proofs/p1-reply-v2-first-post/P1_READINESS_CHECK.md` (pending)

### P1 Completion
- [ ] **PLANNED** First successful Reply V2 post
  - Proof: `docs/proofs/p1-reply-v2-first-post/FIRST_POST_PROOF.md` (pending)

## Metrics & Learning Lane

- [ ] **PLANNED** Engagement tracking
- [ ] **PLANNED** Learning system integration

## Autonomy Lane

- [ ] **PLANNED** Self-healing harvest cycles
- [ ] **PLANNED** Adaptive discovery strategies

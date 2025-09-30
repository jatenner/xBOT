# 🚀 Production-Ready Learning System - Tracking Issue

**Goal**: Make xBOT production-ready for real learning toward follower growth

**Status**: 🟡 In Progress  
**Target**: Complete today, enable posting tomorrow when OpenAI quota resets

---

## ✅ Acceptance Criteria

- [ ] No references to `unified_ai_intelligence.status` remain
- [ ] Posting queue shows ready decisions when real LLM is on
- [ ] Outcomes job writes `simulated=false` rows
- [ ] Learner runs with ≥5 real outcomes and persists v1 predictors
- [ ] `/api/growth` and `/api/learning/status` respond with meaningful values
- [ ] OpenAI 429s show backoff logs, no job crashes, no infinite retries
- [ ] All migrations are idempotent and safe to re-run
- [ ] Tests pass for all new components

---

## 📋 Sub-Tasks

### 0. Repository Hygiene & Guards
- [ ] Replace deprecated `createChatCompletion()` with `openaiBudgetedClient`
- [ ] Add exponential backoff with jitter for OpenAI 429s (500ms, 1s, 2s)
- [ ] Cap retries=2 per job tick
- [ ] Surface `[OPENAI_BACKOFF]` logs
- [ ] Ensure refunds logged on 4xx/5xx
- [ ] Verify posting disabled via env (not hardcoded)

### 1. Schema Migrations (Idempotent)
- [ ] `posted_decisions`: add `profile_visits`, `link_clicks`, `bookmarks`
- [ ] `outcomes`: add `follows`, `profile_visits`, `link_clicks`, `bookmarks`, `reward_composite`, `collected_pass`
- [ ] `content_metadata`: add `experiment_id`, `hook_pattern`, `novelty`, `scheduled_at`, `status`
- [ ] Create indexes: `idx_outcomes_real`, `idx_cm_sched`
- [ ] Fix posting queue bug (remove `unified_ai_intelligence.status` references)
- [ ] Backfill `scheduled_at` for recent items

### 2. Outcomes Collection (Real Metrics)
- [ ] Implement `analyticsCollectorJob.ts`
- [ ] Collect at T+1h (pass=1) and T+24h (pass=2)
- [ ] Fetch: impressions, likes, retweets, replies, profile_visits, link_clicks, bookmarks, follows
- [ ] Compute derived: `er`, `fpki`, `retweet_rate`
- [ ] UPSERT with `collected_pass` tracking
- [ ] Log: `[ANALYTICS_COLLECTOR] stored outcome decision_id=... pass=... er=... fpki=...`

### 3. Reward Shaping (Growth-First)
- [ ] Implement composite reward: `0.5*fpki + 0.3*retweet_rate + 0.15*reply_rate + 0.05*novelty - 0.1*dup_penalty`
- [ ] Add exposure weighting: `min(1, 1000 / max(1, impressions))`
- [ ] Skip training unless `simulated=false` and ≥5 fresh outcomes
- [ ] Log version bump: `[LEARN_JOB] coeffs_updated=v{N}`

### 4. Exploration Policy
- [ ] Thompson Sampling with uncertainty-epsilon
- [ ] Start epsilon=0.20, decay to 0.05 over 14 days
- [ ] Log: `[BANDIT] explore forced arm=<id> reason=high_uncertainty`
- [ ] UCB1 timing with exploration bonus for low-sample hours

### 5. Feature Extraction
- [ ] Extract `hook_pattern` (Did you know, New study, question, contrarian, CTA)
- [ ] Compute `novelty` (1 - max cosine similarity vs 30d embeddings)
- [ ] Add readability score
- [ ] Add sentiment (-1..+1)
- [ ] For replies: `follower_count`, `tweet_velocity`, `tweet_age_min`

### 6. Predictors
- [ ] Keep ridge/logistic baseline
- [ ] Add optional GBM microservice (`gbmService.ts`)
- [ ] Train weekly or when samples +25
- [ ] Persist to Redis: `predictor:content:v{N}`, `predictor:timing:v{N}`
- [ ] Fallback cleanly to ridge/logistic on error
- [ ] Add tests for train/predict paths

### 7. Experiments Framework
- [ ] Create `experiments.ts` with toggles
- [ ] Implement: `hashtag_1`, `question_cta`, `contrarian_reply`, `late_evening_slot`
- [ ] Assign `experiment_id` on each decision
- [ ] Log arms selected
- [ ] Expose flags via API
- [ ] Compute per-experiment lift (doubly-robust estimator)

### 8. Observability/API
- [ ] `/api/learning/status` - model versions, explore_rate, arms summary
- [ ] `/api/growth` - followers, top posts, FPKI, novelty
- [ ] Extend `/api/metrics` - followers_today, fpki_avg_7d, etc.
- [ ] Basic auth with ADMIN_TOKEN

### 9. Rate & Safety Controls
- [ ] Keep `POSTING_DISABLED=true` in staging
- [ ] Posting queue respects status lifecycle
- [ ] Gates: quality/dup/rotation
- [ ] Skip synthetic in live mode
- [ ] Add posting retry with backoff
- [ ] Log `[POST_RETRY]`

### 10. Tests & Validation
- [ ] Unit: reward calculator
- [ ] Unit: exploration scheduler
- [ ] Unit: feature extractor
- [ ] Unit: posting queue DAO
- [ ] Unit: collector upserts
- [ ] Integration: outcomes pass 1 & 2
- [ ] Integration: learner triggers after ≥5 samples
- [ ] Smoke: seed 6 fake outcomes → verify coeffs_updated

### 11. Deliverables
- [ ] Tracking issue with checklist ✓ (this file)
- [ ] PR-A: Migrations + DAO fixes
- [ ] PR-B: Collectors + reward + exploration
- [ ] PR-C: Predictors + experiments
- [ ] PR-D: APIs + dashboards
- [ ] PR-E: Retries + backoff
- [ ] Update `README_OPERATIONS.md`
- [ ] Railway logs excerpts
- [ ] `/api/learning/status` JSON sample

---

## 🎯 PR Groups

### PR-A: Migrations + DAO Fixes
**Branch**: `feat/schema-migrations-dao-fixes`
- Idempotent migrations with up/down
- Fix `unified_ai_intelligence.status` bug
- Update posting queue DAO

### PR-B: Collectors + Reward + Exploration
**Branch**: `feat/collectors-reward-exploration`
- Analytics collector (T+1h, T+24h passes)
- Growth-focused reward shaping
- Exploration policy improvements

### PR-C: Predictors + Experiments
**Branch**: `feat/predictors-experiments`
- Feature extraction
- GBM predictor service
- Experiments framework

### PR-D: APIs + Dashboards
**Branch**: `feat/observability-apis`
- `/api/learning/status`
- `/api/growth`
- Extended `/api/metrics`

### PR-E: Retries + Backoff
**Branch**: `feat/openai-backoff-retry`
- Exponential backoff for 429s
- Budget guard improvements
- Posting retry logic

---

## 📊 Progress Tracking

**Phase 1**: Schema + DAO (PR-A) - 🟡 In Progress  
**Phase 2**: Data Collection (PR-B) - ⏳ Pending  
**Phase 3**: ML Enhancements (PR-C) - ⏳ Pending  
**Phase 4**: Observability (PR-D) - ⏳ Pending  
**Phase 5**: Reliability (PR-E) - ⏳ Pending  
**Phase 6**: Testing + Deployment - ⏳ Pending

---

## 🚀 Launch Checklist (Tomorrow)

When OpenAI quota resets:
1. Verify staging metrics look good
2. Flip `POSTING_DISABLED=false`
3. Set `LIVE_POSTS=true`
4. Monitor first post
5. Verify outcomes collection at T+1h
6. Check learner after 5+ outcomes
7. Monitor growth metrics

---

**Last Updated**: 2025-09-30  
**Owner**: Platform Engineering  
**Related**: Production readiness, learning system, growth optimization

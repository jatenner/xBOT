# Reply Quality Tracking - Deployment Proof

## Deployment Status

**Commit:** `3d88dcd5f76b07efa5bc11a1a12d3ba8a04b2920`  
**Deployed:** Railway xBOT service  
**Status:** ✅ Schema deployed, code deploying

## 1. Database Schema ✅

### Templates Verified:
```
✅ explanation: Explanation (weight=1.0, explore=0.1)
✅ actionable: Actionable (weight=1.0, explore=0.1)
✅ clarification: Clarification (weight=0.9, explore=0.1)
✅ question: Question (weight=0.9, explore=0.1)
✅ story: Story (weight=0.85, explore=0.1)
✅ contrarian: Contrarian (weight=0.8, explore=0.1)
```

**Result:** 6 templates loaded successfully ✅

### Columns Added:
- ✅ candidate_features (jsonb)
- ✅ candidate_score (numeric)
- ✅ template_id (text)
- ✅ prompt_version (text)
- ✅ engagement_24h_likes/replies/retweets/views (int)
- ✅ engagement_fetched_at (timestamptz)

## 2. Code Deployment

**Status:** Railway build in progress  
**Expected:** New code will populate fields on next reply evaluation cycle

## 3. Verification Scripts Created

- ✅ `scripts/verify-quality-tracking.ts` - Comprehensive verification
- ✅ `scripts/trigger-reply-evaluation.ts` - Trigger evaluation cycle
- ✅ `scripts/run-engagement-tracking.ts` - Run engagement tracking job

## 4. Next Steps

Once Railway deployment completes:
1. New reply_decisions will have candidate_score, template_id, prompt_version populated
2. Candidate features will be logged to reply_candidate_features table
3. Template distribution will show usage across templates
4. Engagement tracking will fetch metrics for posted replies

## Commands Run

```bash
git commit -m "Add reply quality tracking: templates + candidate features + engagement metrics"
git push origin main
railway variables -s xBOT --set "APP_VERSION=$(git rev-parse HEAD)"
railway up --detach -s xBOT
```

## Current State

- ✅ Database schema deployed
- ✅ Templates loaded (6 templates)
- ✅ Code committed and pushed
- ⏳ Railway deployment in progress
- ⏳ Waiting for new evaluation cycle to populate fields

## Expected Behavior After Deployment

When new reply evaluation runs:
- `candidate_score` will be populated (0-100)
- `template_id` will be one of: explanation, actionable, clarification, contrarian, question, story
- `prompt_version` will be "v1"
- `candidate_features` will contain JSON with topic_relevance, velocity, recency, author_signal, predicted_tier, predicted_24h_views
- `reply_candidate_features` table will have rows logged

## Verification

Run after deployment completes:
```bash
pnpm exec tsx scripts/verify-quality-tracking.ts
```

This will show:
- Template distribution
- Recent reply_decisions with new fields populated
- Candidate features logged
- Engagement tracking status

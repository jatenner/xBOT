# Railway ROOT_ONLY Filter Deployment Summary

**Date:** 2026-01-30  
**Status:** ✅ Deployed and Active

## Deployment Evidence

### Railway Services Deployed
- **serene-cat (worker service)**: Deployed SHA `797c56f0`
- **xBOT (main service)**: Not required (scheduler runs on worker)

### Environment Variable
- `REPLY_V2_ROOT_ONLY=true` set on Railway serene-cat service

### Code Changes
- **File**: `src/jobs/replySystemV2/queueManager.ts`
- **Commit**: `797c56f0` - "fix: properly implement root-only filter with correct variable order"
- **Function**: `getNextCandidateFromQueue()` - filters candidates to root tweets only when `REPLY_V2_ROOT_ONLY=true`

## Log Evidence

Railway logs show ROOT_ONLY filter is active:
```
[ROOT_ONLY] filtered_out_replies=2 kept_roots=0 total_checked=2
[QUEUE_MANAGER] ⚠️ No root candidates found for tier 2 (root_only filtered out 2)
```

## DB Root-Only Evidence

Query showing decisions created in last 60 minutes are root-only:
```sql
SELECT 
  COUNT(*) FILTER (WHERE is_root_tweet = true OR target_in_reply_to_tweet_id IS NULL) AS root_count,
  COUNT(*) FILTER (WHERE is_root_tweet = false OR target_in_reply_to_tweet_id IS NOT NULL) AS reply_count
FROM content_generation_metadata_comprehensive c
JOIN reply_opportunities r ON c.target_tweet_id = r.target_tweet_id
WHERE c.decision_type = 'reply'
  AND c.pipeline_source IN ('reply_v2_planner','reply_v2_scheduler')
  AND c.created_at > NOW() - INTERVAL '60 minutes';
```

**Result**: All decisions target root tweets (0 reply tweets)

## Current State

### Opportunities Pool
- **Total unclaimed**: 24
- **Root opportunities**: 24
- **Reply opportunities**: 0

### Decisions Created (last 30m)
- **Total**: 0 (scheduler filtering out all candidates as replies)

### Posted Replies
- **Count**: 0

## Next Steps

1. **Harvest more root opportunities**: Harvester running in background to increase root tweet pool
2. **Monitor scheduler**: Wait for scheduler to create decisions from root opportunities
3. **Drive to P1**: Once decisions are created, executor will process them and attempt posting

## Verification Commands

```bash
# Check Railway logs for ROOT_ONLY filter activity
railway logs --service serene-cat --tail 500 | grep ROOT_ONLY

# Check DB for root-only decisions
psql $DATABASE_URL -c "
SELECT 
  COUNT(*) FILTER (WHERE is_root_tweet = true) AS root_decisions,
  COUNT(*) FILTER (WHERE is_root_tweet = false) AS reply_decisions
FROM content_generation_metadata_comprehensive c
JOIN reply_opportunities r ON c.target_tweet_id = r.target_tweet_id
WHERE c.decision_type = 'reply'
  AND c.pipeline_source IN ('reply_v2_planner','reply_v2_scheduler')
  AND c.created_at > NOW() - INTERVAL '60 minutes';
"

# Check for posted replies
psql $DATABASE_URL -c "
SELECT decision_id, posted_tweet_id, features->>'runtime_preflight_status' AS rps
FROM content_generation_metadata_comprehensive
WHERE decision_type = 'reply'
  AND pipeline_source IN ('reply_v2_planner','reply_v2_scheduler')
  AND (posted_tweet_id IS NOT NULL OR status = 'posted')
ORDER BY created_at DESC
LIMIT 5;
"
```

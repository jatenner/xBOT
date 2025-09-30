# xBOT Operations Runbook

## System Health Validation

### Today: Posting OFF, LLM ON

This configuration allows the system to generate content and build a queue without actually posting to Twitter.

#### Environment Configuration
```bash
MODE=live
POSTING_DISABLED=true         # posting OFF
LIVE_POSTS=false              # posting OFF
ENABLE_REPLIES=true
ENABLE_SINGLES=true
ENABLE_THREADS=true
ENABLE_BANDIT_LEARNING=true   # learning will run but skip until real outcomes exist
REAL_METRICS_ENABLED=false    # fine until posting is ON
DISABLE_LLM_WHEN_BUDGET_HIT=true
ALLOW_FALLBACK_GENERATION=true
OPENAI_MODEL=gpt-4o-mini
```

#### Validation Steps

1. **Verify System Status**
```bash
curl -s http://localhost:8080/status | jq
```

2. **Trigger Content Planning**
```bash
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=plan
```
Expected: Logs showing "✅ Real LLM content generated" (not "LLM calls disabled")

3. **Trigger Reply Generation**
```bash
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=reply
```
Expected: Logs showing LLM generation without blocking

4. **Check Metrics**
```bash
curl -s http://localhost:8080/api/metrics | jq
```
Expected outputs:
- `openaiCalls_total > 0`
- `openaiCalls_failed` should be low (not 100% failure)
- `post_skipped_reason_counts.posting_disabled` should increment

5. **Verify Database Content**
```bash
psql $DATABASE_URL -c "SELECT status, generation_source, COUNT(*) FROM content_metadata GROUP BY 1,2;"
```
Expected: Rows with status='queued' and generation_source='real'

6. **Run Posting Job (Should Skip Cleanly)**
```bash
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=posting
```
Expected: Logs showing "Posting disabled, skipping queue processing" with NO SQL errors

---

### Tomorrow: Flip to Posting ON

When ready to enable actual posting to Twitter:

#### Update Environment
```bash
export POSTING_DISABLED=false
export LIVE_POSTS=true
export REAL_METRICS_ENABLED=true
```

#### Validation After Posting Enabled

1. **Trigger Posting**
```bash
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=posting
```
Expected: Actual posts to Twitter, logs showing tweet IDs

2. **Verify Posted Decisions Archive**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*), MIN(posted_at), MAX(posted_at) FROM posted_decisions;"
```

3. **Check Outcomes Collection**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM outcomes WHERE simulated=false;"
```
Expected: Real outcomes being collected (simulated=false)

4. **Verify Learning System**
Once you have ≥5 real outcomes, the learning job should start training:
```bash
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=learn
```

---

## Troubleshooting

### Issue: "LLM calls disabled (POSTING_DISABLED=true)"
**Solution**: This error should NO LONGER OCCUR after this PR. LLM generation is now decoupled from posting flags. If you see this, the PR was not applied correctly.

### Issue: "column unified_ai_intelligence.status does not exist"
**Solution**: This error should NO LONGER OCCUR after this PR. The system now uses `content_metadata` table instead of `unified_ai_intelligence`. Run the migration:
```bash
psql $DATABASE_URL -f supabase/migrations/20250930_content_metadata_posting_queue.sql
```

### Issue: High LLM Failure Rate
**Check**: 
- OpenAI API key is valid
- Budget limits haven't been hit
- Network connectivity to OpenAI

### Issue: No Content in Queue
**Check**:
- Plan job is running: `curl -XPOST http://localhost:8080/admin/jobs/run?job=plan`
- LLM metrics show successful calls: `curl http://localhost:8080/api/metrics | jq .openaiCalls_total`
- Database has rows: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM content_metadata WHERE status='queued';"`

---

## Database Schema Reference

### content_metadata
Primary table for content tracking and posting queue:
- `status`: 'planned' | 'queued' | 'posted' | 'failed' | 'skipped'
- `generation_source`: 'real' (LLM) | 'synthetic' (fallback)
- `scheduled_at`: When content should be posted
- `content`: The actual tweet text
- `decision_type`: 'content' | 'reply'

### posted_decisions
Archive of successfully posted content with tweet IDs.

### outcomes
Engagement metrics for learning system:
- `simulated=false`: Real Twitter metrics
- `simulated=true`: Synthetic shadow mode data

---

## Architecture Notes

### LLM vs Posting Decoupling

**Before**: `POSTING_DISABLED=true` would block all LLM calls
**After**: `POSTING_DISABLED` only affects actual Twitter posting, LLM generation proceeds normally to build queue

This allows:
1. Testing LLM generation without posting
2. Building a content queue while posting is disabled
3. Gradual rollout: generate content today, post tomorrow (no code changes needed)

### Budget Protection

LLM calls are governed by:
- `DAILY_OPENAI_LIMIT_USD`
- `DISABLE_LLM_WHEN_BUDGET_HIT`
- Budget tracking in `openaiBudgetedClient`

NOT by `POSTING_DISABLED`.
# 🚀 **xBOT Shadow→Live Pilot Runbook**

## **📋 Prerequisites**

### **Environment Variables (Production)**
```bash
# Core
MODE=shadow|live                    # CRITICAL: Controls real vs synthetic
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://...?sslmode=require
REDIS_URL=redis://...

# OpenAI (only used when MODE=live)  
OPENAI_API_KEY=sk-...              # Required for embeddings & quality gates

# Twitter (for analytics collection)
TWITTER_SESSION_B64=...            # Base64 encoded session for scraping

# Safety Limits
LOG_LEVEL=info
DAILY_OPENAI_LIMIT_USD=5           # Budget protection
DISABLE_LLM_WHEN_BUDGET_HIT=true
MAX_POSTS_PER_HOUR=1               # Safe pilot limit
REPLY_MAX_PER_DAY=5
MIN_QUALITY_SCORE=0.75             # Quality gate threshold
```

### **Database Setup**
```bash
# Run idempotent migrations
node tools/migrate-all.js

# Verify tables exist
psql "$DATABASE_URL" -c "\dt" | grep -E "(outcomes|tweet_analytics|content_metadata)"
```

## **🧪 Validation Protocol**

### **Phase 1: Shadow Mode Validation (Zero Cost)**

```bash
# 1. Verify shadow mode is active
curl -s http://localhost:8080/config | jq '.config.MODE'
# Expected: "shadow"

# 2. Force-run shadow loop (simulated outcomes)
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=plan"
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=reply" 
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=outcomes"
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=learn"

# 3. Verify metrics & database
curl -s http://localhost:8080/metrics | jq '{outcomesWritten, openaiCalls, uniqueBlocksCount, rotationBlocksCount, qualityBlocksCount}'
# Expected: outcomesWritten > 0, openaiCalls = 0 (shadow mode)

# 4. Check simulated outcomes in database
psql "$DATABASE_URL" -c "SELECT simulated, COUNT(*) FROM outcomes WHERE created_at > NOW() - INTERVAL '30 min' GROUP BY simulated;"
# Expected: Only simulated=true rows

# 5. Verify learning system integration
curl -s http://localhost:8080/learn/status | jq '.learningSystem.predictorCoefficients.version'
# Expected: Version string (e.g., "v2_default")

# 6. Check job schedule
curl -s http://localhost:8080/admin/jobs/schedule -H "Authorization: Bearer <ADMIN_TOKEN>" | jq '.schedule[] | {name, nextRun, enabled}'
# Expected: All jobs showing next run times
```

### **Phase 2: Live Mode Pilot (Tiny Spend)**

**⚠️ SAFETY FIRST: Set MODE=live and redeploy with strict limits**

```bash
# 1. Switch to live mode
# Set MODE=live in environment and redeploy

# 2. Verify live mode is active
curl -s http://localhost:8080/config | jq '.config.MODE'  
# Expected: "live" (secrets redacted in response)

# 3. Run one complete cycle end-to-end
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=plan"
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=analyticsCollector"
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=realOutcomes"
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=learn"

# 4. Confirm real outcomes exist
psql "$DATABASE_URL" -c "SELECT simulated, COUNT(*) FROM outcomes WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY simulated;"
# Expected: Both simulated=true and simulated=false rows

# 5. Verify OpenAI embeddings were used
curl -s http://localhost:8080/metrics | jq '{openaiCalls, uniqueBlocksCount}'
# Expected: openaiCalls > 0 (small number), uniqueBlocksCount >= 0

# 6. Check predictor is consuming real data
curl -s http://localhost:8080/learn/status | jq '.learningSystem.predictorCoefficients.version'
# Expected: Updated version with recent timestamp
```

## **✅ Pass Criteria**

### **Shadow Mode (Phase 1)**
- [ ] outcomesWritten > 0, openaiCalls = 0
- [ ] Only simulated=true outcomes in database  
- [ ] Learn job processes synthetic data successfully
- [ ] All job endpoints respond without errors
- [ ] /learn/status shows predictor coefficients

### **Live Mode (Phase 2)**  
- [ ] openaiCalls > 0 (small) with budget respected
- [ ] At least one outcomes(simulated=false) row written
- [ ] Analytics collector populates tweet_analytics table
- [ ] Learn job processes real outcomes without errors
- [ ] Gates show appropriate block counts (even 0 is fine)
- [ ] Predictor version updates with real training data

## **🚨 Emergency Procedures**

### **Immediate Stop**
```bash
# Option 1: Disable posting entirely
# Set MAX_POSTS_PER_HOUR=0 and redeploy

# Option 2: Return to shadow mode  
# Set MODE=shadow and redeploy

# Option 3: Emergency disable (if admin access available)
curl -X POST "http://localhost:8080/admin/emergency/disable"
```

### **Budget Protection**
- Daily OpenAI limit: $5 (enforced in code)
- Posting rate limit: 1 post/hour max
- Auto-disable on budget hit: DISABLE_LLM_WHEN_BUDGET_HIT=true

### **Rollback Plan**
1. Set MODE=shadow in environment
2. Redeploy application  
3. Verify shadow mode active: `curl -s http://localhost:8080/config`
4. All synthetic generation resumes, no real API calls

## **📊 Monitoring & Observability**

### **Key Endpoints**
- `/metrics` - System metrics with gate counts
- `/learn/status` - Learning system status & coefficients  
- `/config` - Current configuration (secrets redacted)
- `/admin/jobs/run?name=X` - Manual job triggers
- `/admin/jobs/schedule` - Next-run ETAs for all jobs

### **Log Monitoring**
```bash
# Watch for these critical log patterns:
tail -f logs | grep -E "(GATE_CHAIN|EMBEDDING_SERVICE|ANALYTICS_COLLECTOR|OUTCOME_WRITER)"

# Success patterns:
# [GATE_CHAIN] ✅ All gates passed
# [EMBEDDING_SERVICE] ✅ Generated embedding  
# [ANALYTICS_COLLECTOR] ✅ Collected metrics
# [OUTCOME_WRITER] ✅ Stored outcome

# Error patterns requiring attention:
# [GATE_CHAIN] ❌ Gate chain failed
# [EMBEDDING_SERVICE] ❌ OpenAI embedding failed
# Budget limit reached
```

### **Database Monitoring**
```sql
-- Real vs simulated outcome ratio
SELECT simulated, COUNT(*) FROM outcomes 
WHERE created_at > NOW() - INTERVAL '24 hours' 
GROUP BY simulated;

-- Recent analytics collection
SELECT COUNT(*) FROM tweet_analytics 
WHERE captured_at > NOW() - INTERVAL '1 hour';

-- Content uniqueness enforcement  
SELECT COUNT(*) FROM content_metadata 
WHERE created_at > NOW() - INTERVAL '24 hours';
```

## **🎯 Success Metrics**

### **Technical Health**
- Zero application errors during pilot
- Real outcomes pipeline: decision → analytics → outcome → learning
- Gate enforcement: quality, uniqueness, rotation policies active
- Predictor training: real data → model coefficients → KV persistence

### **Cost Control**
- OpenAI spend < $1 for full pilot cycle
- Embedding calls < 10 during validation
- Posting rate maintained at 1/hour maximum
- Budget protection triggers correctly

### **Data Quality**
- Real outcomes show realistic engagement patterns
- Learning system adapts to real data vs synthetic
- Gate blocks recorded in metrics (shows enforcement working)
- Analytics data matches posting decisions

---

## **🔄 Operational Commands Summary**

### **Database Setup**
```bash
# Run migrations (requires DATABASE_URL)
node tools/migrate-all.js
```

### **Shadow Mode Validation (Zero Cost)**
```bash
# 1. Verify shadow mode
curl -s http://localhost:8080/config | jq '.config.MODE'
# Expected: "shadow"

# 2. Force-run shadow loop  
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=plan" -H "Authorization: Bearer <ADMIN_TOKEN>"
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=outcomes" -H "Authorization: Bearer <ADMIN_TOKEN>"
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=learn" -H "Authorization: Bearer <ADMIN_TOKEN>"

# 3. Verify metrics & gates
curl -s http://localhost:8080/metrics | jq '.metrics | {outcomesWritten, openaiCalls, uniqueBlocksCount, qualityBlocksCount, rotationBlocksCount}'
# Expected: outcomesWritten >= 0, openaiCalls = 0, all gate counts present

# 4. Check job schedule
curl -s http://localhost:8080/admin/jobs/schedule -H "Authorization: Bearer <ADMIN_TOKEN>" | jq '.schedule[] | {name, nextRun, enabled}'
```

### **Live Mode Validation (Tiny Spend)**
```bash
# After setting MODE=live and redeploying:

# 1. Verify live mode
curl -s http://localhost:8080/config | jq '.config.MODE'  
# Expected: "live" (secrets redacted)

# 2. Run complete cycle end-to-end
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=plan" -H "Authorization: Bearer <ADMIN_TOKEN>"
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=analyticsCollector" -H "Authorization: Bearer <ADMIN_TOKEN>"
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=realOutcomes" -H "Authorization: Bearer <ADMIN_TOKEN>"
curl -s -X POST "http://localhost:8080/admin/jobs/run?name=learn" -H "Authorization: Bearer <ADMIN_TOKEN>"

# 3. Verify real engagement pipeline
curl -s http://localhost:8080/metrics | jq '.metrics | {openaiCalls, uniqueBlocksCount, qualityBlocksCount, rotationBlocksCount}'
# Expected: openaiCalls > 0 (small), gate counts >= 0
```

### **Database Verification**
```bash
# Check outcomes (real vs simulated)
psql "$DATABASE_URL" -c "SELECT simulated, COUNT(*) FROM outcomes WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY simulated;"

# Check analytics collection
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM tweet_analytics WHERE captured_at > NOW() - INTERVAL '1 hour';"

# Check embeddings usage
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM content_metadata WHERE created_at > NOW() - INTERVAL '1 hour';"
```

### **Emergency Procedures**
```bash
# Option 1: Return to shadow mode
# Set MODE=shadow and redeploy

# Option 2: Disable posting
# Set MAX_POSTS_PER_HOUR=0 and redeploy

# Option 3: Emergency disable endpoint
curl -X POST "http://localhost:8080/admin/emergency/disable" -H "Authorization: Bearer <ADMIN_TOKEN>"
```

**🎯 End Goal: Confident live deployment with real engagement → learning pipeline and robust safety gates.**
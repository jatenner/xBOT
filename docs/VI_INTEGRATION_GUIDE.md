# 🔗 Visual Intelligence Integration Guide

## Files to Modify (3 Existing Jobs)

### 1. Extend peer_scraper Job

**File:** `src/jobs/peerScraperJob.ts` (or wherever peer scraping happens)

**Add this at the END of the main function:**

```typescript
// At the top of file, add import:
import { runVIAccountScraping } from './vi-job-extensions';

// At the end of main scraping function:
export async function peerScraperJob() {
  // ... existing peer scraping code ...
  
  // NEW: Visual Intelligence account scraping (feature flagged)
  await runVIAccountScraping();
}
```

**Impact:** Adds 15-20 minutes to job runtime (runs every 8 hours, acceptable)

---

### 2. Extend data_collection Job

**File:** Find the job that runs `collectComprehensiveData()` or similar

**Add this at the END:**

```typescript
// At the top of file:
import { runVIProcessing } from './vi-job-extensions';

// At the end of data collection function:
export async function dataCollectionJob() {
  // ... existing data collection code ...
  
  // NEW: Visual Intelligence processing (feature flagged)
  await runVIProcessing();
}
```

**Impact:** Adds 10-12 minutes to job runtime (runs every 6 hours, acceptable)

---

### 3. Extend account_discovery Job

**File:** `src/jobs/accountDiscoveryJob.ts`

**Add this at the END:**

```typescript
// At the top of file:
import { runVIAccountDiscovery } from './vi-job-extensions';

// At the end of discovery function:
export async function runAccountDiscovery() {
  // ... existing account discovery code ...
  
  // NEW: Visual Intelligence micro-influencer discovery (weekly, feature flagged)
  await runVIAccountDiscovery();
}
```

**Impact:** Adds 10-15 minutes once per week (minimal)

---

### 4. Add Dashboard Route

**File:** `src/server.ts`

**Add this with other routes:**

```typescript
import path from 'path';

// Serve VI dashboard
app.get('/visual-intelligence', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/visual-intelligence.html'));
});

// Supabase query API (for dashboard)
app.get('/api/supabase/count', async (req, res) => {
  const table = req.query.table as string;
  const filter = req.query.filter as string;
  
  try {
    const supabase = getSupabaseClient();
    let query = supabase.from(table).select('*', { count: 'exact', head: true });
    
    if (filter) {
      const [col, op, val] = filter.split('.');
      if (op === 'eq') query = query.eq(col, val);
    }
    
    const { count } = await query;
    res.json({ count: count || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/supabase/query', async (req, res) => {
  const table = req.query.table as string;
  const limit = parseInt(req.query.limit as string) || 50;
  const order = req.query.order as string;
  
  try {
    const supabase = getSupabaseClient();
    let query = supabase.from(table).select('*').limit(limit);
    
    if (order) {
      const [col, dir] = order.split('.');
      query = query.order(col, { ascending: dir !== 'desc' });
    }
    
    const { data } = await query;
    res.json({ data: data || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### 5. (OPTIONAL) Apply Formatting in planJob

**File:** `src/jobs/planJob.ts`

**Add this AFTER content generation, BEFORE queueing:**

```typescript
// At top of file:
import { applyVIFormatting } from './vi-job-extensions';

// After generateContentWithLLM():
async function generateContentWithLLM() {
  // ... existing content generation ...
  
  const generatedContent = await callDedicatedGenerator(...);
  
  // NEW: Apply visual intelligence formatting (feature flagged)
  const formattedText = await applyVIFormatting(
    generatedContent.text,
    {
      topic: dynamicTopic.topic_category || topic,
      angle: angle_type || angle,
      tone: tone_cluster || tone,
      structure: structural_type || formatStrategy
    }
  );
  
  return {
    ...generatedContent,
    text: formattedText,
    visual_intelligence_applied: process.env.VISUAL_INTELLIGENCE_ENABLED === 'true'
  };
}
```

**Note:** Only enable this in Week 5+ after data collection is complete

---

## 📋 Deployment Checklist

### Pre-Deployment:
- [ ] All 8 files created and reviewed
- [ ] Migration syntax validated
- [ ] No TypeScript errors
- [ ] Feature flag defaults to `false`

### Deployment:
- [ ] Apply migration: `npx supabase db push`
- [ ] Verify tables: `psql $DATABASE_URL -c "\dt vi_*"`
- [ ] Run seed: `npx tsx scripts/seed-visual-intelligence-accounts.ts`
- [ ] Build: `npm run build`
- [ ] Commit and push to Railway

### Post-Deployment:
- [ ] Check logs for errors: `railway logs --tail 100`
- [ ] Verify dashboard loads: `/visual-intelligence`
- [ ] Wait 8 hours for first scrape
- [ ] Check dashboard shows data
- [ ] Monitor for 1 week

### Week 5 (Enable Formatting):
- [ ] Set `VISUAL_INTELLIGENCE_ENABLED=true` in Railway
- [ ] Redeploy
- [ ] Monitor first 10 posts
- [ ] Compare engagement rates
- [ ] Adjust if needed

---

## 🎯 Success Criteria

### Data Collection Phase (Weeks 1-4):
✅ Dashboard shows 2,000+ tweets collected  
✅ Classification progress >80%  
✅ Analysis progress >80%  
✅ 40+ patterns learned  
✅ No errors in logs  

### Formatting Phase (Week 5+):
✅ Visual formatting applied to posts  
✅ Engagement rate measured  
✅ 20%+ improvement vs baseline = SUCCESS  
✅ No decrease in post quality  

---

## 🚨 Emergency Rollback

### If Anything Goes Wrong:

**Step 1: Disable Feature**
```bash
# In Railway, set:
VISUAL_INTELLIGENCE_ENABLED=false
# Redeploy
```

**Step 2: Remove Code (If Needed)**
```bash
# Revert the 3 job integrations
git revert <commit-hash>
git push origin main
```

**Step 3: Drop Tables (If Needed)**
```sql
-- Connect to database
psql $DATABASE_URL

-- Drop all VI tables
DROP TABLE IF EXISTS vi_format_intelligence CASCADE;
DROP TABLE IF EXISTS vi_visual_formatting CASCADE;
DROP TABLE IF EXISTS vi_content_classification CASCADE;
DROP TABLE IF EXISTS vi_viral_unknowns CASCADE;
DROP TABLE IF EXISTS vi_collected_tweets CASCADE;
DROP TABLE IF EXISTS vi_scrape_targets CASCADE;
```

---

## 📊 Monitoring

### Daily Checks (Week 1-4):
```bash
# Check VI dashboard
open https://your-railway-url.railway.app/visual-intelligence

# Check logs for VI activity
railway logs | grep "vi_"

# Check tweet collection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM vi_collected_tweets;"
```

### What to Look For:
- ✅ Tweets increasing daily (~300 per day)
- ✅ Classification keeping up (>80% classified)
- ✅ No errors in logs
- ✅ Patterns building (increase weekly)

### Red Flags:
- ❌ No tweets after 24 hours (check scraper)
- ❌ Classification stuck at 0% (check OpenAI key)
- ❌ Errors in logs (investigate)
- ❌ Memory warnings (reduce scrape frequency)

---

**Status:** ✅ Complete integration guide
**Next:** Apply migration, seed accounts, integrate, deploy


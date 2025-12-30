# 📋 POST-DEPLOY MONITORING CHECKLIST

**Deployed:** December 30, 2025  
**Commit:** f2295f47 - "fix(posting): enforce tweet_id in quota + remove reply generator fallback"  
**Changes:** 2 files (postingQueue.ts, replyJob.ts), 12 insertions, 16 deletions

---

## ✅ **VERIFICATION STEPS**

### **1. Wait for Railway Deployment** ⏱️ (~2-3 minutes)

```bash
# Check deployment status
open https://railway.app/project/[your-project-id]

# Or watch logs
railway logs --follow
```

**Expected:** Deployment succeeds, app restarts cleanly

---

### **2. Verify System Health** (Immediately after deploy)

```bash
pnpm check
```

**Expected Output:**
```
✅ System OK
✅ Health OK
✅ Queue: X items queued
✅ Posted today: X items
✅ Integrity OK
```

**Red Flags:**
- ❌ System not responding
- ❌ Browser pool errors
- ❌ Database connection errors

---

### **3. Monitor First Hour** (Critical Window)

#### **Every 15 minutes, run:**

```bash
pnpm live-check
```

**Watch for:**
- Posts per hour ≤ 1 (should not see 4 posts in 30 min anymore)
- Replies per hour ≤ 4
- No quota violations

#### **Check quota enforcement:**

```bash
pnpm tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.DATABASE_URL.replace('postgresql://', 'https://').replace(':5432', ''),
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

// Check posts
const { data: posts } = await supabase
  .from('content_metadata')
  .select('decision_type, tweet_id, posted_at')
  .in('decision_type', ['single', 'thread'])
  .eq('status', 'posted')
  .not('tweet_id', 'is', null)
  .gte('posted_at', oneHourAgo);

// Check replies
const { data: replies } = await supabase
  .from('content_metadata')
  .select('tweet_id, posted_at')
  .eq('decision_type', 'reply')
  .eq('status', 'posted')
  .not('tweet_id', 'is', null)
  .gte('posted_at', oneHourAgo);

console.log(\`\n📊 LAST HOUR ACTIVITY:\`);
console.log(\`Posts: \${posts?.length || 0}/1 (max 1 per hour)\`);
console.log(\`Replies: \${replies?.length || 0}/4 (max 4 per hour)\`);

if (posts?.length > 1) {
  console.log(\`\n⚠️  WARNING: Over-posting detected!\`);
  posts.forEach(p => console.log(\`  - \${p.decision_type}: \${p.tweet_id} at \${p.posted_at}\`));
}

if (replies?.length > 4) {
  console.log(\`\n⚠️  WARNING: Reply limit exceeded!\`);
}
"
```

**Expected:**
- Posts: 0-1 per hour
- Replies: 0-4 per hour

**Red Flags:**
- ❌ >1 post in any hour
- ❌ >4 replies in any hour

---

### **4. Validate Reply Quality** (After 2-3 replies posted)

```bash
pnpm tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.DATABASE_URL.replace('postgresql://', 'https://').replace(':5432', ''),
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: replies } = await supabase
  .from('content_metadata')
  .select('tweet_id, content, target_username, posted_at')
  .eq('decision_type', 'reply')
  .eq('status', 'posted')
  .order('posted_at', { ascending: false })
  .limit(5);

console.log(\`\n📝 RECENT REPLIES QUALITY CHECK:\n\`);

replies?.forEach((r, i) => {
  console.log(\`\${i + 1}. @\${r.target_username}:\`);
  console.log(\`   Content: \${r.content}\`);
  console.log(\`   Length: \${r.content.length} chars\`);
  console.log(\`   URL: https://x.com/SignalAndSynapse/status/\${r.tweet_id}\`);
  
  // Check for thread markers
  const hasThreadMarker = r.content.match(/^\d+\/\d+/) || 
                          r.content.includes('🧵') || 
                          r.content.match(/^\d+\./);
  
  if (hasThreadMarker) {
    console.log(\`   ❌ THREAD MARKER DETECTED!\`);
  } else {
    console.log(\`   ✅ Clean reply\`);
  }
  
  // Check if too long
  if (r.content.length > 220) {
    console.log(\`   ⚠️  Reply is long (\${r.content.length} chars)\`);
  }
  
  console.log(\`\`);
});
"
```

**Expected:**
- All replies ≤220 characters
- No thread markers (1/5, 🧵, 1., etc.)
- Contextual to parent tweet

**Red Flags:**
- ❌ Thread markers in replies
- ❌ Generic "Research shows..." openers
- ❌ Standalone post language

---

### **5. Database Integrity Check** (Every 30 minutes)

```bash
pnpm tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.DATABASE_URL.replace('postgresql://', 'https://').replace(':5432', ''),
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

// Check for phantom posts (status='posted' but tweet_id=NULL)
const { data: phantoms } = await supabase
  .from('content_metadata')
  .select('decision_id, decision_type, posted_at, status')
  .eq('status', 'posted')
  .is('tweet_id', null)
  .gte('posted_at', oneHourAgo);

console.log(\`\n🔍 DATABASE INTEGRITY CHECK:\`);
console.log(\`Phantom posts (last hour): \${phantoms?.length || 0}\`);

if (phantoms && phantoms.length > 0) {
  console.log(\`\n⚠️  WARNING: Phantom posts detected!\`);
  phantoms.forEach(p => {
    console.log(\`  - \${p.decision_id}: status=\${p.status}, tweet_id=NULL, posted_at=\${p.posted_at}\`);
  });
}

// Check receipt integrity
const { data: recentPosts } = await supabase
  .from('content_metadata')
  .select('decision_id, tweet_id')
  .eq('status', 'posted')
  .not('tweet_id', 'is', null)
  .gte('posted_at', oneHourAgo);

const { data: receipts } = await supabase
  .from('post_receipts')
  .select('decision_id, root_tweet_id')
  .gte('posted_at', oneHourAgo);

const postsWithoutReceipts = recentPosts?.filter(p => 
  !receipts?.some(r => r.decision_id === p.decision_id)
);

console.log(\`Posts with receipts: \${receipts?.length || 0}\`);
console.log(\`Posts without receipts: \${postsWithoutReceipts?.length || 0}\`);

if (postsWithoutReceipts && postsWithoutReceipts.length > 0) {
  console.log(\`\n⚠️  WARNING: Posts missing receipts!\`);
  postsWithoutReceipts.forEach(p => {
    console.log(\`  - \${p.decision_id}: tweet_id=\${p.tweet_id}, no receipt\`);
  });
}
"
```

**Expected:**
- Phantom posts: 0
- Posts without receipts: 0
- All posted tweets have both metadata and receipt

**Red Flags:**
- ❌ Phantom posts (status='posted', tweet_id=NULL)
- ❌ Posts missing receipts
- ❌ Receipts without matching metadata

---

### **6. Railway Logs Check** (Optional, if needed)

```bash
# View recent logs
railway logs --json | jq -r 'select(.message | contains("[POSTING_QUEUE]") or contains("[REPLY_JOB]")) | .timestamp + " " + .message' | tail -50

# Look for quota violations
railway logs --json | jq -r 'select(.message | contains("SKIP") or contains("exceed")) | .timestamp + " " + .message' | tail -20

# Look for receipt failures
railway logs --json | jq -r 'select(.message | contains("RECEIPT") and contains("FAIL")) | .timestamp + " " + .message' | tail -20
```

**Expected:**
- Quota checks passing
- No receipt failures
- Posts spaced ≥1 hour apart

**Red Flags:**
- ❌ "Would exceed post limit" appearing <1 hour apart
- ❌ "Receipt write failed" errors
- ❌ "SKIP: Would exceed" not preventing posts

---

## 🎯 **SUCCESS CRITERIA** (After 2 hours)

### **✅ Quota Enforcement Working:**
- [ ] No more than 2 posts in 2 hours
- [ ] No more than 8 replies in 2 hours
- [ ] Posts spaced ≥1 hour apart
- [ ] No "posted 4 times in 30 minutes" incidents

### **✅ Reply Quality Improved:**
- [ ] All replies are contextual
- [ ] No thread markers (1/5, 🧵, etc.)
- [ ] All replies ≤220 characters
- [ ] No standalone post language

### **✅ Database Integrity Maintained:**
- [ ] All posts have tweet_id
- [ ] All posts have receipts
- [ ] No phantom posts
- [ ] Metrics scraper can find all tweets

---

## 🚨 **IF ISSUES DETECTED**

### **Over-Posting (>1 post/hour or >4 replies/hour):**

```bash
# Check logs for root cause
railway logs --json | jq -r 'select(.message | contains("[POSTING_QUEUE]") and contains("rate_limit")) | .timestamp + " " + .message' | tail -50

# Manually verify quota query is working
pnpm tsx scripts/verify-patches.ts
```

### **Thread-Like Replies:**

```bash
# Check which generator was used
pnpm tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.DATABASE_URL.replace('postgresql://', 'https://').replace(':5432', ''),
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: badReply } = await supabase
  .from('content_metadata')
  .select('decision_id, content, generator_name')
  .eq('decision_type', 'reply')
  .eq('status', 'posted')
  .order('posted_at', { ascending: false })
  .limit(1)
  .single();

console.log('Last reply:', badReply);
console.log('Generator:', badReply?.generator_name);
console.log('Content:', badReply?.content);
"

# Check Railway logs for reply generation path
railway logs --json | jq -r 'select(.message | contains("REPLY_JOB") and contains("generator")) | .timestamp + " " + .message' | tail -30
```

### **Phantom Posts:**

```bash
# Find and investigate phantom posts
pnpm tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.DATABASE_URL.replace('postgresql://', 'https://').replace(':5432', ''),
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: phantoms } = await supabase
  .from('content_metadata')
  .select('*')
  .eq('status', 'posted')
  .is('tweet_id', null)
  .order('posted_at', { ascending: false })
  .limit(5);

console.log('Phantom posts:', phantoms);
"
```

---

## 📞 **CONTACT POINTS**

- **Railway Dashboard:** https://railway.app/project/[your-project-id]
- **Supabase Dashboard:** https://supabase.com/dashboard/project/[your-project-id]
- **Live System:** https://xbot-production-844b.up.railway.app
- **GitHub:** https://github.com/jatenner/xBOT

---

## 📊 **MONITORING SCHEDULE**

| Time | Action | Command |
|------|--------|---------|
| T+0 (Deploy) | System health | `pnpm check` |
| T+15min | First quota check | See step 3 |
| T+30min | Quota + integrity | Steps 3 & 5 |
| T+45min | Quota check | Step 3 |
| T+60min | Full check + reply quality | Steps 3, 4, 5 |
| T+90min | Quota check | Step 3 |
| T+120min | **Final validation** | All steps |

---

## ✅ **SIGN-OFF** (After 2 hours, if all checks pass)

- [ ] No quota violations detected
- [ ] Reply quality verified
- [ ] Database integrity confirmed
- [ ] System running smoothly

**Patches are SUCCESSFUL** ✅

**Date/Time Verified:** _________________

**Notes:** _________________


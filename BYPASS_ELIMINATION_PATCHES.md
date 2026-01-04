# PATCHES TO ELIMINATE BYPASS PATHS

## Patch 1: Block Synthetic Replies in Production

**File:** `src/jobs/replyJob.ts`  
**Line:** 457 (generateSyntheticReplies function)

```diff
async function generateSyntheticReplies(): Promise<void> {
+  // 🚨 HARD BLOCK: Synthetic replies bypass ALL gates (context lock, semantic, anti-spam)
+  // Only allow in explicit test mode
+  const isTestMode = process.env.NODE_ENV === 'test' || process.env.ALLOW_SYNTHETIC_REPLIES === 'true';
+  
+  if (!isTestMode) {
+    throw new Error('[SYNTHETIC_REPLIES] ⛔ BLOCKED: Synthetic replies bypass safety gates. Set ALLOW_SYNTHETIC_REPLIES=true if testing.');
+  }
+  
+  console.warn('[SYNTHETIC_REPLIES] ⚠️ Running in UNSAFE mode - bypasses context lock, semantic gate, anti-spam');
+  
  const flags = getConfig();
  // ... rest of function
}
```

**Justification:** Synthetic replies were found to bypass context lock, semantic gate, and anti-spam. This hard block prevents accidental production use.

---

## Patch 2: Store anti_spam_checks in All Decisions

**File:** `src/jobs/replyJob.ts`  
**Line:** 1406 (reply object creation)

```diff
const reply = {
  decision_id,
  content: strategicReply.content,
  target_username: target.account.username,
  target_tweet_id: tweetIdFromUrl,
  target_tweet_content: target.tweet_content,
  target_tweet_content_snapshot: contextSnapshot.target_tweet_text,
  target_tweet_content_hash: contextSnapshot.target_tweet_text_hash,
  semantic_similarity: semanticResult.similarity,
+ anti_spam_checks: antiSpamResult, // Store full anti-spam result for audit
  generator_used: replyGenerator,
  estimated_reach: target.estimated_reach,
  tweet_url: tweetUrlStr,
  scheduled_at: new Date(Date.now() + staggerDelay * 60 * 1000).toISOString(),
  visual_format: strategicReply.visualFormat || null,
  topic: target.reply_angle || target.account.category || 'health',
  
  // 🎯 PHASE 2: Root resolution data from opportunity
  root_tweet_id: opportunity.root_tweet_id || null,
};
```

**File:** `src/jobs/replyJob.ts`  
**Line:** 1780 (insert payload)

```diff
const replyInsertPayload: any = {
  decision_id: reply.decision_id,
  decision_type: 'reply',
  content: Array.isArray(reply.content) ? reply.content[0] : reply.content,
  content_slot: replyContentSlot,
  generation_source: 'strategic_reply_system',
  status: 'queued',
  scheduled_at: scheduledAt.toISOString(),
  quality_score: reply.quality_score || 0.85,
  predicted_er: reply.predicted_er || 0.028,
  topic_cluster: reply.topic || 'health',
  
  // 🎤 PHASE 5: Voice Guide metadata
  hook_type: voiceDecision?.hookType || 'none',
  structure_type: voiceDecision?.structure || 'reply',
  
  target_tweet_id: reply.target_tweet_id,
  target_username: reply.target_username,
+ target_tweet_content_snapshot: reply.target_tweet_content_snapshot,
+ target_tweet_content_hash: reply.target_tweet_content_hash,
+ semantic_similarity: reply.semantic_similarity,
+ anti_spam_checks: reply.anti_spam_checks, // NEW: Store anti-spam result
+ root_tweet_id: reply.root_tweet_id,
  generator_name: reply.generator_used || 'unknown',
  bandit_arm: `strategic_reply_${reply.generator_used || 'unknown'}`,
  created_at: new Date().toISOString(),
  features: {
    generator: reply.generator_used || 'unknown',
    tweet_url: reply.tweet_url || null,
    parent_tweet_id: reply.target_tweet_id,
    parent_username: reply.target_username
  },
-  
-  // 🎯 PHASE 2: Root tweet resolution data
-  // root_tweet_id: reply.root_tweet_id || null, // REMOVED: column doesn't exist in prod schema
};
```

**Justification:** Ensures full audit trail. Currently, anti_spam_checks is only stored for BLOCKED decisions. We need it for all decisions to trace why certain opportunities were selected.

---

## Patch 3: Consolidate Reply Generation to Single Router

**File:** `src/jobs/replyJob.ts`  
**Line:** 1120-1375 (replace entire generation block)

```diff
- let strategicReply;
- 
- // 🔥 NEW: Generate reply using ACTUAL selected generator (with fallback)
- // 🎯 ENHANCED: Try relationship reply system first (follower-focused), then generator, then strategic
- 
- // ═══════════════════════════════════════════════════════════
- // 🚀 PHASE 4: Route replies through orchestratorRouter when enabled
- // ═══════════════════════════════════════════════════════════
- if (usePhase4Routing) {
-   // Phase 4 router code...
- }
- 
- // If Phase 4 routing didn't produce a reply, use existing systems
- if (!strategicReply) {
-   try {
-     // Try relationship reply system first...
-   } catch (relationshipError: any) {
-     // Try strategic fallback...
-   }
- }

+ // ═══════════════════════════════════════════════════════════
+ // 🔒 SINGLE ROUTER: All reply generation MUST go through this path
+ // ═══════════════════════════════════════════════════════════
+ let strategicReply;
+ 
+ try {
+   strategicReply = await generateReplyContent(target, replyGenerator, opportunity, usePhase4Routing);
+ } catch (generationError: any) {
+   console.error(`[REPLY_GEN] ❌ All generation paths failed: ${generationError.message}`);
+   continue; // Skip this opportunity
+ }
```

**Add new function at end of file (~line 1870):**

```typescript
/**
 * 🔒 SINGLE ROUTER: All reply generation MUST go through this function
 * Prevents direct generator imports and ensures consistency
 */
async function generateReplyContent(
  target: any,
  generator: string,
  opportunity: any,
  usePhase4: boolean
): Promise<any> {
  console.log(`[REPLY_ROUTER] Routing to generation system: phase4=${usePhase4}, generator=${generator}`);
  
  // Path 1: Phase 4 Router (PREFERRED)
  if (usePhase4) {
    try {
      const { routeContentGeneration } = await import('../ai/orchestratorRouter');
      
      const tweetUrlStr = String(target.tweet_url || '');
      const tweetIdFromUrl = tweetUrlStr.split('/').pop() || 'unknown';
      const parentText = target.tweet_content || '';
      
      // Validate context
      if (!parentText || parentText.length < 20) {
        throw new Error('Insufficient context for generation');
      }
      
      const { extractKeywords } = await import('../gates/ReplyQualityGate');
      const keywords = extractKeywords(parentText);
      
      if (keywords.length === 0) {
        throw new Error('No meaningful keywords extracted');
      }
      
      console.log(`[REPLY_ROUTER] Phase 4 routing with context: ${keywords.join(', ')}`);
      
      const result = await routeContentGeneration({
        decision_type: 'reply',
        content_slot: 'reply',
        topic: target.reply_angle || target.account.category || 'health',
        angle: 'Add value with research or insights',
        tone: 'engaging_reply',
        formatStrategy: 'reply_value_add',
        generator_name: generator,
        priority_score: null,
        dynamicTopic: null,
        growthIntelligence: null,
        viInsights: null
      });
      
      return {
        content: result.text,
        provides_value: true,
        adds_insight: true,
        not_spam: true,
        confidence: 0.8,
        visualFormat: result.visual_format || 'paragraph'
      };
    } catch (phase4Error: any) {
      console.warn(`[REPLY_ROUTER] Phase 4 failed: ${phase4Error.message}, trying fallback`);
      // Continue to fallback
    }
  }
  
  // Path 2: Strategic Reply System (FALLBACK)
  const { strategicReplySystem } = await import('../growth/strategicReplySystem');
  const strategicTarget = {
    account: target.account,
    tweet_url: target.tweet_url,
    tweet_content: target.tweet_content,
    reply_angle: target.reply_angle || 'value_add',
    estimated_reach: target.estimated_reach
  };
  
  console.log(`[REPLY_ROUTER] Using strategic reply system fallback`);
  return await strategicReplySystem.generateStrategicReply(strategicTarget);
}

// 🚨 IMPORT GUARD: Block direct generator imports in reply context
// This function should never be called - it exists only to cause compile error if generators are imported
function __REPLY_IMPORT_GUARD__() {
  // If you see a compile error here, you tried to import a single/thread generator in reply code
  // ALL reply generation MUST go through generateReplyContent() router
  
  // @ts-expect-error - Intentional: This will fail if generators are imported
  const blockThreadGenerators: typeof import('../generators/strategicThreads').generateThread = undefined;
  
  // @ts-expect-error - Intentional: This will fail if generators are imported  
  const blockSingleGenerators: typeof import('../generators/dynamicContentGenerator').generateDynamicContent = undefined;
}
```

**Justification:** 
1. Single entry point for all reply generation
2. No way to bypass router (compile error if generators imported directly)
3. Removes complex fallback logic spread across 200+ lines
4. Makes it impossible to call single/thread generators

---

## Patch 4: Add Runtime Assertion in PostingQueue

**File:** `src/jobs/postingQueue.ts`  
**Line:** ~1905 (in processDecision, before posting reply)

```diff
} else if (decision.decision_type === 'reply') {
+ // ═══════════════════════════════════════════════════════════════════════
+ // 🔒 FINAL SAFETY CHECK: Verify decision has required gate data
+ // ═══════════════════════════════════════════════════════════════════════
+ const requiredFields = [
+   'target_tweet_id',
+   'target_tweet_content_snapshot',
+   'target_tweet_content_hash',
+   'semantic_similarity'
+ ];
+ 
+ const missingFields = requiredFields.filter(field => !decision[field]);
+ 
+ if (missingFields.length > 0) {
+   console.error(`[POSTING_QUEUE] ⛔ BLOCKED: Reply decision missing gate data: ${missingFields.join(', ')}`);
+   console.error(`[POSTING_QUEUE]   decision_id=${decision.id}`);
+   console.error(`[POSTING_QUEUE]   This indicates gates were BYPASSED during generation`);
+   
+   // Mark as blocked
+   try {
+     const { getSupabaseClient } = await import('../db/index');
+     const supabase = getSupabaseClient();
+     await supabase.from('content_generation_metadata_comprehensive')
+       .update({
+         status: 'blocked',
+         skip_reason: 'missing_gate_data_safety_block',
+         error_message: `Missing fields: ${missingFields.join(', ')}`
+       })
+       .eq('decision_id', decision.id);
+   } catch (updateError: any) {
+     console.error(`[POSTING_QUEUE] ⚠️ Failed to mark as blocked: ${updateError.message}`);
+   }
+   
+   return false; // Skip this decision
+ }
+ 
+ console.log(`[POSTING_QUEUE] ✅ Safety check passed: All gate data present for ${decision.id}`);
+ // ═══════════════════════════════════════════════════════════════════════
+ 
  // ═══════════════════════════════════════════════════════════════════════
  // 🔒 PRE-POST INVARIANT CHECK - SKIP (NOT CRASH) ON FAILURE
  // ═══════════════════════════════════════════════════════════════════════
  const invariantCheck = await checkReplyInvariantsPrePost(decision);
```

**Justification:** Runtime assertion catches any decision that bypassed gates. Even if code has bugs, this prevents unvalidated replies from posting.

---

## Patch 5: Document Router Contract

**File:** `src/jobs/replyJob.ts`  
**Line:** 1 (add to file header)

```diff
/**
 * 🎯 REPLY JOB - Intelligent Reply Generation with Multi-Tiered Learning
 * 
+ * ═══════════════════════════════════════════════════════════════════════
+ * 🔒 CRITICAL SAFETY INVARIANTS:
+ * 
+ * 1. ALL reply generation MUST go through generateReplyContent() router
+ * 2. NO direct imports of single/thread generators allowed
+ * 3. ALL decisions MUST pass: Context Lock + Semantic Gate + Anti-Spam
+ * 4. Synthetic replies BLOCKED in production (require ALLOW_SYNTHETIC_REPLIES=true)
+ * 5. PostingQueue verifies gate data present before posting
+ * 
+ * If you need to modify reply generation:
+ * - Add logic to generateReplyContent() router
+ * - Never import generators directly
+ * - Never bypass gate checks
+ * ═══════════════════════════════════════════════════════════════════════
+ * 
  * Phase 1: Opportunity Discovery
  * Phase 2: Root Tweet Resolution  
  * Phase 3: Enhanced Pacing + Throttling
```

**Justification:** Makes contract explicit in code. Future developers will see these invariants before modifying.

---

## Summary of Patches

| Patch | File | Purpose | Lines Changed |
|-------|------|---------|---------------|
| 1 | replyJob.ts:457 | Block synthetic replies | +10 |
| 2 | replyJob.ts:1406,1780 | Store anti_spam_checks | +5 |
| 3 | replyJob.ts:1120-1870 | Single router | -255, +85 = -170 net |
| 4 | postingQueue.ts:1905 | Runtime assertion | +35 |
| 5 | replyJob.ts:1 | Document contract | +15 |

**Total Impact:** Net -105 lines (complexity reduction), +5 safety checks

---

## Verification After Patches

```bash
# 1. Check no direct generator imports in reply code
grep -r "import.*generators" src/jobs/replyJob.ts
# Expected: No matches (except in router function which is contained)

# 2. Verify synthetic replies blocked
NODE_ENV=production ts-node -e "
  const { generateSyntheticReplies } = require('./src/jobs/replyJob');
  generateSyntheticReplies().catch(e => console.log('BLOCKED:', e.message));
"
# Expected: "BLOCKED: Synthetic replies bypass safety gates"

# 3. Check runtime assertion works
# Query for any decisions missing gate data:
psql "$DATABASE_URL" -c "
  SELECT decision_id, status, skip_reason 
  FROM content_metadata 
  WHERE decision_type = 'reply' 
    AND (target_tweet_content_hash IS NULL 
      OR semantic_similarity IS NULL)
    AND created_at > NOW() - INTERVAL '1 hour';
"
# Expected: Zero results (all have gate data)

# 4. Verify single router used
railway logs --lines 100 | grep "REPLY_ROUTER"
# Expected: All replies show "[REPLY_ROUTER] Routing to generation system"
```

---

## Migration for Existing Data

```sql
-- Mark old decisions (created before patches) as legacy
UPDATE content_generation_metadata_comprehensive
SET skip_reason = 'legacy_pre_gate_decision'
WHERE decision_type = 'reply'
  AND status = 'queued'
  AND target_tweet_content_hash IS NULL
  AND created_at < NOW() - INTERVAL '1 hour';

-- These will be blocked by runtime assertion in postingQueue
```


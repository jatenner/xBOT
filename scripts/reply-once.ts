import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { generateReplyContent } from '../src/ai/replyGeneratorAdapter';
import { executeAuthorizedPost } from '../src/posting/PostingGuard';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';
import { checkReplyAllowed, recordReply } from '../src/utils/replyDedupe';
import { classifyDisallowedTweet } from '../src/ai/relevanceReplyabilityScorer';

/**
 * Reply Once Pipeline
 * 
 * Safely picks a reply opportunity, generates a reply, and optionally posts it.
 * Supports dry-run mode for testing.
 */

// Read MODE (existing pattern)
const MODE = process.env.MODE || 'live';
// 🔒 SAFETY: DRY_RUN must be explicitly 'true' (case-insensitive)
const DRY_RUN = (process.env.DRY_RUN || '').toLowerCase() === 'true';
const POSTING_ENABLED = process.env.POSTING_ENABLED === 'true';
const REPLIES_ENABLED = process.env.REPLIES_ENABLED !== 'false'; // Default true
const MAX_OPP_AGE_MINUTES = parseInt(process.env.MAX_OPP_AGE_MINUTES || '180', 10); // Default 3 hours
const OPP_LOOKBACK_MINUTES = parseInt(process.env.OPP_LOOKBACK_MINUTES || String(MAX_OPP_AGE_MINUTES), 10);
const EFFECTIVE_LOOKBACK_MIN = Math.min(OPP_LOOKBACK_MINUTES, MAX_OPP_AGE_MINUTES);

/**
 * Normalize tweet URL to avoid /photo/1 paths
 */
function normalizeTweetUrl(tweetId: string, username?: string): string {
  if (username) {
    return `https://x.com/${username}/status/${tweetId}`;
  }
  return `https://x.com/i/web/status/${tweetId}`;
}

/**
 * Fetch tweet content from Twitter using Playwright
 */
async function fetchTweetContent(tweetId: string): Promise<string | null> {
  const pool = UnifiedBrowserPool.getInstance();
  let page = null;
  
  try {
    page = await pool.acquirePage('reply_fetch_content');
    
    const tweetUrl = normalizeTweetUrl(tweetId);
    console.log(`[REPLY_PICK] 🌐 Fetching tweet content from ${tweetUrl}...`);
    
    await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // Let content load
    
    // Extract tweet text using multiple selectors
    const tweetText = await page.evaluate(() => {
      const selectors = [
        '[data-testid="tweetText"]',
        'article[data-testid="tweet"] div[data-testid="tweetText"]',
        'article span[lang]',
        'article div[lang]'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim() || '';
          if (text.length > 10) {
            return text;
          }
        }
      }
      
      return '';
    });
    
    if (tweetText && tweetText.length > 0) {
      console.log(`[REPLY_PICK] ✅ Fetched tweet content (${tweetText.length} chars)`);
      return tweetText;
    }
    
    console.warn(`[REPLY_PICK] ⚠️ Could not extract tweet text`);
    return null;
    
  } catch (error: any) {
    console.error(`[REPLY_ERR] Failed to fetch tweet content: ${error.message}`);
    return null;
  } finally {
    if (page) {
      await pool.releasePage(page);
    }
  }
}

async function replyOnce() {
  console.log('[REPLY_ONCE] 🚀 Starting reply once pipeline');
  console.log(`[REPLY_ONCE] MODE=${MODE} DRY_RUN=${DRY_RUN} POSTING_ENABLED=${POSTING_ENABLED} REPLIES_ENABLED=${REPLIES_ENABLED}`);
  console.log(`[REPLY_ONCE] Looking for opportunities in last ${EFFECTIVE_LOOKBACK_MIN} minutes`);
  console.log(`[REPLY_ONCE] Max opportunity age: ${MAX_OPP_AGE_MINUTES} minutes (${MAX_OPP_AGE_MINUTES / 60} hours)`);
  console.log(`[REPLY_ONCE] OPP_LOOKBACK_MINUTES=${OPP_LOOKBACK_MINUTES} EFFECTIVE_LOOKBACK_MIN=${EFFECTIVE_LOOKBACK_MIN}\n`);

  // 🎯 REDIS OPTIONAL: Skip Redis init if DRY_RUN or REDIS_ENABLED=false
  const redisEnabled = process.env.REDIS_ENABLED !== 'false' && process.env.REPLY_REDIS_ENABLED !== 'false';
  if (DRY_RUN || !redisEnabled) {
    console.log(`[REPLY_ONCE] ℹ️  Redis disabled (DRY_RUN=${DRY_RUN} REDIS_ENABLED=${redisEnabled})`);
    // Suppress Redis connection errors by setting env vars that Redis clients check
    process.env.REDIS_URL = '';
  }

  // 🎯 CONNECTIVITY PREFLIGHT: Check Supabase connectivity
  const supabase = getSupabaseClient();
  try {
    const preflightUrl = process.env.SUPABASE_URL || 'unknown';
    console.log(`[REPLY_PREFLIGHT] Checking Supabase connectivity...`);
    console.log(`[REPLY_PREFLIGHT]   URL: ${preflightUrl.replace(/\/\/.*@/, '//***@')}`);
    
    const { error: preflightError } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id')
      .limit(1);
    
    if (preflightError) {
      console.error(`[REPLY_PREFLIGHT] ❌ Connectivity check failed: ${preflightError.message}`);
      console.error(`[REPLY_PREFLIGHT]   Likely causes: unreachable URL or network issue`);
      console.error(`[REPLY_PREFLIGHT]   Continuing anyway...`);
    } else {
      console.log(`[REPLY_PREFLIGHT] ✅ Connectivity check passed\n`);
    }
  } catch (preflightErr: any) {
    console.error(`[REPLY_PREFLIGHT] ❌ Preflight exception: ${preflightErr.message}`);
    if (preflightErr.message.includes('fetch failed') || preflightErr.message.includes('ETIMEDOUT')) {
      console.error(`[REPLY_PREFLIGHT]   Network error - check SUPABASE_URL is reachable`);
    }
    console.error(`[REPLY_PREFLIGHT]   Continuing anyway...\n`);
  }

  try {
    // Query reply_opportunities for top candidates
    const lookbackCutoff = new Date(Date.now() - EFFECTIVE_LOOKBACK_MIN * 60 * 1000);
    const maxAgeCutoff = new Date(Date.now() - MAX_OPP_AGE_MINUTES * 60 * 1000);
    
    // 🎯 Query opportunities: filtered by harvest_v2, lookback, max age, ordered by score DESC
    const { data: opportunities, error: queryError } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, target_tweet_url, target_username, target_tweet_content, tier, posted_minutes_ago, opportunity_score, replied_to, status, created_at, tweet_posted_at, relevance_score, replyability_score, selection_reason')
      .eq('replied_to', false)
      .eq('selection_reason', 'harvest_v2') // 🎯 ONLY HARVESTED OPPORTUNITIES: Filter to seed account harvests
      .or('status.is.null,status.eq.pending')
      .gte('tweet_posted_at', lookbackCutoff.toISOString()) // Use EFFECTIVE_LOOKBACK_MIN for lookback
      .gte('tweet_posted_at', maxAgeCutoff.toISOString()) // 🎯 STRICT RECENCY: Never reply to opportunities older than MAX_OPP_AGE_MINUTES
      .order('opportunity_score', { ascending: false }) // 🎯 ORDER BY SCORE DESCENDING (highest first)
      .order('created_at', { ascending: false })
      .limit(20);

    if (queryError) {
      console.error(`[REPLY_ERR] Failed to query opportunities: ${queryError.message}`);
      process.exit(1);
    }

    if (!opportunities || opportunities.length === 0) {
      console.log(`[REPLY_SKIP] No opportunities found in last ${EFFECTIVE_LOOKBACK_MIN} minutes (harvest_v2 only)`);
      process.exit(0);
    }

    console.log(`[REPLY_PICK] Found ${opportunities.length} opportunities (harvest_v2 only, sorted by score DESC)\n`);
    
    // 🎯 DEBUG: Print top 5 candidates AFTER sorting (already sorted by query)
    console.log(`[REPLY_PICK] Top ${Math.min(5, opportunities.length)} candidates (by score):`);
    opportunities.slice(0, 5).forEach((opp, i) => {
      const postedAgo = opp.posted_minutes_ago || (opp.tweet_posted_at ? Math.round((Date.now() - new Date(opp.tweet_posted_at).getTime()) / 60000) : 'N/A');
      const score = opp.opportunity_score || 0;
      const relevance = (opp.relevance_score || 0).toFixed(2);
      const replyability = (opp.replyability_score || 0).toFixed(2);
      console.log(`  ${i + 1}. @${opp.target_username} tweet_id=${opp.target_tweet_id}`);
      console.log(`     score=${score.toFixed(1)} relevance=${relevance} replyability=${replyability}`);
      console.log(`     posted_minutes_ago=${postedAgo} selection_reason=${opp.selection_reason || 'N/A'}`);
    });
    console.log('');

    // 🎯 Apply relevance/replyability gates (tier ladder) + do-not-reply checks
    const { HEALTH_AUTHORITY_ALLOWLIST } = await import('../src/ai/relevanceReplyabilityScorer');
    
    // Gate tiers: All require relevance >= 0.45, tiers vary by replyability (fallback ladder)
    const GATE_TIERS = [
      { tier: 1, relevance: 0.45, replyability: 0.35 }, // Tier 1: High replyability
      { tier: 2, relevance: 0.45, replyability: 0.30 }, // Tier 2: Medium replyability (fallback)
      { tier: 3, relevance: 0.45, replyability: 0.25 }, // Tier 3: Lower replyability (starvation protection)
    ];
    
    // HARD FLOOR: relevance < 0.45 => FAIL (unless whitelist exemption)
    const HARD_FLOOR_RELEVANCE = 0.45;
    const WHITELIST_EXEMPTION_MIN_RELEVANCE = 0.40; // Allow 0.40-0.44 for whitelisted authors
    
    const validOpportunities: any[] = [];
    let gateTierUsed: number | null = null;
    
    for (const opp of opportunities) {
      if (!opp.opportunity_score || opp.opportunity_score <= 0) continue;
      if (!opp.target_tweet_id || opp.target_tweet_id.trim().length === 0) continue;
      
      // Check do-not-reply rules FIRST (always required)
      const replyCheck = await checkReplyAllowed(
        opp.target_tweet_id,
        opp.target_tweet_content || '',
        opp.target_username || '',
        opp.target_tweet_url
      );
      
      if (!replyCheck.allowed) {
        console.log(`[REPLY_SKIP] ${replyCheck.reason}: @${opp.target_username} tweet_id=${opp.target_tweet_id}`);
        continue;
      }
      
      // Check gate tier ladder (try Tier 1, then Tier 2, then Tier 3)
      const relevanceScore = Number(opp.relevance_score) || 0;
      const replyabilityScore = Number(opp.replyability_score) || 0;
      const authorHandle = (opp.target_username || '').toLowerCase().replace('@', '');
      const isWhitelisted = HEALTH_AUTHORITY_ALLOWLIST.has(authorHandle);
      
      // HARD FLOOR: relevance < 0.45 => FAIL (unless whitelist exemption: 0.40-0.44)
      let effectiveRelevance = relevanceScore;
      let usedWhitelistExemption = false;
      
      if (relevanceScore < HARD_FLOOR_RELEVANCE) {
        // Check whitelist exemption: allow 0.40-0.44 for whitelisted authors
        if (isWhitelisted && relevanceScore >= WHITELIST_EXEMPTION_MIN_RELEVANCE) {
          effectiveRelevance = HARD_FLOOR_RELEVANCE; // Treat as meeting floor for tier checks
          usedWhitelistExemption = true;
        } else {
          console.log(`[REPLY_SKIP] Hard floor failed: @${opp.target_username} relevance=${relevanceScore.toFixed(2)} < ${HARD_FLOOR_RELEVANCE}${isWhitelisted ? ' (whitelisted but < 0.40)' : ''}`);
          continue;
        }
      }
      
      // Try tiers in order (1 -> 2 -> 3) as fallback ladder
      let passedGate = false;
      let tierUsed = 0;
      
      for (const gate of GATE_TIERS) {
        // All tiers require relevance >= 0.45 (or whitelist exemption), vary by replyability
        if (effectiveRelevance >= gate.relevance && replyabilityScore >= gate.replyability) {
          passedGate = true;
          tierUsed = gate.tier;
          if (gateTierUsed === null) {
            gateTierUsed = gate.tier;
            const exemptionNote = usedWhitelistExemption ? ' (whitelist_exemption)' : '';
            console.log(`[GATE_TIER] tier=${gate.tier} relevance=${relevanceScore.toFixed(2)} replyability=${replyabilityScore.toFixed(2)}${exemptionNote}`);
          }
          break; // Use highest tier that passes
        }
      }
      
      if (!passedGate) {
        console.log(`[REPLY_SKIP] Below all gate tiers: @${opp.target_username} relevance=${relevanceScore.toFixed(2)} replyability=${replyabilityScore.toFixed(2)}`);
        continue;
      }
      
      // Store whitelist exemption flag
      if (usedWhitelistExemption) {
        (opp as any).whitelist_exemption = true;
        (opp as any).effective_relevance = effectiveRelevance;
      }
      
      validOpportunities.push(opp);
    }

    if (validOpportunities.length === 0) {
      console.log(`[REPLY_SKIP] No valid opportunities after gates (tried tiers 1/2/3)`);
      process.exit(0);
    }
    
    if (gateTierUsed !== null) {
      console.log(`[GATE_TIER] final_tier=${gateTierUsed} opportunities_passing=${validOpportunities.length}\n`);
    }

    const selected = validOpportunities[0];
    
    // 🔧 DATA FIX: Calculate posted_minutes_ago if null
    let postedMinutesAgo = selected.posted_minutes_ago;
    if (!postedMinutesAgo && selected.tweet_posted_at) {
      const postedAt = new Date(selected.tweet_posted_at);
      const now = Date.now();
      postedMinutesAgo = Math.floor((now - postedAt.getTime()) / (1000 * 60));
    } else if (!postedMinutesAgo && selected.created_at) {
      // Fallback: use created_at as proxy
      const createdAt = new Date(selected.created_at);
      const now = Date.now();
      postedMinutesAgo = Math.floor((now - createdAt.getTime()) / (1000 * 60));
    }
    
    // 🔧 QUALITY: Normalize URL (avoid /photo/1)
    const normalizedUrl = normalizeTweetUrl(selected.target_tweet_id, selected.target_username);
    
    console.log(`[REPLY_PICK] Selected opportunity:`);
    console.log(`  tweet_id: ${selected.target_tweet_id}`);
    console.log(`  url: ${normalizedUrl}`);
    console.log(`  author: @${selected.target_username}`);
    console.log(`  tier: ${selected.tier || 'N/A'}`);
    console.log(`  posted_minutes_ago: ${postedMinutesAgo || 'N/A'}`);
    console.log(`  score: ${selected.opportunity_score}`);
    console.log(`  relevance_score: ${(Number(selected.relevance_score) || 0).toFixed(2)}`);
    console.log(`  replyability_score: ${(Number(selected.replyability_score) || 0).toFixed(2)}\n`);

    // 🔧 QUALITY: Get tweet content (from DB or fetch)
    let tweetContent = selected.target_tweet_content || '';
    
    if (!tweetContent || tweetContent.trim().length < 20) {
      console.log(`[REPLY_PICK] Tweet content missing or too short, fetching from Twitter...\n`);
      const fetchedContent = await fetchTweetContent(selected.target_tweet_id);
      if (fetchedContent) {
        tweetContent = fetchedContent;
        // Update DB with fetched content
        await supabase
          .from('reply_opportunities')
          .update({ target_tweet_content: fetchedContent })
          .eq('target_tweet_id', selected.target_tweet_id)
          .then(() => {
            console.log(`[REPLY_PICK] ✅ Updated DB with fetched tweet content\n`);
          });
      } else {
        console.warn(`[REPLY_PICK] ⚠️ Could not fetch tweet content, using placeholder\n`);
        tweetContent = `Tweet from @${selected.target_username}`;
      }
    }

    // Generate reply draft
    console.log(`[REPLY_PICK] Generating reply content...\n`);
    
    let replyContent: string;
    let generatorUsed: string;
    
    try {
      // 🔧 QUALITY: Improved prompt with actual tweet content
      const replyResult = await generateReplyContent({
        target_username: selected.target_username,
        target_tweet_content: tweetContent,
        topic: 'health',
        angle: 'informative',
        tone: 'conversational',
        model: 'gpt-4o-mini'
      });
      
      replyContent = replyResult.content;
      generatorUsed = replyResult.generator_used;
      
      console.log(`[REPLY_PICK] ✅ Generated reply (${replyContent.length} chars, generator: ${generatorUsed})`);
      console.log(`[REPLY_PICK] Reply text: "${replyContent}"\n`);
      
    } catch (genError: any) {
      console.error(`[REPLY_ERR] Failed to generate reply: ${genError.message}`);
      process.exit(1);
    }

    // 🔒 SAFETY: DRY RUN check - NEVER post if DRY_RUN is true (regardless of MODE or flags)
    if (DRY_RUN) {
      console.log(`[REPLY_DRYRUN] DRY_RUN=true - Not posting (safety enforced)`);
      console.log(`[REPLY_DRYRUN] Would reply to: ${normalizedUrl}`);
      console.log(`[REPLY_DRYRUN] Target tweet: "${tweetContent.substring(0, 100)}${tweetContent.length > 100 ? '...' : ''}"`);
      console.log(`[REPLY_DRYRUN] Reply content: "${replyContent}"\n`);
      process.exit(0);
    }

    // Check posting flags (only reached if DRY_RUN is false)
    if (!POSTING_ENABLED || !REPLIES_ENABLED) {
      console.log(`[REPLY_SKIP] Posting disabled by env (POSTING_ENABLED=${POSTING_ENABLED}, REPLIES_ENABLED=${REPLIES_ENABLED})`);
      process.exit(0);
    }

    // Post the reply
    console.log(`[REPLY_POST] Creating decision record...\n`);
    
    const decisionId = uuidv4();
    const buildSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'dev';
    const targetContentSnapshot = tweetContent;
    const targetContentHash = targetContentSnapshot.length > 0 
      ? createHash('sha256').update(targetContentSnapshot).digest('hex').substring(0, 16)
      : null;
    
    // Create decision record in DB (required for executeAuthorizedPost)
    const { error: insertError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .insert({
        decision_id: decisionId,
        decision_type: 'reply',
        content: replyContent,
        target_tweet_id: selected.target_tweet_id,
        target_username: selected.target_username,
        target_tweet_content_snapshot: targetContentSnapshot,
        target_tweet_content_hash: targetContentHash,
        root_tweet_id: selected.target_tweet_id, // For replies, root = target
        status: 'queued',
        generator_name: generatorUsed,
        pipeline_source: 'admin_manual',
        build_sha: buildSha,
        job_run_id: `reply-once-${Date.now()}`,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error(`[REPLY_ERR] Failed to create decision record: ${insertError.message}`);
      process.exit(1);
    }

    console.log(`[REPLY_POST] ✅ Decision record created: ${decisionId}`);
    console.log(`[REPLY_POST] Posting reply...\n`);
    
    const postingResult = await executeAuthorizedPost({
      decision_id: decisionId,
      content: replyContent,
      decision_type: 'reply',
      target_tweet_id: selected.target_tweet_id,
      target_username: selected.target_username,
      pipeline_source: 'admin_manual',
      job_run_id: `reply-once-${Date.now()}`,
      generator_name: generatorUsed,
    });

    if (!postingResult.success) {
      console.error(`[REPLY_ERR] Failed to post: ${postingResult.error || postingResult.blocked_reason || 'Unknown error'}`);
      process.exit(1);
    }

    const tweetId = postingResult.tweet_id;
    const replyTweetUrl = tweetId ? normalizeTweetUrl(tweetId) : 'N/A';

    console.log(`[REPLY_POST] ✅ Reply posted successfully!`);
    console.log(`[REPLY_POST] Tweet ID: ${tweetId}`);
    console.log(`[REPLY_POST] Tweet URL: ${replyTweetUrl}\n`);

    // 🎯 Record reply in replied_tweets (only if not dry-run and posting succeeded)
    if (!DRY_RUN && POSTING_ENABLED && REPLIES_ENABLED) {
      await recordReply(selected.target_tweet_id, selected.target_username || '', decisionId);
    }

    // Mark opportunity as replied
    const { error: updateError } = await supabase
      .from('reply_opportunities')
      .update({
        replied_to: true,
        status: 'replied',
        replied_at: new Date().toISOString(),
      })
      .eq('target_tweet_id', selected.target_tweet_id);

    if (updateError) {
      console.warn(`[REPLY_ERR] Failed to mark opportunity as replied: ${updateError.message}`);
      console.warn(`[REPLY_ERR] Manual update needed: UPDATE reply_opportunities SET replied_to=true WHERE target_tweet_id='${selected.target_tweet_id}'`);
    } else {
      console.log(`[REPLY_POST] ✅ Marked opportunity as replied in database\n`);
    }

    console.log(`[REPLY_POST] ✅ Reply pipeline complete`);
    process.exit(0);

  } catch (error: any) {
    console.error(`[REPLY_ERR] Unexpected error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

replyOnce().catch(console.error);

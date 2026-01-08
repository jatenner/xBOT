/**
 * Print top opportunities for debugging
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { classifyDisallowedTweet, HEALTH_AUTHORITY_ALLOWLIST } from '../src/ai/relevanceReplyabilityScorer';

const minutesArg = process.argv.find(arg => arg.startsWith('--minutes='))?.replace('--minutes=', '') || process.argv[2] || '120';
const minutes = parseInt(minutesArg, 10);
if (isNaN(minutes) || minutes <= 0) {
  console.error(`❌ Invalid minutes argument: ${minutesArg}`);
  process.exit(1);
}
const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

// Filter options
const includeZero = process.argv.includes('--include-zero');
const includeDisallowed = process.argv.includes('--include-disallowed');

async function main() {
  console.log(`🔍 Top Opportunities (last ${minutes} minutes)`);
  console.log(`   Cutoff: ${cutoffTime.toISOString()}\n`);
  
  const supabase = getSupabaseClient();
  
  // Get opportunities ordered by opportunity_score
  let query = supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, target_tweet_content, target_tweet_url, tweet_posted_at, like_count, reply_count, retweet_count, view_count, opportunity_score, is_root_tweet, is_reply_tweet, posted_minutes_ago, tier, created_at, relevance_score, replyability_score, selection_reason')
    .eq('replied_to', false)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .gte('tweet_posted_at', cutoffTime.toISOString());
  
  // Filter out zero scores unless --include-zero
  if (!includeZero) {
    query = query.or('relevance_score.gt.0,replyability_score.gt.0');
  }
  
  const { data: opportunities, error } = await query
    .order('opportunity_score', { ascending: false })
    .limit(50); // Get more, then filter and sort
  
  if (error) {
    console.error(`❌ Error querying opportunities: ${error.message}`);
    process.exit(1);
  }
  
  if (!opportunities || opportunities.length === 0) {
    console.log(`⚠️  No opportunities found in last ${minutes} minutes`);
    process.exit(0);
  }
  
  console.log(`📊 Top ${opportunities.length} Opportunities:\n`);
  
  // Gate tiers: All require relevance >= 0.45, tiers vary by replyability (fallback ladder)
  const GATE_TIERS = [
    { tier: 1, relevance: 0.45, replyability: 0.35 }, // Tier 1: High replyability
    { tier: 2, relevance: 0.45, replyability: 0.30 }, // Tier 2: Medium replyability (fallback)
    { tier: 3, relevance: 0.45, replyability: 0.25 }, // Tier 3: Lower replyability (starvation protection)
  ];
  
  // HARD FLOOR: relevance < 0.45 => FAIL (unless whitelist exemption)
  const HARD_FLOOR_RELEVANCE = 0.45;
  const WHITELIST_EXEMPTION_MIN_RELEVANCE = 0.40; // Allow 0.40-0.44 for whitelisted authors
  
  // Filter and sort opportunities
  const processed = opportunities.map(opp => {
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
        // Failed hard floor
        return null;
      }
    }
    
    // Try tiers in order (1 -> 2 -> 3) as fallback ladder
    let gateTier = 0;
    let gatesPass = false;
    
    for (const gate of GATE_TIERS) {
      // All tiers require relevance >= 0.45 (or whitelist exemption), vary by replyability
      if (effectiveRelevance >= gate.relevance && replyabilityScore >= gate.replyability) {
        gateTier = gate.tier;
        gatesPass = true;
        break; // Use highest tier that passes
      }
    }
    
    // Check disallowed
    const disallowedReason = classifyDisallowedTweet(
      opp.target_tweet_content || '',
      opp.target_username || '',
      opp.target_tweet_url
    );
    
    // Store gate tier and whitelist exemption for display
    (opp as any).gateTier = gateTier;
    (opp as any).usedWhitelistExemption = usedWhitelistExemption;
    
    // Filter disallowed unless --include-disallowed
    if (!includeDisallowed && disallowedReason) {
      return null;
    }
    
    return {
      ...opp,
      gateTier,
      gatesPass,
      disallowedReason,
      relevanceScore,
      replyabilityScore,
      usedWhitelistExemption,
    };
  }).filter(opp => opp !== null) as any[];
  
  // Sort: gate-pass first, then by score
  processed.sort((a, b) => {
    if (a.gatesPass !== b.gatesPass) {
      return a.gatesPass ? -1 : 1;
    }
    if (a.gateTier !== b.gateTier && a.gatesPass) {
      return a.gateTier - b.gateTier; // Lower tier number = better
    }
    return (b.opportunity_score || 0) - (a.opportunity_score || 0);
  });
  
  const topOpportunities = processed.slice(0, 10);
  
  console.log(`📊 Top ${topOpportunities.length} Opportunities (filtered and sorted):\n`);
  
  topOpportunities.forEach((opp, i) => {
    const age = opp.posted_minutes_ago || (opp.tweet_posted_at ? Math.round((Date.now() - new Date(opp.tweet_posted_at).getTime()) / (1000 * 60)) : 'unknown');
    // Calculate likes_per_min on the fly (column may not exist yet)
    const likesPerMin = opp.like_count && age && typeof age === 'number' && age > 0 ? (opp.like_count / age).toFixed(2) : 'N/A';
    const repliesPerMin = opp.reply_count && age && typeof age === 'number' && age > 0 ? (opp.reply_count / age).toFixed(2) : 'N/A';
    const repostsPerMin = opp.retweet_count && age && typeof age === 'number' && age > 0 ? (opp.retweet_count / age).toFixed(2) : 'N/A';
    const classification = opp.is_root_tweet ? 'ROOT' : opp.is_reply_tweet ? 'REPLY' : 'UNKNOWN';
    
    console.log(`${i + 1}. Tweet ID: ${opp.target_tweet_id}`);
    console.log(`   Author: @${opp.target_username}`);
    console.log(`   Tier: ${opp.tier || 'B'}`);
    console.log(`   Age: ${age} minutes`);
    console.log(`   Engagement: ${opp.like_count || 0} likes, ${opp.reply_count || 0} replies, ${opp.retweet_count || 0} reposts`);
    console.log(`   Likes/min: ${likesPerMin}`);
    console.log(`   Replies/min: ${repliesPerMin}`);
    console.log(`   Reposts/min: ${repostsPerMin}`);
    console.log(`   Views: ${opp.view_count || 'N/A'}`);
    console.log(`   Score: ${opp.opportunity_score || 0}`);
    console.log(`   Relevance: ${opp.relevanceScore.toFixed(2)}`);
    console.log(`   Replyability: ${opp.replyabilityScore.toFixed(2)}`);
    if (opp.gatesPass) {
      const exemptionNote = opp.usedWhitelistExemption ? ' (whitelist_exemption)' : '';
      console.log(`   Gates: ✅ PASS (Tier ${opp.gateTier}${exemptionNote})`);
    } else {
      console.log(`   Gates: ❌ FAIL (below all tiers)`);
    }
    if (opp.disallowedReason) {
      console.log(`   Disallowed: ❌ ${opp.disallowedReason}`);
    }
    if (opp.selection_reason) {
      console.log(`   Selection Reason: ${opp.selection_reason}`);
    }
    console.log(`   Classification: ${classification}`);
    console.log(`   URL: https://x.com/i/web/status/${opp.target_tweet_id}`);
    console.log('');
  });
  
  process.exit(0);
}

main().catch(console.error);


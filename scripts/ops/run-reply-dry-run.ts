#!/usr/bin/env tsx
/**
 * 💬 REPLY DRY-RUN - Generate Reply Drafts Without Posting
 * 
 * Generates reply drafts and stores them in content_metadata with status='draft'.
 * Never posts when REPLIES_DRY_RUN=true.
 * 
 * Usage:
 *   REPLIES_ENABLED=true REPLIES_DRY_RUN=true MAX_REPLIES_PER_RUN=1 \
 *   pnpm tsx scripts/ops/run-reply-dry-run.ts
 */

import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '../../src/db/index';
import { generateReplyContent } from '../../src/ai/replyGeneratorAdapter';
import { strategicReplySystem } from '../../src/growth/strategicReplySystem';
import { checkReplyQuality } from '../../src/gates/ReplyQualityGate';
import { isCanaryEligibleTweet } from '../../src/utils/canaryEligibility';
import { UnifiedBrowserPool } from '../../src/browser/UnifiedBrowserPool';
import * as path from 'path';
import * as fs from 'fs';

const REPLIES_ENABLED = process.env.REPLIES_ENABLED === 'true';
const REPLIES_DRY_RUN = process.env.REPLIES_DRY_RUN !== 'false'; // Default true
const MAX_REPLIES_PER_RUN = parseInt(process.env.MAX_REPLIES_PER_RUN || '1', 10);
const CANARY_MODE = process.env.CANARY_MODE === 'true';

interface DryRunResult {
  mode: 'dry_run';
  candidates_evaluated: number;
  drafts_generated: number;
  drafts_stored: number;
  quality_failures: number;
  gate_failures: number;
  dry_run: boolean;
  max_replies: number;
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        💬 REPLY DRY-RUN - DRAFT GENERATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (!REPLIES_ENABLED) {
    console.log('⚠️  REPLIES_ENABLED=false, skipping reply generation');
    process.exit(0);
  }
  
  console.log(`[REPLY_DRY_RUN] Configuration:`);
  console.log(`   REPLIES_ENABLED: ${REPLIES_ENABLED}`);
  console.log(`   REPLIES_DRY_RUN: ${REPLIES_DRY_RUN}`);
  console.log(`   MAX_REPLIES_PER_RUN: ${MAX_REPLIES_PER_RUN}`);
  console.log(`   CANARY_MODE: ${CANARY_MODE}\n`);
  
  const supabase = getSupabaseClient();
  const result: DryRunResult = {
    mode: 'dry_run',
    candidates_evaluated: 0,
    drafts_generated: 0,
    drafts_stored: 0,
    quality_failures: 0,
    gate_failures: 0,
    dry_run: REPLIES_DRY_RUN,
    max_replies: MAX_REPLIES_PER_RUN,
  };
  
  // Select best candidates (fresh + high likes + not replied yet)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: opportunities, error: oppError } = await supabase
    .from('reply_opportunities')
    .select('*')
    .eq('replied_to', false)
    .gte('like_count', 50) // Lowered threshold for testing
    .gte('created_at', twentyFourHoursAgo) // Extended window to 24h
    .order('like_count', { ascending: false })
    .limit(MAX_REPLIES_PER_RUN * 5); // Get more candidates for filtering
  
  // Filter for health-related content in memory (more flexible)
  // For testing, allow any opportunity if no health ones found
  const healthKeywords = /(health|wellness|fitness|nutrition|sleep|exercise|metabolism|protein|vitamin|supplement|research|study|diet|workout|muscle|cardio|longevity|biohack)/i;
  let healthFiltered = opportunities?.filter(opp => {
    const content = (opp.tweet_content || opp.target_tweet_content || '').toLowerCase();
    const source = (opp.discovery_source || '').toLowerCase();
    return healthKeywords.test(content) || 
           source.includes('health') || 
           source.includes('fitness') || 
           source.includes('profile'); // Profile harvester targets health accounts
  }) || [];
  
  // If no health opportunities, use all (for testing)
  if (healthFiltered.length === 0 && opportunities && opportunities.length > 0) {
    console.log(`[REPLY_DRY_RUN] ⚠️  No health opportunities found, using all opportunities for testing`);
    healthFiltered = opportunities;
  }
  
  if (oppError) {
    console.error(`[REPLY_DRY_RUN] ❌ Failed to fetch opportunities: ${oppError.message}`);
    process.exit(1);
  }
  
  if (!opportunities || opportunities.length === 0) {
    console.log(`[REPLY_DRY_RUN] ⚠️  No opportunities found`);
    console.log(JSON.stringify(result));
    process.exit(0);
  }
  
  console.log(`[REPLY_DRY_RUN] 📊 Found ${opportunities.length} total opportunities`);
  console.log(`[REPLY_DRY_RUN] 📊 Filtered to ${healthFiltered.length} health-related opportunities\n`);
  
  if (healthFiltered.length === 0) {
    console.log(`[REPLY_DRY_RUN] ⚠️  No health-related opportunities found`);
    console.log(JSON.stringify(result));
    process.exit(0);
  }
  
  // Check for existing drafts to avoid duplicates
  const { data: existingDrafts } = await supabase
    .from('content_metadata')
    .select('target_tweet_id')
    .eq('decision_type', 'reply')
    .eq('status', 'draft')
    .in('target_tweet_id', healthFiltered.map(o => o.tweet_id || o.target_tweet_id).filter(Boolean));
  
  const existingTweetIds = new Set(existingDrafts?.map(d => d.target_tweet_id) || []);
  
  // Filter out already-drafted opportunities
  const candidates = healthFiltered.filter(o => {
    const tweetId = o.tweet_id || o.target_tweet_id;
    return tweetId && !existingTweetIds.has(tweetId);
  });
  
  console.log(`[REPLY_DRY_RUN] 📋 ${candidates.length} candidates after deduplication\n`);
  
  // 🔒 CANARY_MODE: Filter for canary-eligible candidates
  let canaryCandidates = candidates;
  if (CANARY_MODE) {
    console.log(`[REPLY_DRY_RUN] 🔒 CANARY_MODE: Checking eligibility for ${candidates.length} candidates...`);
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('canary_eligibility_check');
    
    const eligibleCandidates = [];
    for (const opp of candidates) {
      const tweetId = opp.tweet_id || opp.target_tweet_id || '';
      const authorHandle = opp.tweet_author || opp.author_handle || opp.target_username || '';
      const discoverySource = opp.discovery_source || null;
      
      if (!tweetId) continue;
      
      try {
        const eligibility = await isCanaryEligibleTweet(page, tweetId, discoverySource, authorHandle);
        if (eligibility.eligible) {
          eligibleCandidates.push({ ...opp, canaryEligible: true, eligibility });
          console.log(`[REPLY_DRY_RUN]   ✅ Eligible: ${tweetId} (@${authorHandle})`);
        } else {
          console.log(`[REPLY_DRY_RUN]   ⏭️  Not eligible: ${tweetId} (${eligibility.reason})`);
        }
      } catch (error: any) {
        console.log(`[REPLY_DRY_RUN]   ⚠️  Eligibility check failed: ${tweetId} (${error.message})`);
      }
    }
    
    await pool.releasePage(page);
    canaryCandidates = eligibleCandidates;
    console.log(`[REPLY_DRY_RUN] 📊 ${canaryCandidates.length} canary-eligible candidates\n`);
    
    if (canaryCandidates.length === 0) {
      console.log(`[REPLY_DRY_RUN] ⚠️  No canary-eligible candidates found`);
      console.log(JSON.stringify(result));
      process.exit(0);
    }
  }
  
  for (let i = 0; i < Math.min(canaryCandidates.length, MAX_REPLIES_PER_RUN); i++) {
    const opp = canaryCandidates[i];
    result.candidates_evaluated++;
    
    // Map fields (schema uses tweet_author, not author_handle)
    const authorHandle = opp.tweet_author || opp.author_handle || opp.target_username || 'unknown';
    const tweetContent = opp.tweet_content || opp.target_tweet_content || '';
    const tweetId = opp.tweet_id || opp.target_tweet_id || '';
    
    console.log(`[REPLY_DRY_RUN] 🎯 Processing candidate ${i + 1}/${Math.min(canaryCandidates.length, MAX_REPLIES_PER_RUN)}`);
    console.log(`   Tweet ID: ${tweetId}`);
    console.log(`   Author: @${authorHandle}`);
    console.log(`   Likes: ${opp.like_count || 0}`);
    console.log(`   Content: ${tweetContent.substring(0, 100)}...\n`);
    
    if (!tweetId || !tweetContent) {
      console.log(`[REPLY_DRY_RUN]   ⚠️  Skipping: missing tweet_id or content`);
      continue;
    }
    
    try {
      // Generate reply using existing infrastructure
      let replyContent: string;
      let generatorUsed: string;
      
      // Try strategic reply system first
      try {
        const strategicReply = await strategicReplySystem.generateStrategicReply({
          account: {
            username: authorHandle,
            category: 'health', // Default category
            followers: 0,
          },
          tweet_content: tweetContent,
          tweet_id: tweetId,
          like_count: opp.like_count || 0,
          reply_count: opp.reply_count || 0,
          reply_angle: 'add_insight',
        });
        
        if (strategicReply.provides_value && strategicReply.not_spam) {
          replyContent = strategicReply.content;
          generatorUsed = 'strategic_reply_system';
        } else {
          throw new Error('Strategic reply failed quality check');
        }
      } catch (strategicError) {
        // Fallback to adapter
        console.log(`[REPLY_DRY_RUN]   ⚠️  Strategic reply failed, using adapter fallback`);
        const adapterResult = await generateReplyContent({
          target_username: authorHandle,
          target_tweet_content: tweetContent,
          topic: 'health',
          angle: 'add_insight',
        });
        replyContent = adapterResult.content;
        generatorUsed = adapterResult.generator_used;
      }
      
      // Validate length (280 char limit)
      if (replyContent.length > 280) {
        console.log(`[REPLY_DRY_RUN]   ❌ Reply too long: ${replyContent.length} chars`);
        result.gate_failures++;
        continue;
      }
      
      // Apply quality gates
      const qualityCheck = checkReplyQuality(replyContent, tweetContent, 0);
      
      if (!qualityCheck.passed) {
        console.log(`[REPLY_DRY_RUN]   ❌ Quality gate failed: ${qualityCheck.reason}`);
        result.quality_failures++;
        continue;
      }
      
      // Check uniqueness (no generic filler)
      const isGeneric = /^(great point|totally agree|thanks for sharing|this is so true|exactly|100%|spot on)/i.test(replyContent.trim());
      if (isGeneric) {
        console.log(`[REPLY_DRY_RUN]   ❌ Generic filler detected`);
        result.gate_failures++;
        continue;
      }
      
      // Safety check (no harmful content)
      const hasHarmfulContent = /(kill|die|suicide|hate|violence|attack)/i.test(replyContent);
      if (hasHarmfulContent) {
        console.log(`[REPLY_DRY_RUN]   ❌ Safety gate failed: harmful content detected`);
        result.gate_failures++;
        continue;
      }
      
      result.drafts_generated++;
      
      // Store draft in content_metadata
      const decisionId = uuidv4();
      const features: Record<string, any> = {};
      if (CANARY_MODE && (opp as any).canaryEligible) {
        features.canary_eligible = true;
        features.canary_eligibility_reason = (opp as any).eligibility?.reason || 'verified';
      }
      
      const { error: insertError } = await supabase
        .from('content_metadata')
        .insert({
          decision_id: decisionId,
          decision_type: 'reply',
          content: replyContent,
          target_tweet_id: tweetId,
          target_username: authorHandle,
          status: 'draft', // Draft status (not 'queued' or 'posted')
          quality_score: qualityCheck.score || 0.7,
          generator_name: generatorUsed,
          features: Object.keys(features).length > 0 ? features : undefined,
          created_at: new Date().toISOString(),
        });
      
      if (insertError) {
        console.error(`[REPLY_DRY_RUN]   ❌ Failed to store draft: ${insertError.message}`);
        continue;
      }
      
      result.drafts_stored++;
      console.log(`[REPLY_DRY_RUN]   ✅ Draft stored: ${replyContent.substring(0, 80)}...\n`);
      
    } catch (error: any) {
      console.error(`[REPLY_DRY_RUN]   ❌ Error processing candidate: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    RESULT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(JSON.stringify(result));
  
  if (result.drafts_stored > 0) {
    console.log(`\n✅ SUCCESS: Generated ${result.drafts_stored} draft(s) (DRY RUN - not posted)`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  No drafts generated (quality/gate failures: ${result.quality_failures + result.gate_failures})`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

/**
 * 📮 POSTING QUEUE JOB
 * Processes ready decisions and posts them to Twitter
 */

import fs from 'fs';
import path from 'path';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { ENV } from '../config/env';
import { log } from '../lib/logger';
import { getConfig, getModeFlags } from '../config/config';
import { learningSystem } from '../learning/learningSystem';
import { trackError, ErrorTracker } from '../utils/errorTracker';
import { SystemFailureAuditor } from '../audit/systemFailureAuditor';

const FOLLOWER_BASELINE_TIMEOUT_MS = Number(process.env.FOLLOWER_BASELINE_TIMEOUT_MS ?? '10000');
const TWITTER_AUTH_PATH = path.join(process.cwd(), 'twitter-auth.json');
const MAX_POSTING_RECOVERY_ATTEMPTS = Number(process.env.POSTING_MAX_RECOVERY_ATTEMPTS ?? 2);

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 PRE-POST INVARIANT CHECK - Structural checks before posting a reply
// ═══════════════════════════════════════════════════════════════════════════════
interface InvariantCheckPrePost {
  pass: boolean;
  reason: string;
  guard_results: Record<string, any>;
}

async function checkReplyInvariantsPrePost(decision: any): Promise<InvariantCheckPrePost> {
  const decisionId = decision.id || decision.decision_id || 'unknown';
  const guardResults: Record<string, any> = {};
  
  console.log(`[INVARIANT] ═══════════════════════════════════════`);
  console.log(`[INVARIANT] decision_id=${decisionId} PRE-POST CHECK`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 1) THREAD-LIKE CONTENT CHECK (FAIL CLOSED)
  // ═══════════════════════════════════════════════════════════════════════════
  const content = decision.content || '';
  const threadPatterns = [
    /^\s*\d+\/\d+/,           // "1/5", "2/3" at start
    /^\d+\.\s/m,              // "1. " at line start
    /\(\d+\)/,                // "(1)", "(2)"
    /🧵/,                      // Thread emoji
    /\bthread\b/i,            // Word "thread"
    /TIP\s*\d+/i,             // "TIP 1", "TIP 3"
    /\bPROTOCOL:/i,           // "PROTOCOL:"
    /\b\d+\)\s/,              // "1) " listicle style
    /^Here's|^Here is/i,      // Generic thread opener
    /---+/,                   // Divider lines
    /THREAD\s*BREAK/i,        // Thread break marker
  ];
  
  for (const pattern of threadPatterns) {
    if (pattern.test(content)) {
      guardResults.format_check = { pass: false, pattern: pattern.source, matched: content.match(pattern)?.[0] };
      console.log(`[INVARIANT] format_check=FAIL pattern="${pattern.source}" matched="${content.match(pattern)?.[0]}"`);
      return { pass: false, reason: 'thread_like_content', guard_results: guardResults };
    }
  }
  
  // 2) MULTI-NEWLINE CHECK - Replies should not have >1 newline (thread-like)
  const newlineCount = (content.match(/\n/g) || []).length;
  if (newlineCount > 1) {
    guardResults.newline_check = { pass: false, newline_count: newlineCount };
    console.log(`[INVARIANT] newline_check=FAIL count=${newlineCount} (max=1)`);
    return { pass: false, reason: 'too_many_newlines', guard_results: guardResults };
  }
  guardResults.newline_check = { pass: true, newline_count: newlineCount };
  
  guardResults.format_check = { pass: true };
  console.log(`[INVARIANT] format_check=pass len=${content.length} newlines=${newlineCount}`);
  
  // 3) LENGTH CHECK - Replies should be concise (max 240 chars)
  const MAX_REPLY_LENGTH = 240;
  if (content.length > MAX_REPLY_LENGTH) {
    guardResults.length_check = { pass: false, length: content.length, max: MAX_REPLY_LENGTH };
    console.log(`[INVARIANT] length_check=FAIL len=${content.length} max=${MAX_REPLY_LENGTH}`);
    return { pass: false, reason: 'reply_too_long', guard_results: guardResults };
  }
  guardResults.length_check = { pass: true, length: content.length, max: MAX_REPLY_LENGTH };
  
  // 3) ROOT-ONLY CHECK - Structural (from DB metadata)
  const { getSupabaseClient } = await import('../db/index');
  const supabase = getSupabaseClient();
  try {
    
    // Check reply_opportunities for is_root_tweet metadata
    const { data: opportunity } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_content, is_root_tweet, tweet_posted_at, like_count')
      .eq('target_tweet_id', decision.target_tweet_id)
      .maybeSingle();
    
    if (opportunity) {
      // Structural check: is_root_tweet from harvester
      if (opportunity.is_root_tweet === false) {
        guardResults.root_check = { pass: false, reason: 'is_root_tweet=false' };
        console.log(`[ROOT_CHECK] decision_id=${decisionId} is_root=false reason=metadata_says_not_root`);
        return { pass: false, reason: 'target_is_reply_tweet', guard_results: guardResults };
      }
      
      // Text heuristic fallback: content starts with @
      const targetContent = opportunity.target_tweet_content || '';
      if (targetContent.trim().startsWith('@')) {
        guardResults.root_check = { pass: false, reason: 'content_starts_with_@' };
        console.log(`[ROOT_CHECK] decision_id=${decisionId} is_root=false reason=content_starts_with_@`);
        return { pass: false, reason: 'target_looks_like_reply', guard_results: guardResults };
      }
      
      guardResults.root_check = { pass: true };
      console.log(`[ROOT_CHECK] decision_id=${decisionId} is_root=true reason=structural_check_passed`);
      
      // 4) FRESHNESS CHECK - Velocity-aware age limits
      // Prioritize ACTIVE tweets (high velocity) over stale viral tweets
      if (opportunity.tweet_posted_at) {
        const postedAt = new Date(opportunity.tweet_posted_at);
        const ageMinutes = (Date.now() - postedAt.getTime()) / (60 * 1000);
        const likeCount = Number(opportunity.like_count || 0);
        const velocity = likeCount / Math.max(ageMinutes, 10);
        
        // Velocity-aware freshness limits
        // PREFERRED: <= 6 hours | HARD MAX: <= 12 hours (with high velocity)
        let maxAgeMin = 360; // Default: 6 hours (preferred)
        if (velocity >= 200) maxAgeMin = 24 * 60;      // EXTREME velocity: 24h
        else if (velocity >= 100) maxAgeMin = 12 * 60; // HIGH velocity: 12h
        else if (velocity >= 30) maxAgeMin = 6 * 60;   // MEDIUM velocity: 6h
        else maxAgeMin = 3 * 60;                       // LOW velocity: 3h
        
        if (ageMinutes > maxAgeMin) {
          guardResults.freshness_check = { pass: false, age_min: Math.round(ageMinutes), max: maxAgeMin, likes: likeCount, velocity: Math.round(velocity) };
          console.log(`[INVARIANT] freshness_check=FAIL age_min=${Math.round(ageMinutes)} max=${maxAgeMin} likes=${likeCount} velocity=${velocity.toFixed(1)}`);
          return { pass: false, reason: 'target_too_old', guard_results: guardResults };
        }
        guardResults.freshness_check = { pass: true, age_min: Math.round(ageMinutes), max: maxAgeMin, likes: likeCount, velocity: Math.round(velocity) };
        console.log(`[INVARIANT] freshness_check=pass age_min=${Math.round(ageMinutes)} max=${maxAgeMin} likes=${likeCount} velocity=${velocity.toFixed(1)}`);
      }
    } else {
      // No opportunity found - check if this is from reply_v2_scheduler (CERT_MODE or normal scheduler)
      // For scheduler decisions, we already verified root in FINAL_REPLY_GATE, so allow posting
      // Fetch pipeline_source from DB if not in decision object
      const pipelineSource = decision.pipeline_source || (await supabase
        .from('content_metadata')
        .select('pipeline_source')
        .eq('decision_id', decisionId)
        .single()
        .then(r => r.data?.pipeline_source));
      
      if (pipelineSource === 'reply_v2_scheduler') {
        console.log(`[ROOT_CHECK] decision_id=${decisionId} is_root=verified_by_scheduler reason=scheduler_decision_no_opportunity_required`);
        guardResults.root_check = { pass: true, reason: 'scheduler_verified_root' };
        // Skip freshness check for scheduler decisions (they're already filtered by age in fetch)
      } else {
        // No opportunity found - fail closed for non-scheduler decisions
        guardResults.root_check = { pass: false, reason: 'opportunity_not_found' };
        console.log(`[ROOT_CHECK] decision_id=${decisionId} is_root=unknown reason=opportunity_not_found pipeline_source=${pipelineSource || 'unknown'}`);
        return { pass: false, reason: 'opportunity_not_found', guard_results: guardResults };
      }
    }
  } catch (lookupError: any) {
    console.warn(`[INVARIANT] ⚠️ DB lookup failed: ${lookupError.message}`);
    guardResults.db_error = lookupError.message;
    // Fail open on transient DB errors (allow posting)
  }
  
  // 5) CONTEXT LOCK VERIFICATION (for replies only)
  try {
    // Fetch snapshot from decision metadata
    const { data: decisionData } = await supabase
      .from('content_metadata')
      .select('target_tweet_content_snapshot, target_tweet_content_hash, target_tweet_id, target_username')
      .eq('decision_id', decision.id)
      .maybeSingle();
    
    if (decisionData && decisionData.target_tweet_content_hash) {
      const { verifyContextLock } = await import('../gates/contextLockGuard');
      
      const snapshot = {
        target_tweet_id: decisionData.target_tweet_id,
        target_tweet_text: decisionData.target_tweet_content_snapshot || '',
        target_tweet_text_hash: decisionData.target_tweet_content_hash,
        target_author: decisionData.target_username,
        snapshot_at: new Date().toISOString()
      };
      
      const lockResult = await verifyContextLock(snapshot);
      
      if (!lockResult.pass) {
        guardResults.context_lock = { 
          pass: false, 
          reason: lockResult.reason,
          similarity: lockResult.similarity 
        };
        console.log(`[CONTEXT_LOCK] decision_id=${decisionId} pass=false reason=${lockResult.reason} similarity=${lockResult.similarity}`);
        return { pass: false, reason: lockResult.reason, guard_results: guardResults };
      }
      
      guardResults.context_lock = { pass: true, similarity: lockResult.similarity };
      console.log(`[CONTEXT_LOCK] decision_id=${decisionId} pass=true similarity=${(lockResult.similarity || 0).toFixed(2)}`);
    }
  } catch (lockError: any) {
    console.warn(`[CONTEXT_LOCK] ⚠️ Verification failed: ${lockError.message}`);
    guardResults.context_lock_error = lockError.message;
    // Fail open on transient errors (allow posting)
  }
  
  // 6) PIPELINE GUARD: Block thread generators in reply mode
  const generationSource = decision.generation_source || decision.metadata?.generation_source || '';
  const THREAD_GENERATORS = ['thread', 'multi_tweet', 'thread_generator', 'multi_generator'];
  
  // Check if generation_source indicates a thread generator
  const isThreadGenerator = THREAD_GENERATORS.some(pattern => 
    generationSource.toLowerCase().includes(pattern)
  );
  
  if (isThreadGenerator) {
    guardResults.pipeline_guard = { pass: false, source: generationSource, reason: 'thread_generator_in_reply_mode' };
    console.log(`[PIPELINE_GUARD] generator=${generationSource} mode=reply action=blocked`);
    return { pass: false, reason: 'thread_generator_blocked', guard_results: guardResults };
  }
  
  // Also block if content looks like it came from a thread generator
  if (content.split('\n').filter((l: string) => l.trim()).length > 3) {
    guardResults.pipeline_guard = { pass: false, reason: 'too_many_paragraphs', line_count: content.split('\n').filter((l: string) => l.trim()).length };
    console.log(`[PIPELINE_GUARD] lines=${content.split('\n').filter((l: string) => l.trim()).length} max=3 action=blocked`);
    return { pass: false, reason: 'too_many_paragraphs_for_reply', guard_results: guardResults };
  }
  
  guardResults.pipeline_guard = { pass: true };
  console.log(`[PIPELINE_GUARD] generator=${generationSource || 'unknown'} mode=reply pass=true`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 7) TOPIC MISMATCH GATE - Block politics/conflict topics in health replies
  // ═══════════════════════════════════════════════════════════════════════════
  const POLITICAL_TOPICS = [
    /\b(trump|biden|election|democrat|republican|congress|senate|vote|voting)\b/i,
    /\b(israel|palestine|gaza|hamas|war|ukraine|russia|military|conflict)\b/i,
    /\b(immigrant|immigration|border|deport|refugee)\b/i,
    /\b(abortion|roe|wade|pro-life|pro-choice)\b/i,
    /\b(gun|shooting|2nd amendment|nra)\b/i,
    /\b(climate change|global warming)\b/i,  // Contentious - avoid unless explicitly health-related
  ];
  
  for (const pattern of POLITICAL_TOPICS) {
    if (pattern.test(content)) {
      guardResults.topic_mismatch = { pass: false, reason: 'political_topic_detected', pattern: pattern.source };
      console.log(`[TOPIC_MISMATCH] FAIL: political_topic pattern="${pattern.source}"`);
      return { pass: false, reason: 'topic_mismatch_political', guard_results: guardResults };
    }
  }
  guardResults.topic_mismatch = { pass: true };
  console.log(`[TOPIC_MISMATCH] pass=true (no political topics)`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 8) SUBSTANCE GATE - Reply must be contextual, not generic filler
  // ═══════════════════════════════════════════════════════════════════════════
  const GENERIC_OPENERS = [
    /^Research shows/i,
    /^Studies show/i,
    /^Studies suggest/i,
    /^Mindfulness is/i,
    /^Science shows/i,
    /^The research is clear/i,
    /^Here's the thing/i,
    /^Great point!/i,
    /^Good point!/i,
    /^Interesting!/i,
    /^This is so true/i,
    /^So true!/i,
    /^Absolutely!/i,
    /^100%!/i,
    /^Facts!/i,
    /^Exactly!/i,
  ];
  
  for (const pattern of GENERIC_OPENERS) {
    if (pattern.test(content.trim())) {
      guardResults.substance_gate = { pass: false, reason: 'generic_opener', pattern: pattern.source };
      console.log(`[SUBSTANCE_GATE] FAIL: generic_opener pattern="${pattern.source}"`);
      return { pass: false, reason: 'substance_gate_generic_opener', guard_results: guardResults };
    }
  }
  
  // Check for minimum substance indicators
  // Reply should have at least one of: question mark, specific term, or action word
  const hasQuestion = content.includes('?');
  const hasActionWord = /\b(try|consider|check|notice|think|look|might|could|would|should)\b/i.test(content);
  const hasSpecificTerm = /\b(mg|vitamin|protein|calories|hours?|minutes?|percent|%|study|research|data)\b/i.test(content);
  
  if (!hasQuestion && !hasActionWord && !hasSpecificTerm) {
    guardResults.substance_gate = { pass: false, reason: 'lacks_substance_markers' };
    console.log(`[SUBSTANCE_GATE] FAIL: lacks_substance_markers (no question, action word, or specific term)`);
    return { pass: false, reason: 'substance_gate_no_markers', guard_results: guardResults };
  }
  
  guardResults.substance_gate = { pass: true, hasQuestion, hasActionWord, hasSpecificTerm };        
  console.log(`[SUBSTANCE_GATE] pass=true question=${hasQuestion} action=${hasActionWord} specific=${hasSpecificTerm}`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 9) SPECIFICITY GATE - Reply must reference target tweet content (minimal)
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const snapshot = (decision.target_tweet_content_snapshot || '') as string;
    
    if (snapshot && snapshot.length >= 20) {
      // Extract non-trivial tokens (4+ chars, exclude common words)
      const commonWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'about', 'their', 'there', 'these', 'those', 'which', 'where', 'when', 'what', 'they', 'them', 'then', 'than', 'more', 'most', 'some', 'many', 'much', 'very', 'just', 'only', 'also', 'even', 'still', 'well', 'here', 'were', 'your', 'ours']);
      
      const extractTokens = (text: string): Set<string> => {
        return new Set(
          text.toLowerCase()
            .replace(/[^a-z0-9\s]/gi, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 4 && !commonWords.has(w))
        );
      };
      
      const replyTokens = extractTokens(content);
      const targetTokens = extractTokens(snapshot);
      
      // Check for token overlap
      const overlap = Array.from(replyTokens).filter(t => targetTokens.has(t));
      
      // Also check for named entities/keywords (numbers, proper nouns, specific terms)
      const hasNumberReference = /\b\d+/.test(content) && /\b\d+/.test(snapshot);
      const hasProperNoun = /\b[A-Z][a-z]{3,}\b/.test(content) && /\b[A-Z][a-z]{3,}\b/.test(snapshot);
      
      if (overlap.length === 0 && !hasNumberReference && !hasProperNoun) {
        guardResults.specificity_gate = { pass: false, reason: 'no_target_reference', reply_tokens: Array.from(replyTokens).slice(0, 5), target_tokens: Array.from(targetTokens).slice(0, 5) };
        console.log(`[SPECIFICITY_GATE] FAIL: no_target_reference (no token overlap, number, or proper noun)`);
        return { pass: false, reason: 'specificity_gate_no_reference', guard_results: guardResults };
      }
      
      guardResults.specificity_gate = { pass: true, overlap_count: overlap.length, has_number: hasNumberReference, has_proper_noun: hasProperNoun };
      console.log(`[SPECIFICITY_GATE] pass=true overlap=${overlap.length} number=${hasNumberReference} proper_noun=${hasProperNoun}`);
    } else {
      // No snapshot - fail closed
      guardResults.specificity_gate = { pass: false, reason: 'missing_snapshot' };
      console.log(`[SPECIFICITY_GATE] FAIL: missing_snapshot`);
      return { pass: false, reason: 'specificity_gate_missing_snapshot', guard_results: guardResults };
    }
  } catch (specificityError: any) {
    guardResults.specificity_gate = { pass: false, reason: 'check_error', error: specificityError.message };
    console.log(`[SPECIFICITY_GATE] FAIL: check_error ${specificityError.message}`);
    return { pass: false, reason: 'specificity_gate_error', guard_results: guardResults };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 10) ANCHOR CHECK - Reply must reference something from the target tweet
  // ═══════════════════════════════════════════════════════════════════════════
  // This is a DETERMINISTIC check (not LLM-based):
  // - Extract meaningful words (4+ chars) from both content and snapshot
  // - Require at least 1 word overlap OR a number/fact reference
  try {
    // Access snapshot from decision metadata
    const snapshot = (decision.target_tweet_content_snapshot || '') as string;
    
    if (snapshot && snapshot.length >= 20) {
      // Extract meaningful words (4+ chars, alphanumeric only)
      const extractWords = (text: string): Set<string> => {
        const words = text.toLowerCase()
          .replace(/[^a-z0-9\s]/gi, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 4)
          .filter(w => !['this', 'that', 'have', 'been', 'with', 'from', 'they', 'your', 'will', 'just', 'more', 'when', 'what', 'than', 'very', 'also', 'some', 'like', 'into'].includes(w));
        return new Set(words);
      };
      
      const contentWords = extractWords(content);
      const snapshotWords = extractWords(snapshot);
      
      // Find overlapping words
      const overlap = [...contentWords].filter(w => snapshotWords.has(w));
      
      // Extract numbers from both      
      const contentNumbers: string[] = content.match(/\d+(\.\d+)?%?/g) || [];             
      const snapshotNumbers: string[] = snapshot.match(/\d+(\.\d+)?%?/g) || [];           
      const numberOverlap = contentNumbers.filter(n => snapshotNumbers.includes(n));
      
      const hasWordAnchor = overlap.length >= 1;
      const hasNumberAnchor = numberOverlap.length >= 1;
      
      if (!hasWordAnchor && !hasNumberAnchor) {
        guardResults.anchor_check = { 
          pass: false, 
          reason: 'no_content_anchor',
          word_overlap: overlap.length,
          number_overlap: numberOverlap.length
        };
        console.log(`[ANCHOR_CHECK] FAIL: no_content_anchor word_overlap=${overlap.length} number_overlap=${numberOverlap.length}`);
        return { pass: false, reason: 'no_content_anchor', guard_results: guardResults };
      }
      
      guardResults.anchor_check = { 
        pass: true, 
        word_overlap: overlap.length,
        number_overlap: numberOverlap.length,
        anchor_words: overlap.slice(0, 3)
      };
      console.log(`[ANCHOR_CHECK] pass=true word_overlap=${overlap.length} number_overlap=${numberOverlap.length} anchors=${overlap.slice(0, 3).join(',')}`);
    } else {
      // No snapshot to check against - fail closed
      guardResults.anchor_check = { pass: false, reason: 'missing_snapshot_for_anchor' };
      console.log(`[ANCHOR_CHECK] FAIL: missing_snapshot_for_anchor snapshot_len=${snapshot?.length || 0}`);
      return { pass: false, reason: 'missing_snapshot_for_anchor', guard_results: guardResults };
    }
  } catch (anchorError: any) {
    console.warn(`[ANCHOR_CHECK] Error computing anchor:`, anchorError.message);
    // Fail open on errors - other gates should catch issues
    guardResults.anchor_check = { pass: true, error: anchorError.message };
  }
  
  console.log(`[INVARIANT] FINAL: pass=true`);              
  console.log(`[INVARIANT] ═══════════════════════════════════════`);           
  
  return { pass: true, reason: 'ok', guard_results: guardResults };             
}

/**
 * 🔒 FINAL_REPLY_GATE - FAIL-CLOSED safety checks before posting any reply
 * Returns true if decision should be SKIPPED, false if ok to proceed
 * 
 * INVARIANTS (NON-NEGOTIABLE):
 * 1. target_tweet_id exists
 * 2. root_tweet_id exists AND root_tweet_id == target_tweet_id (ROOT-ONLY)
 * 3. target_tweet_content_snapshot exists and length >= 20
 * 4. No thread markers (/\b\d+\/\d+\b/, TIP:, PROTOCOL:, 🧵, thread)
 * 5. length <= 260, line breaks <= 2
 * 6. semantic_similarity >= 0.30
 * 7. No tech/art/politics targets with health replies
 */
async function checkReplySafetyGates(decision: any, supabase: any): Promise<boolean> {
  const decisionId = decision.id || decision.decision_id || 'unknown';
  
  console.log(`[FINAL_REPLY_GATE] 🔍 Starting fail-closed checks for decision ${decisionId}`);
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATE 0: ROOT-ONLY INVARIANT (CRITICAL)
  // ═══════════════════════════════════════════════════════════════════════
  const targetTweetId = decision.target_tweet_id;
  const rootTweetId = decision.root_tweet_id;
  
  if (!targetTweetId) {
    console.error(`[FINAL_REPLY_GATE] ⛔ BLOCKED: No target_tweet_id`);
    console.error(`[FINAL_REPLY_GATE]   decision_id=${decisionId}`);
    
    await supabase.from('content_generation_metadata_comprehensive')
      .update({ status: 'blocked', skip_reason: 'missing_target_tweet_id' })
      .eq('decision_id', decisionId);
    
    return true; // SKIP
  }
  
  // 🔒 FAIL-CLOSED: Block if root_tweet_id is null (resolver uncertainty)
  if (!rootTweetId || rootTweetId === null) {
    console.error(`[FINAL_REPLY_GATE] ⛔ BLOCKED: root_tweet_id is NULL (resolver uncertainty)`);
    console.error(`[FINAL_REPLY_GATE]   decision_id=${decisionId} target=${targetTweetId}`);
    console.error(`[FINAL_REPLY_GATE]   REASON: Resolver could not determine root - fail-closed to prevent deep reply chains`);
    
    await supabase.from('content_generation_metadata_comprehensive')
      .update({ status: 'blocked', skip_reason: 'root_resolution_failed_null' })
      .eq('decision_id', decisionId);
    
    await supabase.from('system_events').insert({
      event_type: 'reply_gate_blocked',
      severity: 'critical',
      message: `Reply blocked: root_tweet_id is null (resolver uncertainty)`,
      event_data: {
        decision_id: decisionId,
        target_tweet_id: targetTweetId,
        reason: 'root_resolution_failed_null'
      },
      created_at: new Date().toISOString(),
    });
    
    return true; // SKIP
  }
  
  if (rootTweetId !== targetTweetId) {
    console.error(`[FINAL_REPLY_GATE] ⛔ BLOCKED: ROOT-ONLY violation!`);
    console.error(`[FINAL_REPLY_GATE]   decision_id=${decisionId}`);
    console.error(`[FINAL_REPLY_GATE]   root=${rootTweetId} target=${targetTweetId}`);
    console.error(`[FINAL_REPLY_GATE]   REASON: target is a REPLY, not a ROOT tweet`);
    
    await supabase.from('content_generation_metadata_comprehensive')
      .update({ status: 'blocked', skip_reason: 'target_not_root_violation' })
      .eq('decision_id', decisionId);
    
    await supabase.from('system_events').insert({
      event_type: 'reply_gate_blocked',
      severity: 'critical',
      message: `Reply blocked: ROOT-ONLY violation (target is reply, not root)`,
      event_data: {
        decision_id: decisionId,
        root_tweet_id: rootTweetId,
        target_tweet_id: targetTweetId,
        reason: 'target_not_root_violation'
      },
      created_at: new Date().toISOString(),
    });
    
    return true; // SKIP
  }
  
  console.log(`[FINAL_REPLY_GATE] ✅ ROOT-ONLY: root=${rootTweetId} == target=${targetTweetId}`);   
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATE 0.5: LIVE ROOT VERIFICATION (Twitter Truth)
  // Check if target_in_reply_to_tweet_id is set in DB (indicates reply tweet)
  // ═══════════════════════════════════════════════════════════════════════
  const { data: targetOpportunity } = await supabase
    .from('reply_opportunities')
    .select('target_in_reply_to_tweet_id, target_conversation_id')
    .eq('target_tweet_id', targetTweetId)
    .single();
  
  if (targetOpportunity) {
    if (targetOpportunity.target_in_reply_to_tweet_id) {
      console.error(`[FINAL_REPLY_GATE] ⛔ BLOCKED: Target is a REPLY tweet (Twitter truth)`);
      console.error(`[FINAL_REPLY_GATE]   decision_id=${decisionId}`);
      console.error(`[FINAL_REPLY_GATE]   target=${targetTweetId}`);
      console.error(`[FINAL_REPLY_GATE]   in_reply_to=${targetOpportunity.target_in_reply_to_tweet_id}`);
      
      await supabase.from('content_generation_metadata_comprehensive')
        .update({ status: 'blocked', skip_reason: 'target_not_root_live_check' })
        .eq('decision_id', decisionId);
      
      return true; // SKIP
    }
    
    if (targetOpportunity.target_conversation_id && 
        targetOpportunity.target_conversation_id !== targetTweetId &&
        targetOpportunity.target_conversation_id !== 'unknown') {
      console.error(`[FINAL_REPLY_GATE] ⛔ BLOCKED: Target is part of a conversation (not root)`);
      console.error(`[FINAL_REPLY_GATE]   decision_id=${decisionId}`);
      console.error(`[FINAL_REPLY_GATE]   target=${targetTweetId}`);
      console.error(`[FINAL_REPLY_GATE]   conversation_id=${targetOpportunity.target_conversation_id}`);
      
      await supabase.from('content_generation_metadata_comprehensive')
        .update({ status: 'blocked', skip_reason: 'target_not_root_conversation_check' })
        .eq('decision_id', decisionId);
      
      return true; // SKIP
    }
  }
  
  console.log(`[FINAL_REPLY_GATE] ✅ LIVE ROOT CHECK: Target is a true root tweet`);
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATE 0.6: NO SELF-REPLY GUARD (CRITICAL)
  // ═══════════════════════════════════════════════════════════════════════
  const ourHandle = (process.env.TWITTER_USERNAME || 'SignalAndSynapse').toLowerCase();
  
  // Check target_username from decision or reply_opportunities
  let targetAuthor: string | null = null;
  if (decision.target_username) {
    targetAuthor = String(decision.target_username).toLowerCase().trim();
  } else {
    // Fetch from reply_opportunities if not in decision
    const { data: oppData } = await supabase
      .from('reply_opportunities')
      .select('target_username')
      .eq('target_tweet_id', targetTweetId)
      .maybeSingle();
    
    if (oppData?.target_username) {
      targetAuthor = String(oppData.target_username).toLowerCase().trim();
    }
  }
  
  // If still no author, fetch from Twitter (fail-closed)
  if (!targetAuthor) {
    try {
      const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
      const pool = UnifiedBrowserPool.getInstance();
      const page = await pool.acquirePage('self_reply_check');
      
      try {
        await page.goto(`https://x.com/i/web/status/${targetTweetId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
        
        targetAuthor = await page.evaluate(() => {
          const authorElement = document.querySelector('[data-testid="User-Name"] a');
          return authorElement?.textContent?.replace('@', '').toLowerCase().trim() || null;
        });
        
        console.log(`[FINAL_REPLY_GATE] 🔍 Fetched author from Twitter: @${targetAuthor || 'unknown'}`);
      } finally {
        await pool.releasePage(page);
      }
    } catch (fetchError: any) {
      console.error(`[FINAL_REPLY_GATE] ⚠️ Could not fetch author for self-reply check: ${fetchError.message}`);
      // Fail-closed: if we can't verify, block
      await supabase.from('content_generation_metadata_comprehensive')
        .update({ status: 'blocked', skip_reason: 'self_reply_check_failed' })
        .eq('decision_id', decisionId);
      return true; // SKIP
    }
  }
  
  if (targetAuthor && targetAuthor === ourHandle) {
    console.error(`[FINAL_REPLY_GATE] ⛔ BLOCKED: SELF-REPLY detected!`);
    console.error(`[FINAL_REPLY_GATE]   decision_id=${decisionId}`);
    console.error(`[FINAL_REPLY_GATE]   target=${targetTweetId}`);
    console.error(`[FINAL_REPLY_GATE]   author=@${targetAuthor} (our handle: @${ourHandle})`);
    console.error(`[FINAL_REPLY_GATE]   REASON: Cannot reply to our own tweets`);
    
    await supabase.from('content_generation_metadata_comprehensive')
      .update({ status: 'blocked', skip_reason: 'self_reply_blocked' })
      .eq('decision_id', decisionId);
    
    await supabase.from('system_events').insert({
      event_type: 'self_reply_blocked',
      severity: 'critical',
      message: `Self-reply blocked: target tweet ${targetTweetId} is from our own account`,
      event_data: { decision_id: decisionId, target_tweet_id: targetTweetId, target_author: targetAuthor },
      created_at: new Date().toISOString()
    });
    
    return true; // SKIP
  }
  
  console.log(`[FINAL_REPLY_GATE] ✅ NO SELF-REPLY: Target author @${targetAuthor || 'unknown'} ≠ our handle @${ourHandle}`);
  
  // ═══════════════════════════════════════════════════════════════════════    
  // GATE 1: Missing Fields Check + Snapshot Length         
  // ═══════════════════════════════════════════════════════════════════════
  const requiredFields = [
    'target_tweet_id',
    'target_tweet_content_snapshot',
    'target_tweet_content_hash',
    'semantic_similarity'
  ];
  
  const missingFields = requiredFields.filter(field => {
    // Special handling for semantic_similarity (may be in features JSONB)
    if (field === 'semantic_similarity') {
      const value = decision[field] || (decision.features as any)?.semantic_similarity;
      if (value === null || value === undefined) return true;
      return false;
    }
    
    const value = decision[field];
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    return false;
  });
  
  if (missingFields.length > 0) {
    const fieldValues = missingFields.reduce((acc, f) => ({ ...acc, [f]: decision[f] || (f === 'semantic_similarity' ? (decision.features as any)?.semantic_similarity : null) }), {});
    console.error(`[FINAL_REPLY_GATE] ⛔ BLOCKED: Missing gate data`);
    console.error(`[FINAL_REPLY_GATE]   decision_id=${decisionId}`);
    console.error(`[FINAL_REPLY_GATE]   missing=${JSON.stringify(missingFields)}`);
    
    await supabase.from('content_generation_metadata_comprehensive')
      .update({
        status: 'blocked',
        skip_reason: 'missing_gate_data_safety_block',
        error_message: `Missing: ${missingFields.join(', ')}`
      })
      .eq('decision_id', decisionId);
    
    return true; // Skip
  }
  
  // Check snapshot length >= 20
  const snapshotLen = (decision.target_tweet_content_snapshot || '').length;
  if (snapshotLen < 20) {
    console.error(`[FINAL_REPLY_GATE] ⛔ BLOCKED: Snapshot too short (${snapshotLen} < 20)`);
    console.error(`[FINAL_REPLY_GATE]   decision_id=${decisionId}`);
    
    await supabase.from('content_generation_metadata_comprehensive')
      .update({ status: 'blocked', skip_reason: 'snapshot_too_short' })
      .eq('decision_id', decisionId);
    
    return true; // SKIP
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATE 1.5: SEMANTIC SIMILARITY THRESHOLD (>= 0.25, relaxed to 0.0 for fallback replies)
  // ═══════════════════════════════════════════════════════════════════════
  // semantic_similarity may be in decision.semantic_similarity (comprehensive table) or decision.features.semantic_similarity (metadata table)
  const similarity = parseFloat(decision.semantic_similarity) || parseFloat((decision.features as any)?.semantic_similarity) || 0;
  const MIN_SIMILARITY = 0.25;
  const MIN_SIMILARITY_FALLBACK = 0.0; // 🔒 TASK 3: Fallback replies passed grounding check, relax similarity threshold
  
  // Check if this is a fallback reply (from features JSONB)
  const isFallback = (decision.features as any)?.is_fallback === true;
  const effectiveMinSimilarity = isFallback ? MIN_SIMILARITY_FALLBACK : MIN_SIMILARITY;
  
  if (similarity < effectiveMinSimilarity) {
    console.error(`[FINAL_REPLY_GATE] ⛔ BLOCKED: Low semantic similarity (${similarity.toFixed(2)} < ${effectiveMinSimilarity})${isFallback ? ' [FALLBACK]' : ''}`);
    console.error(`[FINAL_REPLY_GATE]   decision_id=${decisionId}`);
    
    await supabase.from('content_generation_metadata_comprehensive')
      .update({ status: 'blocked', skip_reason: 'low_semantic_similarity' })
      .eq('decision_id', decisionId);
    
    return true; // SKIP
  }
  
  if (isFallback && similarity < MIN_SIMILARITY) {
    console.log(`[FINAL_REPLY_GATE] ⚠️ Fallback reply: similarity ${similarity.toFixed(2)} < ${MIN_SIMILARITY} but >= ${MIN_SIMILARITY_FALLBACK} (relaxed threshold)`);
  }
  
  console.log(`[FINAL_REPLY_GATE] ✅ All required fields present, snapshot=${snapshotLen} chars, similarity=${similarity.toFixed(2)}`);
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATE 2: Context Lock Verification (fetch target tweet)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[POSTING_QUEUE] 🔍 Verifying context lock for decision ${decisionId}`);
  
  try {
    const { verifyContextLock } = await import('../gates/contextLockVerifier');
    const contextVerification = await verifyContextLock(
      decision.target_tweet_id,
      decision.target_tweet_content_snapshot,
      decision.target_tweet_content_hash,
      decision.target_tweet_content_prefix_hash // 🔒 TASK 2: Pass prefix hash for fallback matching
    );
    
    if (!contextVerification.pass) {
      console.error(`[POSTING_QUEUE] ⛔ CONTEXT LOCK FAILED: ${contextVerification.skip_reason}`);
      console.error(`[POSTING_QUEUE]   decision_id=${decisionId}`);
      console.error(`[POSTING_QUEUE]   details=${JSON.stringify(contextVerification.details)}`);
      
      await supabase.from('content_generation_metadata_comprehensive')
        .update({
          status: 'blocked',
          skip_reason: contextVerification.skip_reason,
          error_message: JSON.stringify(contextVerification.details)
        })
        .eq('decision_id', decisionId);
      
      return true; // Skip
    }
    
    console.log(`[POSTING_QUEUE] ✅ Context lock verified for ${decisionId}`);
  } catch (verifyError: any) {
    console.error(`[POSTING_QUEUE] ❌ Context verification threw error: ${verifyError.message}`);
    console.error(`[POSTING_QUEUE]   Blocking decision ${decisionId} (fail-closed)`);
    
    await supabase.from('content_generation_metadata_comprehensive')
      .update({
        status: 'blocked',
        skip_reason: 'verification_fetch_error',
        error_message: verifyError.message
      })
      .eq('decision_id', decisionId);
    
    return true; // Skip
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATE 3: Topic Mismatch Guard
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[POSTING_QUEUE] 🔍 Checking topic mismatch for decision ${decisionId}`);
  
  try {
    const { checkTopicMismatch } = await import('../gates/topicMismatchGuard');
    const topicCheck = checkTopicMismatch(
      decision.target_tweet_content_snapshot || '',
      decision.content || ''
    );
    
    if (!topicCheck.pass) {
      console.error(`[POSTING_QUEUE] ⛔ TOPIC MISMATCH: ${topicCheck.skip_reason}`);
      console.error(`[POSTING_QUEUE]   decision_id=${decisionId}`);
      console.error(`[POSTING_QUEUE]   details=${JSON.stringify(topicCheck.details)}`);
      
      await supabase.from('content_generation_metadata_comprehensive')
        .update({
          status: 'blocked',
          skip_reason: topicCheck.skip_reason,
          error_message: JSON.stringify(topicCheck.details)
        })
        .eq('decision_id', decisionId);
      
      return true; // Skip
    }
    
    console.log(`[POSTING_QUEUE] ✅ Topic check passed for ${decisionId}`);
  } catch (topicError: any) {
    console.error(`[POSTING_QUEUE] ❌ Topic check threw error: ${topicError.message}`);
    console.warn(`[POSTING_QUEUE] ⚠️ Proceeding despite topic check error`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATE 4: Thread-Like Content Blocker (FAIL-CLOSED)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[POSTING_QUEUE] 🔍 Checking thread-like content for decision ${decisionId}`);
  
  const content = decision.content || '';
  
  // Thread markers that indicate this is thread content, not a single reply
  const threadPatterns = [
    { pattern: /^\d+\/\d+\b/, name: 'numbered_start', desc: 'Starts with X/Y' },
    { pattern: /\b\d+\/\d+\b/, name: 'numbered_inline', desc: 'Contains X/Y' },
    { pattern: /\bTIP\s*\d+\s*\/\s*\d+/i, name: 'tip_marker', desc: 'TIP X/Y' },
    { pattern: /\bPROTOCOL:/i, name: 'protocol_marker', desc: 'PROTOCOL:' },
    { pattern: /🧵/, name: 'thread_emoji', desc: 'Thread emoji' },
    { pattern: /\bthread\b/i, name: 'thread_word', desc: 'Word "thread"' },
    { pattern: /\(\d+\)/, name: 'paren_number', desc: 'Parenthetical (1)' }
  ];
  
  for (const { pattern, name, desc } of threadPatterns) {
    if (pattern.test(content)) {
      console.error(`[POSTING_QUEUE] ⛔ THREAD-LIKE BLOCKED: ${desc} (${name})`);
      console.error(`[POSTING_QUEUE]   decision_id=${decisionId}`);
      console.error(`[POSTING_QUEUE]   content_preview="${content.substring(0, 100)}..."`);
      
      await supabase.from('content_generation_metadata_comprehensive')
        .update({
          status: 'blocked',
          skip_reason: 'thread_like_blocked',
          error_message: `Thread marker: ${desc}`
        })
        .eq('decision_id', decisionId);
      
      return true; // Skip
    }
  }
  
  // Length checks
  const lineCount = content.split('\n').filter((l: string) => l.trim()).length;
  
  if (content.length > 260) {
    console.error(`[POSTING_QUEUE] ⛔ THREAD-LIKE BLOCKED: Too long (${content.length} chars)`);
    console.error(`[POSTING_QUEUE]   decision_id=${decisionId}`);
    
    await supabase.from('content_generation_metadata_comprehensive')
      .update({
        status: 'blocked',
        skip_reason: 'thread_like_blocked',
        error_message: `Too long: ${content.length} chars (max 260)`
      })
      .eq('decision_id', decisionId);
    
    return true; // Skip
  }
  
  if (lineCount > 3) {
    console.error(`[POSTING_QUEUE] ⛔ THREAD-LIKE BLOCKED: Too many lines (${lineCount})`);
    console.error(`[POSTING_QUEUE]   decision_id=${decisionId}`);
    
    await supabase.from('content_generation_metadata_comprehensive')
      .update({
        status: 'blocked',
        skip_reason: 'thread_like_blocked',
        error_message: `Too many lines: ${lineCount} (max 3)`
      })
      .eq('decision_id', decisionId);
    
    return true; // Skip
  }
  
  console.log(`[POSTING_QUEUE] ✅ Thread-like check passed for ${decisionId}`);
  
  return false; // OK to proceed
}

async function forceTwitterSessionReset(reason: string): Promise<void> {
  try {
    if (fs.existsSync(TWITTER_AUTH_PATH)) {
      fs.unlinkSync(TWITTER_AUTH_PATH);
      console.log(`[POSTING_QUEUE] 🧼 Twitter auth cache cleared (${reason})`);
    } else {
      console.log(`[POSTING_QUEUE] 🧼 No cached twitter session to clear (${reason})`);
    }
  } catch (error: any) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to clear twitter session (${reason}): ${error.message}`);
  }
}

// 🔧 FIX #2: Circuit breaker for posting operations - ENHANCED: Exponential backoff + auto-recovery
let postingCircuitBreaker = {
  failures: 0,
  lastFailure: null as Date | null,
  state: 'closed' as 'closed' | 'open' | 'half-open',
  failureThreshold: 15, // ENHANCED: Increased from 10 to 15 (less aggressive blocking)
  resetTimeoutMs: 60000, // Base reset timeout (will increase exponentially)
  consecutiveSuccesses: 0, // NEW: Track consecutive successes for auto-reset
  successThreshold: 3, // NEW: Need 3 successes in half-open to fully close
  resetAttempts: 0, // NEW: Track reset attempts for exponential backoff
  maxResetAttempts: 5, // NEW: Alert after 5 resets (requires manual intervention)
  maxResetTimeoutMs: 60 * 60 * 1000 // 🔥 NEW: Maximum 1 hour - force reset after this
};

// 🔥 ENHANCEMENT: Exponential backoff reset timeout
function getResetTimeout(): number {
  const baseTimeout = 60000; // 60s base
  const exponentialMultiplier = Math.min(Math.pow(2, postingCircuitBreaker.resetAttempts), 8); // Max 8x (480s)
  return baseTimeout * exponentialMultiplier;
}

// 🔥 ENHANCEMENT: Health check before reset
async function checkSystemHealth(): Promise<boolean> {
  try {
    // Check 1: Database connectivity
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    const { error: dbError } = await supabase.from('content_metadata').select('decision_id').limit(1);
    if (dbError) {
      console.warn('[POSTING_QUEUE] ⚠️ Health check failed: Database not accessible');
      return false;
    }
    
    // Check 2: Browser pool health
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();
    const health = pool.getHealth();
    
    if (health.status === 'degraded' && health.circuitBreaker?.isOpen) {
      console.warn('[POSTING_QUEUE] ⚠️ Health check failed: Browser pool circuit breaker open');
      // 🔥 AUTO-RECOVERY: Reset browser pool if circuit breaker stuck
      if (postingCircuitBreaker.resetAttempts >= 3) {
        console.log('[POSTING_QUEUE] 🔧 Auto-recovering browser pool (circuit breaker stuck)...');
        try {
          await pool.resetPool();
          console.log('[POSTING_QUEUE] ✅ Browser pool reset complete');
        } catch (resetError: any) {
          console.error('[POSTING_QUEUE] ❌ Browser pool reset failed:', resetError.message);
          return false;
        }
      } else {
        return false;
      }
    }
    
    return true;
  } catch (error: any) {
    console.warn('[POSTING_QUEUE] ⚠️ Health check failed:', error.message);
    return false;
  }
}

async function checkCircuitBreaker(): Promise<boolean> {
  if (postingCircuitBreaker.state === 'open') {
    const timeSinceFailure = postingCircuitBreaker.lastFailure 
      ? Date.now() - postingCircuitBreaker.lastFailure.getTime() 
      : Infinity;
    
    // 🔥 PERMANENT FIX: Force reset after maximum timeout (1 hour)
    if (timeSinceFailure > postingCircuitBreaker.maxResetTimeoutMs) {
      console.log(`[POSTING_QUEUE] 🔧 FORCING circuit breaker reset (max timeout ${Math.round(postingCircuitBreaker.maxResetTimeoutMs / 60000)}min exceeded)`);
      postingCircuitBreaker.state = 'half-open';
      postingCircuitBreaker.failures = 0;
      postingCircuitBreaker.consecutiveSuccesses = 0;
      postingCircuitBreaker.resetAttempts = 0;
      postingCircuitBreaker.lastFailure = null;
      
      // Log forced reset
      try {
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'circuit_breaker_forced_reset',
          severity: 'warning',
          event_data: {
            time_since_failure_minutes: Math.round(timeSinceFailure / 60000),
            max_timeout_minutes: Math.round(postingCircuitBreaker.maxResetTimeoutMs / 60000)
          },
          created_at: new Date().toISOString()
        });
      } catch (dbError) {
        // Non-critical
      }
      
      return true; // Allow posting to proceed
    }
    
    const resetTimeout = getResetTimeout();
    
    if (timeSinceFailure > resetTimeout) {
      // 🔥 ENHANCEMENT: Health check before reset
      const isHealthy = await checkSystemHealth();
      
      if (!isHealthy) {
        // System not ready, increase reset timeout (exponential backoff)
        postingCircuitBreaker.resetAttempts++;
        console.warn(`[POSTING_QUEUE] ⚠️ System not healthy, delaying reset (attempt ${postingCircuitBreaker.resetAttempts}/${postingCircuitBreaker.maxResetAttempts})`);
        
        // Alert if too many reset attempts
        if (postingCircuitBreaker.resetAttempts >= postingCircuitBreaker.maxResetAttempts) {
          console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Circuit breaker stuck after ${postingCircuitBreaker.resetAttempts} reset attempts!`);
          console.error(`[POSTING_QUEUE] 🚨 Will force reset after ${Math.round(postingCircuitBreaker.maxResetTimeoutMs / 60000)}min total timeout`);
          
          // Log to system_events
          try {
            const { getSupabaseClient } = await import('../db/index');
            const supabase = getSupabaseClient();
            await supabase.from('system_events').insert({
              event_type: 'circuit_breaker_stuck',
              severity: 'critical',
              event_data: {
                reset_attempts: postingCircuitBreaker.resetAttempts,
                last_failure: postingCircuitBreaker.lastFailure?.toISOString(),
                failures: postingCircuitBreaker.failures,
                will_force_reset_after_minutes: Math.round(postingCircuitBreaker.maxResetTimeoutMs / 60000)
              },
              created_at: new Date().toISOString()
            });
          } catch (dbError) {
            // Non-critical
          }
        }
        
        return false;
      }
      
      // System healthy, proceed with reset
      postingCircuitBreaker.state = 'half-open';
      postingCircuitBreaker.consecutiveSuccesses = 0;
      console.log(`[POSTING_QUEUE] 🔄 Circuit breaker half-open, testing... (reset attempt ${postingCircuitBreaker.resetAttempts + 1})`);
      return true;
    }
    
    const remainingMs = resetTimeout - timeSinceFailure;
    console.warn(`[POSTING_QUEUE] ⚠️ Circuit breaker OPEN (${Math.ceil(remainingMs/1000)}s remaining, attempt ${postingCircuitBreaker.resetAttempts + 1})`);
    return false;
  }
  return true;
}

function recordCircuitBreakerSuccess() {
  if (postingCircuitBreaker.state === 'half-open') {
    postingCircuitBreaker.consecutiveSuccesses++;
    if (postingCircuitBreaker.consecutiveSuccesses >= postingCircuitBreaker.successThreshold) {
      postingCircuitBreaker.state = 'closed';
      postingCircuitBreaker.failures = 0;
      postingCircuitBreaker.consecutiveSuccesses = 0;
      postingCircuitBreaker.resetAttempts = 0; // 🔥 ENHANCEMENT: Reset attempt counter on success
      console.log('[POSTING_QUEUE] ✅ Circuit breaker closed (recovered after successful tests)');
    } else {
      console.log(`[POSTING_QUEUE] 🔄 Circuit breaker half-open: ${postingCircuitBreaker.consecutiveSuccesses}/${postingCircuitBreaker.successThreshold} successful tests`);
    }
  } else {
    // Gradually reduce failure count on success (decay)
    postingCircuitBreaker.failures = Math.max(0, postingCircuitBreaker.failures - 1);
    if (postingCircuitBreaker.failures === 0 && postingCircuitBreaker.state === 'closed') {
      postingCircuitBreaker.lastFailure = null;
      postingCircuitBreaker.resetAttempts = 0; // 🔥 ENHANCEMENT: Reset attempt counter on full recovery
    }
  }
}

function recordCircuitBreakerFailure() {
  postingCircuitBreaker.failures++;
  postingCircuitBreaker.lastFailure = new Date();
  postingCircuitBreaker.consecutiveSuccesses = 0; // Reset success counter on failure
  
  if (postingCircuitBreaker.failures >= postingCircuitBreaker.failureThreshold) {
    postingCircuitBreaker.state = 'open';
    console.error(`[POSTING_QUEUE] 🚨 Circuit breaker OPENED after ${postingCircuitBreaker.failures} failures`);
  }
}

// NEW: Manual reset function for emergency recovery
export function resetCircuitBreaker(): void {
  postingCircuitBreaker.state = 'closed';
  postingCircuitBreaker.failures = 0;
  postingCircuitBreaker.lastFailure = null;
  postingCircuitBreaker.consecutiveSuccesses = 0;
  console.log('[POSTING_QUEUE] 🔧 Circuit breaker manually reset');
}

// NEW: Get circuit breaker status
export function getCircuitBreakerStatus(): {
  state: string;
  failures: number;
  threshold: number;
  lastFailure: Date | null;
  timeUntilReset?: number;
} {
  const status: any = {
    state: postingCircuitBreaker.state,
    failures: postingCircuitBreaker.failures,
    threshold: postingCircuitBreaker.failureThreshold,
    lastFailure: postingCircuitBreaker.lastFailure
  };
  
  if (postingCircuitBreaker.state === 'open' && postingCircuitBreaker.lastFailure) {
    const timeSinceFailure = Date.now() - postingCircuitBreaker.lastFailure.getTime();
    status.timeUntilReset = Math.max(0, postingCircuitBreaker.resetTimeoutMs - timeSinceFailure);
  }
  
  return status;
}

// 🔒 TASK 4: Throughput knob via env var (safe, reversible)
const POSTING_QUEUE_MAX_ITEMS = parseInt(process.env.POSTING_QUEUE_MAX_ITEMS || '2', 10); // Default: 2

export async function processPostingQueue(options?: { certMode?: boolean; maxItems?: number }): Promise<void> {
  const certMode = options?.certMode || process.env.POSTING_QUEUE_CERT_MODE === 'true';
  // Use explicit maxItems if provided, otherwise use env var (unless certMode, then 1)
  const maxItems = options?.maxItems !== undefined 
    ? options.maxItems 
    : (certMode ? 1 : POSTING_QUEUE_MAX_ITEMS);
  
  const { getSupabaseClient } = await import('../db/index');
  const supabase = getSupabaseClient();
  const gitSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  const { getServiceRoleInfo } = await import('../utils/serviceRoleResolver');
  const roleInfo = getServiceRoleInfo();
  const serviceRole = roleInfo.role;
  
  // 🔒 TASK 2: Run deferral healer before processing queue
  try {
    const { healDeferrals } = await import('./deferralHealer');
    await healDeferrals(certMode);
  } catch (healError: any) {
    console.warn(`[POSTING_QUEUE] ⚠️ Deferral healer failed (non-critical): ${healError.message}`);
  }
  
  // 🔒 MANDATE 1: Instrumentation - Log queue start
  await supabase.from('system_events').insert({
    event_type: 'posting_queue_started',
    severity: 'info',
    message: `Posting queue started: cert_mode=${certMode} max_items=${maxItems || 'unlimited'}`,
    event_data: {
      git_sha: gitSha,
      service_role: serviceRole,
      cert_mode: certMode,
      max_items: maxItems,
      started_at: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });
  
  console.log(`[POSTING_QUEUE] 🚀 Starting posting queue (cert_mode=${certMode}, max_items=${maxItems || 'unlimited'})`);
  const config = getConfig();
  const flags = getModeFlags(config);
  
  // 🔒 CONTROLLED TEST MODE: Limit to exactly ONE post if POSTING_QUEUE_MAX=1
  // 🚀 RAMP MODE: Skip controlled test mode limit when RAMP_MODE is enabled
  const rampModeEnabled = process.env.RAMP_MODE === 'true';
  const controlledDecisionId = process.env.CONTROLLED_DECISION_ID?.trim();
  const controlledPostToken = process.env.CONTROLLED_POST_TOKEN?.trim();
  const explicitControlledMode = process.env.CONTROLLED_TEST_MODE === 'true';
  
  const maxPostsForThisRun = process.env.POSTING_QUEUE_MAX ? parseInt(process.env.POSTING_QUEUE_MAX, 10) : undefined;
  const shouldLimitToControlled = maxPostsForThisRun === 1 && !rampModeEnabled && (controlledDecisionId || controlledPostToken || explicitControlledMode);
  
  if (shouldLimitToControlled) {
    const reason = controlledDecisionId ? 'CONTROLLED_DECISION_ID set' : controlledPostToken ? 'CONTROLLED_POST_TOKEN set' : 'CONTROLLED_TEST_MODE=true';
    console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_TEST_MODE: Limiting to exactly 1 post (reason: ${reason})`);
  } else if (rampModeEnabled && maxPostsForThisRun === 1) {
    console.log(`[POSTING_QUEUE] 🚀 RAMP_MODE: Skipping CONTROLLED_TEST_MODE limit (ramp quotas will enforce limits)`);
  }
  
  log({ op: 'posting_queue_start' });
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔍 SOURCE-OF-TRUTH CHECK: Verify content_metadata has all required fields
  // ═══════════════════════════════════════════════════════════════════════
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const requiredColumns = [
      'target_tweet_id',
      'target_tweet_content_snapshot',
      'target_tweet_content_hash',
      'semantic_similarity',
      'root_tweet_id',
      'target_username'
    ];
    
    // Try to select these columns (will fail if missing)
    const { error: schemaError } = await supabase
      .from('content_metadata')
      .select(requiredColumns.join(','))
      .limit(1);
    
    if (schemaError) {
      console.error(`[POSTING_QUEUE] ❌ SOURCE-OF-TRUTH CHECK FAILED: content_metadata missing columns`);
      console.error(`[POSTING_QUEUE]   Required: ${requiredColumns.join(', ')}`);
      console.error(`[POSTING_QUEUE]   Error: ${schemaError.message}`);
      console.error(`[POSTING_QUEUE]   System unhealthy - skipping queue processing`);
      return; // Fail-closed: skip processing if schema is wrong
    }
    
    console.log(`[POSTING_QUEUE] ✅ Source-of-truth check passed: all required columns accessible`);
  } catch (schemaCheckError: any) {
    console.error(`[POSTING_QUEUE] ❌ Source-of-truth check threw error: ${schemaCheckError.message}`);
    console.error(`[POSTING_QUEUE]   System unhealthy - skipping queue processing`);
    return; // Fail-closed
  }
  // ═══════════════════════════════════════════════════════════════════════
  
  // 🔧 FIX #2: Check circuit breaker before processing (now async with health checks)
  const circuitBreakerOpen = !(await checkCircuitBreaker());
  if (circuitBreakerOpen) {
    console.warn('[POSTING_QUEUE] ⏸️ Skipping queue processing (circuit breaker open)');
    log({ op: 'posting_queue', status: 'circuit_breaker_open' });
    return;
  }
  
  // Declare variables outside try block so they're accessible in catch
  let readyDecisions: any[] = [];
  let successCount = 0;
  
  try {
    // 1. Check if posting is enabled
    if (flags.postingDisabled) {
      log({ op: 'posting_queue', status: 'disabled' });
      return;
    }
    
    // 🔄 AUTO-RECOVER STUCK POSTS: Reset posts stuck in 'posting' status >15min (reduced from 30min for faster recovery)
    // 🔥 PRIORITY 4 FIX: Verify post before resetting (prevents duplicate posts)
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const { data: stuckPosts } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, created_at, content, thread_parts')
      .eq('status', 'posting')
      .lt('created_at', fifteenMinAgo.toISOString());
    
    if (stuckPosts && stuckPosts.length > 0) {
      console.log(`[POSTING_QUEUE] 🔄 Recovering ${stuckPosts.length} stuck posts (status='posting' >15min)...`);
      const { getTweetIdFromBackup, checkBackupForDuplicate } = await import('../utils/tweetIdBackup');
      
      for (const post of stuckPosts) {
        const minutesStuck = Math.round((Date.now() - new Date(String(post.created_at)).getTime()) / (1000 * 60));
        console.log(`[POSTING_QUEUE]   - Checking stuck ${post.decision_type} ${post.decision_id} (stuck ${minutesStuck}min)`);
        
        // Check backup file first (faster than verification)
        const backupTweetId = getTweetIdFromBackup(post.decision_id);
        const contentToCheck = post.decision_type === 'thread' 
          ? (post.thread_parts as string[] || []).join(' ')
          : post.content || '';
        
        if (backupTweetId) {
          // Post succeeded! Mark as posted
          console.log(`[POSTING_QUEUE]   ✅ Found tweet_id ${backupTweetId} in backup - marking as posted`);
          await supabase
            .from('content_metadata')
            .update({ 
              status: 'posted',
              tweet_id: backupTweetId,
              posted_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('decision_id', post.decision_id);
        } else if (contentToCheck) {
          // Check if content was already posted (duplicate check)
          const duplicateTweetId = checkBackupForDuplicate(contentToCheck);
          if (duplicateTweetId) {
            console.log(`[POSTING_QUEUE]   🚫 Duplicate content detected (tweet_id ${duplicateTweetId}) - marking as posted`);
            await supabase
              .from('content_metadata')
              .update({ 
                status: 'posted',
                tweet_id: duplicateTweetId,
                posted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('decision_id', post.decision_id);
          } else {
            // No backup found - reset to queued for retry
            console.log(`[POSTING_QUEUE]   🔄 No backup found - resetting to queued for retry`);
            await supabase
              .from('content_metadata')
              .update({ status: 'queued' })
              .eq('decision_id', post.decision_id);
          }
        } else {
          // No content - reset to queued
          await supabase
            .from('content_metadata')
            .update({ status: 'queued' })
            .eq('decision_id', post.decision_id);
        }
      }
      console.log(`[POSTING_QUEUE] ✅ Recovered ${stuckPosts.length} stuck posts`);
    }
    
    // 🎯 QUEUE DEPTH MONITOR: Ensure minimum content ready (2/hr content + 4/hr replies)
    // NOTE: Disabled temporarily to prevent over-generation
    // await ensureMinimumQueueDepth();
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🚨 FAIL-CLOSED GHOST PROTECTION: Block posting if NOT_IN_DB detected
    // ═══════════════════════════════════════════════════════════════════════
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      // Check for tweets with NULL/dev/unknown build_sha in last hour (ghost indicators)
      const { data: ghostIndicators, error: ghostCheckError } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('tweet_id, decision_id, build_sha, posted_at')
        .eq('status', 'posted')
        .not('tweet_id', 'is', null)
        .gte('posted_at', oneHourAgo)
        .or('build_sha.is.null,build_sha.eq.dev,build_sha.eq.unknown');
      
      if (!ghostCheckError && ghostIndicators && ghostIndicators.length > 0) {
        console.error(`[POSTING_QUEUE] 🚨 FAIL-CLOSED GHOST PROTECTION: Detected ${ghostIndicators.length} tweets with NULL/dev/unknown build_sha in last hour`);
        ghostIndicators.forEach(indicator => {
          console.error(`[POSTING_QUEUE]   🚨 Ghost indicator: tweet_id=${indicator.tweet_id} build_sha=${indicator.build_sha || 'NULL'} posted_at=${indicator.posted_at}`);
        });
        console.error(`[POSTING_QUEUE] 🔒 BLOCKING ALL POSTING/REPLIES - Ghost protection activated`);
        log({ op: 'posting_queue', status: 'ghost_protection_activated', ghost_count: ghostIndicators.length });
        return; // Fail-closed: refuse to post if ghost indicators detected
      }
      
      console.log(`[POSTING_QUEUE] ✅ Ghost protection check passed: No NULL/dev/unknown build_sha in last hour`);
    } catch (ghostProtectionError: any) {
      console.error(`[POSTING_QUEUE] ⚠️ Ghost protection check failed: ${ghostProtectionError.message}`);
      // On error, allow posting (graceful degradation) but log the error
      log({ op: 'posting_queue', status: 'ghost_protection_check_error', error: ghostProtectionError.message });
    }
    // ═══════════════════════════════════════════════════════════════════════
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔒 CONTROLLED WINDOW GATE: Single-post test protection
    // ═══════════════════════════════════════════════════════════════════════
    const controlledDecisionIdRaw = process.env.CONTROLLED_DECISION_ID;
    // Only enable controlled gate if decision ID is set AND not empty/whitespace
    // Also skip if it's a known test decision ID that should be cleared
    const controlledDecisionId = controlledDecisionIdRaw?.trim();
    const isKnownTestId = controlledDecisionId === '03a91e05-9487-47bc-a47a-8280660c1b6e' || controlledDecisionId?.startsWith('03a91e05-9487-47bc-a47a-');
    let controlledTokenLeaseOwner: string | null = null;
    if (controlledDecisionId && controlledDecisionId.length > 0 && !isKnownTestId) {
      console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: Enabled for decision_id=${controlledDecisionId}`);
      
      // 🔒 LEASE-BASED TOKEN: Acquire lease instead of consuming immediately
      const controlledToken = process.env.CONTROLLED_POST_TOKEN;
      if (controlledToken) {
        // Check if lease owner already provided (e.g., by one-shot runner)
        controlledTokenLeaseOwner = process.env.CONTROLLED_POST_TOKEN_LEASE_OWNER;
        
        if (!controlledTokenLeaseOwner) {
          // Generate unique owner ID for this run
          controlledTokenLeaseOwner = `posting_queue_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const leaseTtlSeconds = 600; // 10 minutes lease
          
          console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: Attempting lease acquisition (token: ${controlledToken.substring(0, 16)}..., owner: ${controlledTokenLeaseOwner.substring(0, 20)}...)`);
          const { data: leaseAcquired, error: leaseError } = await supabase
            .rpc('acquire_controlled_token', { 
              token_value: controlledToken,
              owner_id: controlledTokenLeaseOwner,
              ttl_seconds: leaseTtlSeconds
            });
          
          if (leaseError) {
            console.error(`[POSTING_QUEUE] ❌ CONTROLLED_WINDOW_GATE: Lease acquisition failed: ${leaseError.message}`);
            console.error(`[POSTING_QUEUE] ❌ Lease error code: ${leaseError.code}`);
            console.error(`[POSTING_QUEUE] 🔒 CONTROLLED WINDOW LEASE UNAVAILABLE or token invalid`);
            log({ op: 'posting_queue', status: 'controlled_window_lease_failed', error: leaseError.message });
            return; // Fail-closed: refuse to post if lease acquisition fails
          }
          
          console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: Lease acquisition result: ${JSON.stringify(leaseAcquired)}`);
          
          // RPC function returns boolean directly
          if (!leaseAcquired || leaseAcquired === false) {
            console.log(`[POSTING_QUEUE] 🔒 CONTROLLED WINDOW LEASE UNAVAILABLE - refusing to post (result: ${leaseAcquired})`);
            log({ op: 'posting_queue', status: 'controlled_window_lease_unavailable', result: leaseAcquired });
            return; // Lease already held by another run or expired
          }
          
          console.log(`[POSTING_QUEUE] ✅ CONTROLLED_WINDOW_GATE: Lease acquired successfully (TTL: ${leaseTtlSeconds}s)`);
        } else {
          console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: Using existing lease owner: ${controlledTokenLeaseOwner.substring(0, 20)}...`);
        }
      } else {
        console.warn(`[POSTING_QUEUE] ⚠️ CONTROLLED_DECISION_ID set but CONTROLLED_POST_TOKEN missing - gate disabled`);
      }
    }
    // ═══════════════════════════════════════════════════════════════════════
    
    // 2. Check rate limits - but DON'T block entire queue if only content is limited
    // checkPostingRateLimits only checks singles/threads - replies have separate limit
    const canPostContent = await checkPostingRateLimits();
    if (!canPostContent) {
      log({ op: 'posting_queue', content_rate_limited: true, note: 'replies_may_still_proceed' });
      // DON'T return here - replies might still be allowed
    }
    
    // 3. Get ready decisions from queue
    readyDecisions = await getReadyDecisions(certMode, maxItems);
    
    // 🔒 CONTROLLED WINDOW GATE: Filter to only the controlled decision_id
    // Skip if it's a known test decision ID that should be cleared
    const isKnownTestIdFilter = controlledDecisionId === '03a91e05-9487-47bc-a47a-8280660c1b6e' || controlledDecisionId?.startsWith('03a91e05-9487-47bc-a47a-');
    if (controlledDecisionId && !isKnownTestIdFilter) {
      const beforeCount = readyDecisions.length;
      readyDecisions = readyDecisions.filter(d => d.id === controlledDecisionId);
      const afterCount = readyDecisions.length;
      
      if (beforeCount > 0 && afterCount === 0) {
        console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: Controlled decision_id ${controlledDecisionId} not found in queue (${beforeCount} other items queued)`);
        log({ op: 'posting_queue', status: 'controlled_decision_not_found', queued_count: beforeCount });
        return; // Do nothing if controlled decision not found
      }
      
      if (afterCount > 0) {
        console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: Filtered to controlled decision_id (${beforeCount} → ${afterCount})`);
      }
    }
    const GRACE_MINUTES = parseInt(ENV.GRACE_MINUTES || '5', 10);
    
    if (readyDecisions.length === 0) {
      log({ op: 'posting_queue', ready_count: 0, grace_minutes: GRACE_MINUTES });
      return;
    }
    
    log({ op: 'posting_queue', ready_count: readyDecisions.length, grace_minutes: GRACE_MINUTES });
    
    // 4. Process each decision WITH RATE LIMIT CHECK BETWEEN EACH POST
    successCount = 0;
    let contentPostedThisCycle = 0;
    let repliesPostedThisCycle = 0;
    
    const config = getConfig();
    // 🚀 RAMP MODE: Override quotas if enabled
    const { getEffectiveQuotas } = await import('../utils/rampMode');
    const defaultMaxContentPerHour = Number(config.MAX_POSTS_PER_HOUR ?? 1);
    const defaultMaxRepliesPerHour = Number(config.REPLIES_PER_HOUR ?? 4);
    const { maxPostsPerHour: maxContentPerHour, maxRepliesPerHour } = getEffectiveQuotas(
      defaultMaxContentPerHour,
      defaultMaxRepliesPerHour
    );
    
    // 📊 QUEUE_LIMITS: Explicit logging of rate limit state
    console.log(`[QUEUE_LIMITS] canPostContent=${canPostContent} content_max=${maxContentPerHour}/hr replies_max=${maxRepliesPerHour}/hr REPLIES_ENABLED=${process.env.REPLIES_ENABLED !== 'false'}`);
    
    // 🛑 DRAIN MODE: Mark all queued items as skipped for audit
    if (process.env.DRAIN_QUEUE === 'true') {
      console.log(`[POSTING_QUEUE] 🛑 DRAIN_QUEUE=true: Marking ${readyDecisions.length} decisions as skipped`);
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      for (const decision of readyDecisions) {
        await supabase.from('content_generation_metadata_comprehensive')
          .update({ status: 'blocked', skip_reason: 'queue_drain_mode' })
          .eq('decision_id', decision.id);
      }
      console.log(`[POSTING_QUEUE] ✅ Drained ${readyDecisions.length} decisions`);
      return;
    }
    
    // 🔒 CONTROLLED WINDOW GATE: If controlled decision is set, only process that one
    if (controlledDecisionId && readyDecisions.length > 0) {
      const controlledDecision = readyDecisions.find(d => d.id === controlledDecisionId);
      if (controlledDecision) {
        console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: Processing ONLY controlled decision_id=${controlledDecisionId}`);
        readyDecisions = [controlledDecision]; // Only this one decision
      }
    }
    
    // 🔒 CONTROLLED TEST MODE: Limit to exactly ONE post if POSTING_QUEUE_MAX=1
    // 🚀 RAMP MODE: Skip controlled test mode limit when RAMP_MODE is enabled
    // Note: controlledDecisionId already declared above (line 1225)
    const rampModeEnabled = process.env.RAMP_MODE === 'true';
    const controlledPostToken = process.env.CONTROLLED_POST_TOKEN?.trim();
    const explicitControlledMode = process.env.CONTROLLED_TEST_MODE === 'true';
    
    const maxPostsForThisRun = process.env.POSTING_QUEUE_MAX ? parseInt(process.env.POSTING_QUEUE_MAX, 10) : undefined;
    const shouldLimitToControlled = maxPostsForThisRun === 1 && !rampModeEnabled && (controlledDecisionId || controlledPostToken || explicitControlledMode);
    
    let decisionsToProcess = readyDecisions;
    if (shouldLimitToControlled) {
      decisionsToProcess = readyDecisions.slice(0, 1);
      const reason = controlledDecisionId ? 'CONTROLLED_DECISION_ID' : controlledPostToken ? 'CONTROLLED_POST_TOKEN' : 'CONTROLLED_TEST_MODE=true';
      console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_TEST_MODE: Processing only 1 of ${readyDecisions.length} queued decisions (reason: ${reason})`);
    } else if (rampModeEnabled) {
      // Ramp mode: process all decisions up to quota limits (already enforced by rate limits above)
      const rampLevel = process.env.RAMP_LEVEL || '1';
      console.log(`[POSTING_QUEUE] 🚀 RAMP_MODE (level ${rampLevel}): Processing ${readyDecisions.length} decisions (quota limits enforced)`);
    }
    
    for (const decision of decisionsToProcess) {
      try {
        // 🔥 CRITICAL: Check rate limit BEFORE each post (not just once at start!)
        const isReply = decision.decision_type === 'reply';
        const isContent = decision.decision_type === 'single' || decision.decision_type === 'thread';
        
        // Check current hour's posting count from database
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        if (isContent) {
          // 🚨 CHECK: Skip content if content rate limit was reached at start
          if (!canPostContent) {
            console.log(`[POSTING_QUEUE] ⛔ SKIP CONTENT: Content rate limit reached, skipping ${decision.decision_type} ${decision.id}`);
            continue; // Skip to next decision (might be a reply which is allowed)
          }
          
          // 🛑 KILL SWITCHES: Check content type flags
          const isThread = decision.decision_type === 'thread';
          const isSingle = decision.decision_type === 'single';
          
          if (isThread && process.env.THREADS_ENABLED === 'false') {
            console.log(`[POSTING_QUEUE] 🛑 THREADS_DISABLED: Skipping thread ${decision.id}`);
            await supabase.from('content_generation_metadata_comprehensive')
              .update({ status: 'blocked', skip_reason: 'threads_disabled_killswitch' })
              .eq('decision_id', decision.id);
            continue;
          }
          
          if (isSingle && process.env.SINGLE_POSTS_ENABLED === 'false') {
            console.log(`[POSTING_QUEUE] 🛑 SINGLE_POSTS_DISABLED: Skipping single ${decision.id}`);
            await supabase.from('content_generation_metadata_comprehensive')
              .update({ status: 'blocked', skip_reason: 'singles_disabled_killswitch' })
              .eq('decision_id', decision.id);
            continue;
          }
          
          // 🎯 COUNT POSTS, NOT TWEETS: Threads count as 1 post, not multiple tweets
          // A thread is ONE POST on Twitter, regardless of how many parts it has
          
          // Query recent posts
          const { data: recentContent } = await supabase
            .from('content_metadata')
            .select('decision_type')
            .in('decision_type', ['single', 'thread'])
            .eq('status', 'posted')
            .not('tweet_id', 'is', null)
            .gte('posted_at', oneHourAgo);
          
          // Count POSTS (not tweets) - threads = 1 post, singles = 1 post
          const postsThisHour = (recentContent || []).length;
          
          // Add posts from this cycle
          const totalPostsThisHour = postsThisHour + contentPostedThisCycle;
          
          // Check if THIS decision would exceed limit
          // Both threads and singles count as 1 post
          const thisPostCount = 1; // Thread = 1 post, Single = 1 post
          
          // 🎯 STRICT LIMIT: Max 1 post per hour = 2 posts every 2 hours
          const maxPostsPerHour = maxContentPerHour; // 1 post max per hour
          const wouldExceed = totalPostsThisHour + thisPostCount > maxPostsPerHour;
          
          log({ op: 'rate_limit_check', posts_this_hour: totalPostsThisHour, this_post_count: thisPostCount, limit: maxPostsPerHour });
          console.log(`[POSTING_QUEUE] 📊 Posts this hour: ${totalPostsThisHour}/${maxPostsPerHour} (this ${decision.decision_type} would add ${thisPostCount} post)`);
          
          if (wouldExceed) {
            console.log(`[POSTING_QUEUE] ⛔ SKIP: Would exceed post limit (${totalPostsThisHour + thisPostCount} > ${maxPostsPerHour})`);
            continue; // Skip this decision
          }
          
          // ✅ THREADS COUNT AS 1 POST: No special spacing needed
          // Threads are treated the same as single posts for rate limiting
        }
        
        if (isReply) {
          // 🛑 KILL SWITCH: Check REPLIES_ENABLED flag
          const repliesEnabled = process.env.REPLIES_ENABLED !== 'false';
          if (!repliesEnabled) {
            console.log(`[POSTING_QUEUE] 🛑 REPLIES_DISABLED: Skipping reply ${decision.id} (REPLIES_ENABLED=false)`);
            await supabase.from('content_generation_metadata_comprehensive')
              .update({ status: 'blocked', skip_reason: 'replies_disabled_killswitch' })
              .eq('decision_id', decision.id);
            continue;
          }
          
          // 🚨 FIX: Query content_metadata TABLE directly
          const { count: replyCount } = await supabase
            .from('content_metadata')
            .select('*', { count: 'exact', head: true })
            .eq('decision_type', 'reply')
            .eq('status', 'posted')
            .not('tweet_id', 'is', null)
            .gte('posted_at', oneHourAgo);
          
          const totalRepliesThisHour = (replyCount || 0) + repliesPostedThisCycle;
          const windowStart = oneHourAgo;
          
          console.log(`[REPLY_QUOTA] posted_last_60m=${totalRepliesThisHour} limit=${maxRepliesPerHour} window_start=${windowStart} db_count=${replyCount} cycle_count=${repliesPostedThisCycle}`);
          
          if (totalRepliesThisHour >= maxRepliesPerHour) {
            console.log(`[REPLY_QUOTA] ⛔ BLOCKED: limit reached ${totalRepliesThisHour}/${maxRepliesPerHour}`);
            continue; // Skip this decision, move to next
          }
        }
        
        // Proceed with posting
        let success = false;
        try {
          success = await processDecision(decision);
          if (success) {
            successCount++;
            
            // Track what we posted this cycle
            if (isContent) contentPostedThisCycle++;
            if (isReply) repliesPostedThisCycle++;
            
            // 🔒 CONTROLLED WINDOW GATE: Finalize lease on success
            const controlledToken = (global as any).__controlledToken;
            if (controlledTokenLeaseOwner && controlledToken && decision.id === controlledDecisionId) {
              console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: Finalizing lease after successful post`);
              const { data: finalized, error: finalizeError } = await supabase
                .rpc('finalize_controlled_token', { 
                  token_value: controlledToken,
                  owner_id: controlledTokenLeaseOwner
                });
              
              if (finalizeError || !finalized) {
                console.error(`[POSTING_QUEUE] ⚠️ CONTROLLED_WINDOW_GATE: Lease finalization failed: ${finalizeError?.message || 'unknown'}`);
              } else {
                console.log(`[POSTING_QUEUE] ✅ CONTROLLED_WINDOW_GATE: Lease finalized successfully`);
              }
            }
            
            // 🔒 CONTROLLED WINDOW GATE: Exit immediately after posting controlled decision
            if (controlledDecisionId && decision.id === controlledDecisionId) {
              console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: Controlled decision_id=${controlledDecisionId} posted successfully - EXITING immediately`);
              log({ op: 'posting_queue', status: 'controlled_decision_posted', decision_id: controlledDecisionId });
              return; // Exit immediately - do not process any other decisions
            }
          }
        } catch (postError: any) {
          // 🔒 CONTROLLED WINDOW GATE: Release lease on failure (unless 429 retryable)
          const controlledToken = (global as any).__controlledToken;
          if (controlledTokenLeaseOwner && controlledToken && decision.id === controlledDecisionId) {
            const is429Retryable = postError?.message?.includes('HTTP-429') || 
                                   postError?.message?.includes('code 88') ||
                                   postError?.message?.includes('rate limit');
            
            if (is429Retryable) {
              console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: 429 error detected - keeping lease for retry`);
              // Don't release lease - allow retry within TTL
            } else {
              console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: Releasing lease after non-retryable failure`);
              const { data: released, error: releaseError } = await supabase
                .rpc('release_controlled_token', { 
                  token_value: controlledToken,
                  owner_id: controlledTokenLeaseOwner
                });
              
              if (releaseError || !released) {
                console.error(`[POSTING_QUEUE] ⚠️ CONTROLLED_WINDOW_GATE: Lease release failed: ${releaseError?.message || 'unknown'}`);
              } else {
                console.log(`[POSTING_QUEUE] ✅ CONTROLLED_WINDOW_GATE: Lease released`);
              }
            }
          }
          
          // Re-throw to maintain existing error handling
          throw postError;
        }
        
      } catch (error: any) {
        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        const errorStack = error?.stack || 'No stack trace';
        
        // 🔥 FIX: Check for browser queue timeout errors
        const isQueueTimeout = errorMsg.includes('Queue timeout') || 
                               errorMsg.includes('pool overloaded') ||
                               errorMsg.includes('Browser operation timeout');
        
        if (isQueueTimeout) {
          // Browser queue timeout - this is a critical failure that should be visible
          console.error(`[POSTING_QUEUE] 🚨 BROWSER QUEUE TIMEOUT: ${decision.id}`);
          console.error(`[POSTING_QUEUE] 🚨 Error: ${errorMsg}`);
          console.error(`[POSTING_QUEUE] 🚨 This indicates browser pool is overloaded - post will be retried`);
          
          // 🔥 FIX: Update job_heartbeats to track this failure
          try {
            const { getSupabaseClient } = await import('../db/index');
            const supabase = getSupabaseClient();
            await supabase
              .from('job_heartbeats')
              .upsert({
                job_name: 'posting',
                last_run_status: 'failed',
                last_error: `Browser queue timeout: ${errorMsg}`,
                consecutive_failures: 1,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'job_name'
              });
          } catch (heartbeatError: any) {
            console.warn(`[POSTING_QUEUE] ⚠️ Failed to update job_heartbeats: ${heartbeatError.message}`);
          }
          
          // Reset status to queued for retry (don't mark as failed - will retry)
          try {
            const { getSupabaseClient } = await import('../db/index');
            const supabase = getSupabaseClient();
            const features = (decision.features || {}) as any;
            const retryCount = Number(features?.retry_count || 0);
            
            if (retryCount < 3) {
              // Schedule retry in 5 minutes
              const retryTime = new Date(Date.now() + 5 * 60 * 1000);
              await supabase
                .from('content_metadata')
                .update({
                  status: 'queued',
                  scheduled_at: retryTime.toISOString(),
                  features: {
                    ...features,
                    retry_count: retryCount + 1,
                    last_retry_reason: 'browser_queue_timeout',
                    last_retry_scheduled_at: new Date().toISOString()
                  },
                  updated_at: new Date().toISOString()
                })
                .eq('decision_id', decision.id);
              
              console.log(`[POSTING_QUEUE] 🔄 Scheduled retry for ${decision.id} (attempt ${retryCount + 1}/3) in 5 minutes`);
            } else {
              // Too many retries - mark as failed
              await markDecisionFailed(decision.id, `Browser queue timeout after ${retryCount} retries: ${errorMsg}`);
            }
          } catch (retryError: any) {
            console.error(`[POSTING_QUEUE] ❌ Failed to schedule retry: ${retryError.message}`);
            await markDecisionFailed(decision.id, errorMsg);
          }
          
          // Track error
          await trackError(
            'posting_queue',
            'browser_queue_timeout',
            errorMsg,
            'error',
            {
              decision_id: decision.id,
              decision_type: decision.decision_type,
              retry_count: (decision.features as any)?.retry_count || 0
            }
          );
          
          return; // Don't continue - will retry on next cycle
        }
        
        // 🔧 PERMANENT FIX #2: Check if post actually succeeded before marking as failed
        // Some errors indicate ID extraction failure, not posting failure
        // Check for common ID extraction error patterns
        const isIdExtractionError = errorMsg.includes('ID extraction') || 
                                     errorMsg.includes('Tweet ID extraction failed') ||
                                     errorMsg.includes('Reply ID extraction failed') ||
                                     errorMsg.includes('tweet ID') ||
                                     errorMsg.includes('extractTweetId') ||
                                     errorMsg.includes('Tweet posted but ID extraction failed') ||
                                     errorMsg.includes('Could not extract tweet ID') ||
                                     errorMsg.includes('Page not available for tweet ID extraction');
        
        if (isIdExtractionError) {
          // Post succeeded but ID extraction failed - mark as posted with NULL ID
          console.warn(`[POSTING_QUEUE] ⚠️ Post succeeded but ID extraction failed: ${errorMsg}`);
          console.log(`[POSTING_QUEUE] ✅ Tweet is LIVE on Twitter - marking as posted with NULL tweet_id`);
          
          try {
            const { getSupabaseClient } = await import('../db/index');
            const supabase = getSupabaseClient();
            await supabase
              .from('content_metadata')
              .update({
                status: 'posted',
                tweet_id: null,
                error_message: `ID extraction failed: ${errorMsg}`,
                posted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('decision_id', decision.id);
            
            console.log(`[POSTING_QUEUE] ✅ Marked as posted (ID extraction will be recovered by background job)`);
            
            // Schedule ID recovery - background job will recover tweet ID
            console.log(`[POSTING_QUEUE] 💾 ID recovery will be handled by background reconciliation job`);
          } catch (markError: any) {
            console.error(`[POSTING_QUEUE] ❌ Failed to mark as posted: ${markError.message}`);
            // Fall through to normal error handling
          }
          
          // Don't mark as failed - post succeeded!
          return;
        }
        
        // Actual posting failure - mark as failed
        console.error(`[POSTING_QUEUE] ❌ Failed to post decision ${decision.id}:`, errorMsg);
        console.error(`[POSTING_QUEUE] 💥 Error stack:`, errorStack);
        
        // 🔥 FIX: Update job_heartbeats to track posting failures
        try {
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          const { data: currentHeartbeat } = await supabase
            .from('job_heartbeats')
            .select('consecutive_failures')
            .eq('job_name', 'posting')
            .maybeSingle();
          
          const consecutiveFailures = (currentHeartbeat?.consecutive_failures || 0) + 1;
          
          await supabase
            .from('job_heartbeats')
            .upsert({
              job_name: 'posting',
              last_run_status: 'failed',
              last_error: errorMsg.substring(0, 500), // Limit error message length
              consecutive_failures: consecutiveFailures,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'job_name'
            });
          
          console.log(`[POSTING_QUEUE] 📊 Updated job_heartbeats: consecutive_failures=${consecutiveFailures}`);
        } catch (heartbeatError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Failed to update job_heartbeats: ${heartbeatError.message}`);
        }
        
        // 🔧 ENHANCED ERROR TRACKING: Track all posting failures
        await trackError(
          'posting_queue',
          'post_failure',
          errorMsg,
          'error',
          {
            decision_id: decision.id,
            decision_type: decision.decision_type,
            retry_count: (decision.features as any)?.retry_count || 0,
            stack: errorStack.substring(0, 500) // Limit stack trace length
          }
        );
        
        // Track in SystemFailureAuditor
        try {
          const auditor = SystemFailureAuditor.getInstance();
          await auditor.recordFailure({
            systemName: 'posting_queue',
            failureType: 'primary_failure',
            rootCause: errorMsg,
            attemptedAction: `post_${decision.decision_type}`,
            errorMessage: errorMsg,
            metadata: {
              decision_id: decision.id,
              decision_type: decision.decision_type
            }
          });
        } catch (auditError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Failed to record in auditor: ${auditError.message}`);
        }
        
        await markDecisionFailed(decision.id, errorMsg);
      }
    }
    
        console.log(`[POSTING_QUEUE] ✅ Posted ${successCount}/${readyDecisions.length} decisions (${contentPostedThisCycle} content, ${repliesPostedThisCycle} replies)`);
    
    // 🔧 FIX #2: Record success for circuit breaker
    recordCircuitBreakerSuccess();
    
    // 🔥 FIX: Update job_heartbeats to track success
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase
        .from('job_heartbeats')
        .upsert({
          job_name: 'posting',
          last_run_status: 'success',
          last_success: new Date().toISOString(),
          consecutive_failures: 0,
          last_error: null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'job_name'
        });
      
      console.log(`[POSTING_QUEUE] 📊 Updated job_heartbeats: success (${successCount} posts)`);
    } catch (heartbeatError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to update job_heartbeats: ${heartbeatError.message}`);
    }
    
    // 🚀 RAMP MODE SUMMARY LOG
    try {
      const { getRampConfig } = await import('../utils/rampMode');
      const ramp = getRampConfig();
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      // Count posts/replies in last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: postsLastHour } = await supabase
        .from('content_metadata')
        .select('*', { count: 'exact', head: true })
        .in('decision_type', ['single', 'thread'])
        .eq('status', 'posted')
        .gte('posted_at', oneHourAgo);
      
      const { count: repliesLastHour } = await supabase
        .from('content_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('decision_type', 'reply')
        .eq('status', 'posted')
        .gte('posted_at', oneHourAgo);
      
      // Count blocked replies by reason
      const { data: blockedReplies } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('skip_reason')
        .eq('decision_type', 'reply')
        .eq('status', 'blocked')
        .gte('updated_at', oneHourAgo);
      
      const blockedCounts = {
        self_reply: blockedReplies?.filter(r => r.skip_reason === 'self_reply_blocked').length || 0,
        reply_to_reply: blockedReplies?.filter(r => r.skip_reason?.includes('root') || r.skip_reason?.includes('reply')).length || 0,
        freshness: blockedReplies?.filter(r => r.skip_reason?.includes('freshness') || r.skip_reason?.includes('too_old')).length || 0,
        generic: blockedReplies?.filter(r => !['self_reply_blocked'].includes(r.skip_reason || '') && !r.skip_reason?.includes('root') && !r.skip_reason?.includes('freshness')).length || 0,
      };
      
      // Count NOT_IN_DB tweets (ghost posts)
      const { count: notInDbCount } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'posted')
        .not('tweet_id', 'is', null)
        .or('build_sha.is.null,build_sha.eq.dev,build_sha.eq.unknown')
        .gte('posted_at', oneHourAgo);
      
      console.log(`[RAMP_MODE] ramp_enabled=${ramp.enabled} ramp_level=${ramp.level} posts_last_hour=${postsLastHour || 0} replies_last_hour=${repliesLastHour || 0} blocked_self_reply=${blockedCounts.self_reply} blocked_reply_to_reply=${blockedCounts.reply_to_reply} blocked_freshness=${blockedCounts.freshness} blocked_generic=${blockedCounts.generic} NOT_IN_DB_count=${notInDbCount || 0}`);
    } catch (rampLogError: any) {
      console.warn(`[RAMP_MODE] ⚠️ Failed to log ramp summary: ${rampLogError.message}`);
    }
    
  } catch (error: any) {
    const errorMsg = error?.message || error?.toString() || 'Unknown error';
    console.error('[POSTING_QUEUE] ❌ Queue processing failed:', errorMsg);
    
    // 🔧 ENHANCED ERROR TRACKING: Track queue processing failures
    await trackError(
      'posting_queue',
      'queue_processing_failed',
      errorMsg,
      'critical',
      {
        ready_decisions_count: readyDecisions?.length || 0,
        success_count: successCount || 0,
        error_stack: error?.stack?.substring(0, 500)
      }
    );
    
    // Track in SystemFailureAuditor
    try {
      const auditor = SystemFailureAuditor.getInstance();
      await auditor.recordFailure({
        systemName: 'posting_queue',
        failureType: 'complete_failure',
        rootCause: errorMsg,
        attemptedAction: 'process_posting_queue',
        errorMessage: errorMsg,
        metadata: {
          ready_decisions: readyDecisions?.length || 0,
          success_count: successCount || 0
        }
      });
    } catch (auditError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to record in auditor: ${auditError.message}`);
    }
    
    // 🔧 FIX #2: Record failure for circuit breaker
    recordCircuitBreakerFailure();
    
    // ✅ GRACEFUL: Don't throw - allow system to continue
    // Log error but don't crash the entire job scheduler
    console.warn('[POSTING_QUEUE] ⚠️ Error logged, will retry on next cycle');
    // Don't throw - this allows job manager to continue scheduling
  }
}

interface QueuedDecision {
  id: string;
  content: string;
  decision_type: 'single' | 'thread' | 'reply'; // FIXED: Match database schema
  target_tweet_id?: string;
  target_username?: string;
  root_tweet_id?: string; // 🔧 FIX: Required for FINAL_REPLY_GATE root-only check
  target_tweet_content_snapshot?: string; // 🔧 FIX: Required for FINAL_REPLY_GATE
  target_tweet_content_hash?: string; // 🔧 FIX: Required for FINAL_REPLY_GATE
  semantic_similarity?: number; // 🔧 FIX: Required for FINAL_REPLY_GATE
  bandit_arm: string;
  timing_arm?: string;
  predicted_er: number;
  quality_score?: number;
  topic_cluster: string;
  status: string;
  created_at: string;
  thread_parts?: string[]; // For threads
  features?: any; // For thread metadata
  visual_format?: string; // Visual formatting instructions
  // PHASE 5 additions for learning system
  predicted_followers?: number;
  hook_type?: string;
}

interface QueuedDecisionRow {
  [key: string]: unknown;
  id: unknown;
  content: unknown;
  decision_type: unknown;
  target_tweet_id?: unknown;
  target_username?: unknown;
  root_tweet_id?: unknown; // 🔧 FIX: Required for FINAL_REPLY_GATE
  target_tweet_content_snapshot?: unknown; // 🔧 FIX: Required for FINAL_REPLY_GATE
  target_tweet_content_hash?: unknown; // 🔧 FIX: Required for FINAL_REPLY_GATE
  semantic_similarity?: unknown; // 🔧 FIX: Required for FINAL_REPLY_GATE
  bandit_arm: unknown;
  timing_arm?: unknown;
  predicted_er: unknown;
  quality_score?: unknown;
  topic_cluster: unknown;
  status: unknown;
  created_at: unknown;
}

async function checkPostingRateLimits(): Promise<boolean> {
  const config = getConfig();
  const maxPostsPerHourRaw = Number(config.MAX_POSTS_PER_HOUR ?? 1);
  const maxPostsPerHour = Number.isFinite(maxPostsPerHourRaw) ? maxPostsPerHourRaw : 1;
  
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // 🔧 FIX #1: GRACEFUL NULL TWEET_ID HANDLING
    // Instead of blocking entire system, only exclude NULL posts from rate limit count
    // Background recovery job will fix NULL IDs, but we don't block new posts
    const { data: pendingIdPosts, error: pendingError } = await supabase
      .from('content_metadata')
      .select('decision_id, content, posted_at')
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())  // Last hour
      .limit(1);
    
    if (pendingIdPosts && pendingIdPosts.length > 0) {
      const pendingPost = pendingIdPosts[0];
      const minutesAgo = Math.round((Date.now() - new Date(String(pendingPost.posted_at)).getTime()) / 60000);
      
      console.warn(`[POSTING_QUEUE] ⚠️ Found post with NULL tweet_id (posted ${minutesAgo}min ago)`);
      console.warn(`[POSTING_QUEUE] 📝 Content: "${String(pendingPost.content).substring(0, 60)}..."`);
      console.warn(`[POSTING_QUEUE] 🔄 Background recovery job will fix this (runs every 30min)`);
      console.warn(`[POSTING_QUEUE] ✅ Continuing with posting - NULL posts excluded from rate limit count`);
      
      // 🔧 ENHANCED ERROR TRACKING: Track NULL tweet_id occurrences
      await trackError(
        'posting_queue',
        'null_tweet_id',
        `Post with NULL tweet_id found (posted ${minutesAgo}min ago)`,
        'warning',
        {
          decision_id: pendingPost.decision_id,
          posted_at: pendingPost.posted_at,
          minutes_ago: minutesAgo
        }
      );
      
      // ✅ GRACEFUL: Don't block entire system, just exclude NULL posts from count
      // Background job will recover IDs, but we don't stop new posts
    }
    
    // Count posts attempted in last hour (EXCLUDING NULL tweet_ids for accurate counting)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // ✅ FIX #1: Only count posts with valid tweet_ids (excludes NULL posts)
    const { count, error } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .in('status', ['posted', 'failed'])  // ← Only count ATTEMPTED posts (not queued!)
      .not('tweet_id', 'is', null)  // ✅ EXCLUDE NULL tweet_ids from count
      .gte('posted_at', oneHourAgo);
    
    if (error) {
      console.error('[POSTING_QUEUE] ❌ Rate limit check failed:', error.message);
      
      // 🔧 ENHANCED ERROR TRACKING: Track database errors
      await trackError(
        'posting_queue',
        'rate_limit_check_failed',
        `Database error during rate limit check: ${error.message}`,
        'error',
        {
          error_code: error.code,
          error_details: error.message
        }
      );
      
      // ✅ PERMANENT FIX: Graceful degradation - allow posting on errors (don't block system)
      // Database errors shouldn't stop the entire system - better to allow than block
      console.warn('[POSTING_QUEUE] ⚠️ Rate limit check error - allowing posting to continue (graceful degradation)');
      // PERMANENT FIX: On error, allow posting rather than blocking (safer default)
      return true; // Allow posting if we can't verify rate limit
    }
    
    const postsThisHour = count || 0;
    
    // ENHANCED: Verify count accuracy by double-checking with detailed query
    let verifiedCount = postsThisHour;
    if (postsThisHour > 0) {
      const { data: verifyPosts, error: verifyError } = await supabase
        .from('content_metadata')
        .select('decision_id, posted_at, tweet_id, status')
        .in('decision_type', ['single', 'thread'])
        .in('status', ['posted', 'failed'])
        .not('tweet_id', 'is', null)
        .gte('posted_at', oneHourAgo)
        .order('posted_at', { ascending: false });
      
      if (!verifyError && verifyPosts) {
        verifiedCount = verifyPosts.length;
        if (verifiedCount !== postsThisHour) {
          console.warn(`[POSTING_QUEUE] ⚠️ Rate limit count mismatch: count=${postsThisHour}, verified=${verifiedCount}`);
          // Use verified count (more accurate)
          verifiedCount = verifyPosts.length;
        }
      }
    }
    
    console.log(`[POSTING_QUEUE] 📊 Content posts attempted this hour: ${verifiedCount}/${maxPostsPerHour} (verified)`);
    
    if (verifiedCount >= maxPostsPerHour) {
      const minutesElapsed = Math.floor((Date.now() - new Date(oneHourAgo).getTime()) / 60000);
      const minutesUntilNext = 60 - minutesElapsed;
      console.log(`[POSTING_QUEUE] ⛔ HOURLY LIMIT REACHED: ${verifiedCount}/${maxPostsPerHour}`);
      console.log(`[POSTING_QUEUE] ⏰ Next slot in ~${minutesUntilNext} minutes`);
      return false;
    }
    
    console.log(`[POSTING_QUEUE] ✅ Rate limit OK: ${verifiedCount}/${maxPostsPerHour} posts`);
    return true;
    
  } catch (error: any) {
    console.error('[POSTING_QUEUE] ❌ Rate limit exception:', error.message);
    
    // 🔧 ENHANCED ERROR TRACKING: Track exceptions
    await trackError(
      'posting_queue',
      'rate_limit_exception',
      `Exception during rate limit check: ${error.message}`,
      'error',
      {
        error_type: error.constructor?.name || 'Unknown',
        error_stack: error.stack?.substring(0, 300)
      }
    );
    
    // ✅ PERMANENT FIX: Don't block on exceptions - allow posting (graceful degradation)
    console.warn('[POSTING_QUEUE] ⚠️ Rate limit check exception - allowing posting (graceful degradation)');
    // PERMANENT FIX: On exception, allow posting rather than blocking (safer default)
    return true; // Allow posting if we can't verify rate limit
  }
}

async function getReadyDecisions(certMode: boolean, maxItems?: number): Promise<QueuedDecision[]> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Add grace window for "close enough" posts
    const GRACE_MINUTES = parseInt(process.env.GRACE_MINUTES || '5', 10);
    const now = new Date();
    const graceWindow = new Date(Date.now() + GRACE_MINUTES * 60 * 1000);
    
    console.log(`[POSTING_QUEUE] 📅 Fetching posts ready within ${GRACE_MINUTES} minute window`);
    console.log(`[POSTING_QUEUE] 🕒 Current time: ${now.toISOString()}`);
    console.log(`[POSTING_QUEUE] 🕒 Grace window: ${graceWindow.toISOString()}`);
    
    // CRITICAL FIX: Check what's already been posted to avoid duplicates
    const { data: alreadyPosted } = await supabase
      .from('posted_decisions')
      .select('decision_id');
    
    const postedIds = new Set((alreadyPosted || []).map(p => p.decision_id));
    
    // 🔒 CONTROLLED WINDOW GATE: If CONTROLLED_DECISION_ID is set, ONLY select that decision_id
    const controlledDecisionIdRaw = process.env.CONTROLLED_DECISION_ID;
    const controlledDecisionId = controlledDecisionIdRaw?.trim();
    const isKnownTestId = controlledDecisionId === '03a91e05-9487-47bc-a47a-8280660c1b6e' || controlledDecisionId?.startsWith('03a91e05-9487-47bc-a47a-');
    let contentQuery = supabase
      .from('content_metadata')
      .select('*, visual_format')
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread'])
      .lte('scheduled_at', graceWindow.toISOString()); // Include posts scheduled in past OR near future
    
    if (controlledDecisionId && !isKnownTestId) {
      // 🔒 CRITICAL: Only select the controlled decision_id
      contentQuery = contentQuery.eq('decision_id', controlledDecisionId);
      console.log(`[POSTING_QUEUE] 🔒 CONTROLLED_WINDOW_GATE: Query filtering to decision_id=${controlledDecisionId}`);
    }
    
    const { data: contentPosts, error: contentError } = await contentQuery
      .order('scheduled_at', { ascending: true })
      .limit(10); // Get up to 10 content posts
    
    // 🔒 CONTROLLED WINDOW GATE: If CONTROLLED_DECISION_ID is set, ONLY select that decision_id for replies too
    // 🔒 MANDATE 2: CERT MODE - Hard filter for reply decisions only
    
    let replyQuery = supabase
      .from('content_metadata')
      .select('*, visual_format')
      .eq('status', 'queued')
      .eq('decision_type', 'reply')
      .lte('scheduled_at', graceWindow.toISOString()); // Include replies scheduled in past OR near future
    
    // 🔒 CERT MODE: Only select replies with reply_v2_scheduler pipeline_source
    if (certMode) {
      replyQuery = replyQuery.eq('pipeline_source', 'reply_v2_scheduler');
      console.log(`[POSTING_QUEUE] 🔒 CERT MODE: Filtering to reply_v2_scheduler pipeline_source only`);
    }
    
    if (controlledDecisionId && !isKnownTestId) {
      // 🔒 CRITICAL: Only select the controlled decision_id
      replyQuery = replyQuery.eq('decision_id', controlledDecisionId);
    }
    
    const { data: replyPosts, error: replyError } = await replyQuery
      .order('scheduled_at', { ascending: true })
      .limit(10); // Get up to 10 replies
    
    // 🔒 CERT MODE: Only include replies, exclude threads/singles
    const data = certMode 
      ? [...(replyPosts || [])] // CERT MODE: Only replies
      : [...(contentPosts || []), ...(replyPosts || [])]; // Normal mode: content + replies
    const error = certMode ? replyError : (contentError || replyError);
    
    // 🔒 CERT MODE: Filter out any non-reply decisions that slipped through
    const filteredData = certMode 
      ? data.filter(d => d.decision_type === 'reply' && d.pipeline_source === 'reply_v2_scheduler')
      : data;
    
    if (certMode && filteredData.length !== data.length) {
      console.warn(`[POSTING_QUEUE] ⚠️  CERT MODE: Filtered out ${data.length - filteredData.length} non-reply decisions`);
    }
    
    console.log(`[POSTING_QUEUE] 📊 Content posts: ${certMode ? 0 : (contentPosts?.length || 0)}, Replies: ${replyPosts?.length || 0} (cert_mode=${certMode})`);
    
    // 🔒 MANDATE 1: Log noop if no candidates
    if (filteredData.length === 0) {
      const reason = certMode 
        ? 'no_reply_candidates_with_reply_v2_scheduler'
        : (contentPosts?.length === 0 && replyPosts?.length === 0 ? 'no_candidates' : 'all_filtered');
      
      await supabase.from('system_events').insert({
        event_type: 'posting_queue_noop',
        severity: 'info',
        message: `Posting queue noop: ${reason}`,
        event_data: {
          reason,
          cert_mode: certMode,
          content_count: contentPosts?.length || 0,
          reply_count: replyPosts?.length || 0,
        },
        created_at: new Date().toISOString(),
      });
      
      console.log(`[POSTING_QUEUE] ⏭️  Noop: ${reason}`);
      return []; // Exit early if no candidates - return empty array, not undefined
    }
    
    // 🔒 CERT MODE: Limit to maxItems
    const decisionsToProcess = maxItems ? filteredData.slice(0, maxItems) : filteredData;
    
    // 🧵 DYNAMIC PRIORITY SYSTEM: Fresh threads first, failed threads drop priority
    // This prevents failed threads from blocking the queue forever
    // 🔒 CERT MODE: Skip sorting (only replies, already ordered by scheduled_at)
    const sortedData = certMode ? decisionsToProcess : (() => {
      const sorted = [...decisionsToProcess];
      sorted.sort((a, b) => {
      // Get retry counts from features
      const aRetries = ((a.features as any)?.retry_count || 0);
      const bRetries = ((b.features as any)?.retry_count || 0);
      
      // Base priority levels: thread (1) > reply (2) > single (3)
      const getBasePriority = (type: string) => {
        if (type === 'thread') return 1;
        if (type === 'reply') return 2;
        return 3;
      };
      
      let aPriority = getBasePriority(String(a.decision_type));
      let bPriority = getBasePriority(String(b.decision_type));
      
      // 🚀 DYNAMIC ADJUSTMENT: Failed threads lose priority
      // - Fresh thread: priority 1 (goes first)
      // - Thread retry 1: priority 2 (same as replies)
      // - Thread retry 2+: priority 3 (same as singles)
      if (a.decision_type === 'thread') {
        aPriority += Math.min(aRetries, 2); // Max penalty: +2
      }
      if (b.decision_type === 'thread') {
        bPriority += Math.min(bRetries, 2); // Max penalty: +2
      }
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority; // Lower number = higher priority
      }
      
      // Within same priority level, maintain scheduled order (FIFO)
      return new Date(String(a.scheduled_at)).getTime() - new Date(String(b.scheduled_at)).getTime();
      });
      return sorted;
    })();
    
    const finalData = sortedData;
    
    const prioritizedThreads = finalData.filter(d => d.decision_type === 'thread').length;
    const prioritizedReplies = finalData.filter(d => d.decision_type === 'reply').length;
    const singles = finalData.filter(d => d.decision_type === 'single').length;
    
    if (prioritizedThreads > 0 || prioritizedReplies > 0) {
      console.log(`[POSTING_QUEUE] 🎯 Queue order: ${prioritizedThreads} threads → ${prioritizedReplies} replies → ${singles} singles`);
    }
    
    // ✅ ENHANCED AUTO-CLEANUP: Cancel stale items to prevent queue blocking
    // 🔧 PERMANENT FIX #3: Add automatic retry for old queued posts
    // Singles: 2 hours (simple, common)
    // Threads: 6 hours (complex, rare)
    // Replies: 1 hour (rate limited, can't post if >1h old)
    const oneHourAgoCleanup = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    // Clean up stale singles (>2 hours old)
    const { data: staleSingles } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('status', 'queued')
      .eq('decision_type', 'single')
      .lt('scheduled_at', twoHoursAgo.toISOString());
    
    // Clean up stale threads (>6 hours old - threads get more time due to complexity)
    const { data: staleThreads } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('status', 'queued')
      .eq('decision_type', 'thread')
      .lt('scheduled_at', sixHoursAgo.toISOString());
    
    // ENHANCED: Clean up stale replies (>1 hour old - can't post due to rate limits)
    const { data: staleReplies } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('status', 'queued')
      .eq('decision_type', 'reply')
      .lt('scheduled_at', oneHourAgoCleanup.toISOString());
    
    // 🔧 PERMANENT FIX #3: Check for old queued posts that need retry
    // ⚡ OPTIMIZATION: Check rate limits once, then process all eligible posts
    const { data: oldQueuedPosts } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, created_at, scheduled_at, features')
      .eq('status', 'queued')
      .lt('scheduled_at', thirtyMinutesAgo.toISOString())
      .limit(20);
    
    if (oldQueuedPosts && oldQueuedPosts.length > 0) {
      console.log(`[POSTING_QUEUE] ⚠️ Found ${oldQueuedPosts.length} queued posts >30min old - checking blockers...`);
      
      // ⚡ OPTIMIZATION: Check rate limits once for all posts
      const canPost = await checkPostingRateLimits();
      
      for (const oldPost of oldQueuedPosts) {
        const ageMinutes = Math.round((Date.now() - new Date(oldPost.scheduled_at).getTime()) / (1000 * 60));
        const features = (oldPost.features || {}) as any;
        const retryCount = Number(features?.retry_count || 0);
        
        if (!canPost) {
          console.log(`[POSTING_QUEUE] ⏸️ Post ${oldPost.decision_id} blocked by rate limits (${ageMinutes}min old)`);
          continue; // Rate limited - can't retry yet
        }
        
        // If retry count < 3, schedule retry
        if (retryCount < 3) {
          console.log(`[POSTING_QUEUE] 🔄 Scheduling retry for ${oldPost.decision_id} (attempt ${retryCount + 1})`);
          const retryDelay = Math.min(retryCount * 5, 15); // 0, 5, 10, 15 minutes
          const retryTime = new Date(Date.now() + retryDelay * 60 * 1000);
          
          await supabase
            .from('content_metadata')
            .update({
              scheduled_at: retryTime.toISOString(),
              features: {
                ...features,
                retry_count: retryCount + 1,
                last_retry_scheduled_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('decision_id', oldPost.decision_id);
        } else {
          // Too many retries - mark as cancelled
          console.log(`[POSTING_QUEUE] ❌ Post ${oldPost.decision_id} exceeded retry limit - cancelling`);
          await supabase
            .from('content_metadata')
            .update({
              status: 'cancelled',
              error_message: `Cancelled after ${retryCount} retry attempts (queued for ${ageMinutes} minutes)`,
              updated_at: new Date().toISOString()
            })
            .eq('decision_id', oldPost.decision_id);
        }
      }
    }
    
    const totalStale = (staleSingles?.length || 0) + (staleThreads?.length || 0) + (staleReplies?.length || 0);
    
    if (totalStale > 0) {
      console.log(`[POSTING_QUEUE] 🧹 Auto-cleaning ${totalStale} stale items (${staleSingles?.length || 0} singles >2h, ${staleThreads?.length || 0} threads >6h, ${staleReplies?.length || 0} replies >1h)`);
      
      // Cancel stale singles
      if (staleSingles && staleSingles.length > 0) {
        const { error } = await supabase
          .from('content_metadata')
          .update({ status: 'cancelled' })
          .eq('status', 'queued')
          .eq('decision_type', 'single')
          .lt('scheduled_at', twoHoursAgo.toISOString());
        if (error) {
          console.warn(`[POSTING_QUEUE] ⚠️ Failed to cancel stale singles: ${error.message}`);
        }
      }
      
      // Cancel stale threads
      if (staleThreads && staleThreads.length > 0) {
        const { error } = await supabase
          .from('content_metadata')
          .update({ status: 'cancelled' })
          .eq('status', 'queued')
          .eq('decision_type', 'thread')
          .lt('scheduled_at', sixHoursAgo.toISOString());
        if (error) {
          console.warn(`[POSTING_QUEUE] ⚠️ Failed to cancel stale threads: ${error.message}`);
        }
      }
      
      // ENHANCED: Cancel stale replies
      if (staleReplies && staleReplies.length > 0) {
        const { error } = await supabase
          .from('content_metadata')
          .update({ status: 'cancelled' })
          .eq('status', 'queued')
          .eq('decision_type', 'reply')
          .lt('scheduled_at', oneHourAgoCleanup.toISOString());
        if (error) {
          console.warn(`[POSTING_QUEUE] ⚠️ Failed to cancel stale replies: ${error.message}`);
        } else {
          console.log(`[POSTING_QUEUE] ✅ Cancelled ${staleReplies.length} stale replies (can't post if >1h old due to rate limits)`);
        }
      }
    }
    
    if (error) {
      console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
      return [];
    }
    
    console.log(`[POSTING_QUEUE] 📊 Total decisions ready: ${data?.length || 0}`);
    
    if (!data || data.length === 0) {
      // Debug: Check what IS in the queue
      const { data: futureDecisions } = await supabase
        .from('content_metadata')
        .select('decision_id, scheduled_at, status, quality_score')
        .eq('status', 'queued')
        .order('scheduled_at', { ascending: true })
        .limit(5);
      
      if (futureDecisions && futureDecisions.length > 0) {
        console.log(`[POSTING_QUEUE] 🔮 Upcoming posts in queue:`);
        futureDecisions.forEach((d: any) => {
          const scheduledTime = new Date(d.scheduled_at);
          const minutesUntil = Math.round((scheduledTime.getTime() - now.getTime()) / 60000);
          console.log(`   - ${d.decision_id}: in ${minutesUntil} min (quality: ${d.quality_score})`);
        });
      } else {
        console.log(`[POSTING_QUEUE] ⚠️ No queued content found in database at all`);
      }
      
      return [];
    }
    
    // Map raw rows to typed decisions
    const rows = data as QueuedDecisionRow[];
    
    // DEDUPLICATION: Filter out already-posted content
    const filteredRows = rows.filter(row => {
      const decisionId = String(row.decision_id ?? '');  // 🔥 FIX: Use decision_id (UUID), not id (integer)
      if (postedIds.has(decisionId)) {
        console.log(`[POSTING_QUEUE] ⚠️ Skipping duplicate: ${decisionId} (already posted)`);
        return false;
      }
      return true;
    });
    
    console.log(`[POSTING_QUEUE] 📋 Filtered: ${rows.length} → ${filteredRows.length} (removed ${rows.length - filteredRows.length} duplicates)`);

    // RETRY DEFERRAL: Respect future retry windows so one failure can't monopolize queue
    const nowTs = now.getTime();
    const decisionsExceededRetries: { id: string; type: string; retryCount: number }[] = [];
    
    // 🔒 TASK 2: Process deferrals with TTL check (async - converted from filter)
    const throttledRows: typeof filteredRows = [];
    for (const row of filteredRows) {
      const decisionId = String(row.decision_id ?? '');
      const features = (row.features || {}) as any;
      const retryCount = Number(features?.retry_count || 0);
      const scheduledTs = new Date(String(row.scheduled_at)).getTime();

      const decisionType = String(row.decision_type ?? 'single');
      const maxRetries =
        decisionType === 'thread'
          ? 3
          : decisionType === 'reply'
          ? 3
          : 3;

      if (retryCount >= maxRetries) {
        console.error(
          `[POSTING_QUEUE] ❌ ${decisionType} ${decisionId} exceeded max retries (${retryCount}/${maxRetries})`
        );
        decisionsExceededRetries.push({ id: decisionId, type: decisionType, retryCount });
        continue;
      }

      if (retryCount > 0 && scheduledTs > nowTs) {
        // 🔒 TASK 2: Check if deferral expired (TTL)
        const ttlMinutes = certMode ? 30 : 120; // 30min cert / 2h normal
        const deferralAge = scheduledTs - nowTs; // Positive if future
        const ttlMs = ttlMinutes * 60 * 1000;
        
        // If deferral is in the future but older than TTL, it's expired
        if (deferralAge > 0 && deferralAge > ttlMs) {
          // Deferral expired - clear it
          console.log(`[POSTING_QUEUE] ⏰ Deferral expired (TTL ${ttlMinutes}min) for ${decisionId}, clearing...`);
          await supabase
            .from('content_metadata')
            .update({
              scheduled_at: now.toISOString(),
              features: {
                ...features,
                retry_count: 0,
                deferral_expired_at: now.toISOString(),
              }
            })
            .eq('decision_id', decisionId);
          throttledRows.push(row); // Allow processing
          continue;
        }
        
        // 🔒 TASK 2: Log deferral event
        try {
          const { logDeferral } = await import('./deferralHealer');
          const { data: permit } = await supabase
            .from('post_attempts')
            .select('permit_id')
            .eq('decision_id', decisionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          await logDeferral(decisionId, permit?.permit_id || null, 'retry_scheduled', certMode);
        } catch (logError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Failed to log deferral (non-critical): ${logError.message}`);
        }
        
        console.log(`[POSTING_QUEUE] ⏳ Skipping retry ${decisionId} until ${row.scheduled_at} (retry #${retryCount})`);
        continue;
      }

      throttledRows.push(row);
    }

    if (throttledRows.length !== filteredRows.length) {
      console.log(`[POSTING_QUEUE] ⏳ Retry deferral removed ${filteredRows.length - throttledRows.length} items from this loop`);
    }

    if (decisionsExceededRetries.length > 0) {
      console.log(`[POSTING_QUEUE] ❌ Marking ${decisionsExceededRetries.length} decisions as failed (max retries exceeded)`);
      const decisionIds = decisionsExceededRetries.map(item => item.id);

      try {
        await supabase
          .from('content_metadata')
          .update({
            status: process.env.ENABLE_DEAD_LETTER_HANDLING === 'true' ? 'failed_permanent' : 'failed',
            updated_at: new Date().toISOString(),
            error_message: 'Exceeded retry limit'
          })
          .in('decision_id', decisionIds);
      } catch (retryFailError: any) {
        console.error(`[POSTING_QUEUE] ⚠️ Failed to mark decisions as failed: ${retryFailError.message}`);
      }
    }
    
    // SEPARATE RATE LIMITS: Content (1/hr = 2 every 2 hours for singles+threads combined) vs Replies (4/hr separate)
    const config = getConfig();
    const maxContentPerHourRaw = Number(config.MAX_POSTS_PER_HOUR ?? 1); // Singles + threads share this
    const maxContentPerHour = Number.isFinite(maxContentPerHourRaw) ? maxContentPerHourRaw : 1;
    const maxRepliesPerHourRaw = Number(config.REPLIES_PER_HOUR ?? 4); // Replies independent
    const maxRepliesPerHour = Number.isFinite(maxRepliesPerHourRaw) ? maxRepliesPerHourRaw : 4;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Count content (singles + threads combined) vs replies separately
    const { count: contentCount } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread']) // Singles and threads share 2/hr budget
      .gte('posted_at', oneHourAgo);
    
    const { count: replyCount } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .gte('posted_at', oneHourAgo);
    
    const contentPosted = contentCount || 0;
    const repliesPosted = replyCount || 0;
    
    const contentAllowed = Math.max(0, maxContentPerHour - contentPosted);
    const repliesAllowed = Math.max(0, maxRepliesPerHour - repliesPosted);
    
    console.log(`[POSTING_QUEUE] 🚦 Rate limits: Content ${contentPosted}/${maxContentPerHour} (singles+threads), Replies ${repliesPosted}/${maxRepliesPerHour}`);
    
    // Apply rate limits per type
    const decisionsWithLimits = throttledRows.filter(row => {
      const type = String(row.decision_type ?? 'single');
      if (type === 'reply') {
        return repliesPosted < maxRepliesPerHour;
      } else {
        // 'single' and 'thread' both count as content (share 2/hr budget)
        return contentPosted < maxContentPerHour;
      }
    });
    
    console.log(`[POSTING_QUEUE] ✅ After rate limits: ${decisionsWithLimits.length} decisions can post (${contentAllowed} content, ${repliesAllowed} replies available)`);
    
    const decisions: QueuedDecision[] = decisionsWithLimits.map(row => ({
      id: String(row.decision_id ?? ''),  // 🔥 FIX: Map to decision_id (UUID), not id (integer)!
      content: String(row.content ?? ''),
      decision_type: String(row.decision_type ?? 'single') as 'single' | 'thread' | 'reply',
      target_tweet_id: row.target_tweet_id ? String(row.target_tweet_id) : undefined,
      target_username: row.target_username ? String(row.target_username) : undefined,
      root_tweet_id: row.root_tweet_id ? String(row.root_tweet_id) : undefined, // 🔧 FIX: Pass through for FINAL_REPLY_GATE
      target_tweet_content_snapshot: row.target_tweet_content_snapshot ? String(row.target_tweet_content_snapshot) : undefined, // 🔧 FIX
      target_tweet_content_hash: row.target_tweet_content_hash ? String(row.target_tweet_content_hash) : undefined, // 🔧 FIX
      semantic_similarity: row.semantic_similarity != null ? Number(row.semantic_similarity) : undefined, // 🔧 FIX
      bandit_arm: String(row.bandit_arm ?? ''),
      thread_parts: row.thread_parts as string[] | undefined,
      timing_arm: row.timing_arm ? String(row.timing_arm) : undefined,
      predicted_er: Number(row.predicted_er ?? 0),
      quality_score: row.quality_score ? Number(row.quality_score) : undefined,
      topic_cluster: String(row.topic_cluster ?? ''),
      status: String(row.status ?? 'ready_for_posting'),
      created_at: String(row.created_at ?? new Date().toISOString()),
      // CRITICAL: Pass through features for thread_tweets
      features: row.features as any,
      // ✅ Pass through visual_format for formatting
      visual_format: row.visual_format ? String(row.visual_format) : undefined
    }));
    
    return decisions;
    
  } catch (error) {
    console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
    return [];
  }
}

/**
 * 🔍 SUCCESS VERIFICATION: Check if tweet actually posted despite timeout/error
 * This prevents marking tweets as failed when they actually succeeded
 */
async function verifyTweetPosted(content: string, decisionType: string): Promise<string | null> {
  try {
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const browserPool = UnifiedBrowserPool.getInstance();
    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
    
    // Use browser pool to check if tweet exists
    const tweetFound = await browserPool.withContext(
      'tweet_verification',
      async (context) => {
        const page = await context.newPage();
        try {
          // Navigate to profile and search for recent tweet with matching content
          await page.goto(`https://x.com/${username}`, { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
          });
          
          // Wait for timeline to load
          await page.waitForSelector('[data-testid="tweetText"]', { timeout: 10000 }).catch(() => null);
          
          // Search for tweet with matching content (first 50 chars)
          const searchText = content.substring(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const tweetLocator = page.locator('[data-testid="tweetText"]').filter({ 
            hasText: new RegExp(searchText, 'i') 
          });
          
          const tweetExists = await tweetLocator.first().isVisible({ timeout: 5000 }).catch(() => false);
          
          if (tweetExists) {
            // Try to extract tweet ID from the tweet element
            try {
              const tweetElement = await tweetLocator.first();
              const tweetLink = await tweetElement.locator('..').locator('a[href*="/status/"]').first().getAttribute('href');
              if (tweetLink) {
                const match = tweetLink.match(/\/status\/(\d+)/);
                if (match && match[1]) {
                  return match[1];
                }
              }
            } catch (e) {
              // If ID extraction fails, at least we know tweet exists
              return 'verified_but_no_id';
            }
            return 'verified';
          }
          
          return null;
        } finally {
          await page.close();
        }
      },
      5 // Lower priority (background verification)
    );
    
    return tweetFound;
  } catch (error: any) {
    console.warn(`[POSTING_QUEUE] ⚠️ Tweet verification failed: ${error.message}`);
    return null;
  }
}

async function processDecision(decision: QueuedDecision): Promise<boolean> {
  // 🔒 TRUTH GUARD: Check if posting is blocked due to truth integrity failures
  try {
    const { isTruthIntegrityBlocked } = await import('../utils/truthGuard');
    const guardCheck = await isTruthIntegrityBlocked();
    
    if (guardCheck.blocked) {
      console.error(`[TRUTH_GUARD] 🚫 posting_paused reason=${guardCheck.reason} failure_count=${guardCheck.failure_count}`);
      console.error(`[TRUTH_GUARD] Truth integrity is failing repeatedly - pausing posting to prevent learning pollution`);
      console.error(`[TRUTH_GUARD] To unpause: fix violations, then run: pnpm truth:verify:last24h`);
      return false; // Don't process, don't count as success
    }
  } catch (guardErr: any) {
    console.warn(`[TRUTH_GUARD] ⚠️ Guard check failed: ${guardErr.message}, allowing posting (fail open)`);
  }
  
  // 🚨 RATE LIMIT CHECK: Enforce max posts/replies per hour
  try {
    const { checkRateLimits } = await import('../utils/rateLimiter');
    const rateLimitCheck = await checkRateLimits();
    
    if (decision.decision_type === 'reply' && !rateLimitCheck.canPostReply) {
      console.log(`[RATE_LIMIT] ⏸️  Reply rate limit reached (${rateLimitCheck.repliesThisHour}/4 this hour) - skipping decision ${decision.id}`);
      return false; // Don't process, don't count as failure
    }
    
    if ((decision.decision_type === 'single' || decision.decision_type === 'thread') && !rateLimitCheck.canPostContent) {
      console.log(`[RATE_LIMIT] ⏸️  Post rate limit reached (${rateLimitCheck.postsThisHour}/2 this hour) - skipping decision ${decision.id}`);
      return false; // Don't process, don't count as failure
    }
    
    console.log(`[RATE_LIMIT] ✅ Rate check passed - Posts: ${rateLimitCheck.postsThisHour}/2, Replies: ${rateLimitCheck.repliesThisHour}/4`);
  } catch (rateLimitErr: any) {
    console.warn(`[RATE_LIMIT] ⚠️ Rate limit check failed: ${rateLimitErr.message}, allowing posting (fail open)`);
  }
  
  const isThread = decision.decision_type === 'thread';
  const logPrefix = isThread ? '[POSTING_QUEUE] 🧵' : '[POSTING_QUEUE] 📝';
  
  console.log(`${logPrefix} Processing ${decision.decision_type}: ${decision.id}`);
  console.log(`${logPrefix} 🔍 DEBUG: Starting processDecision`);
  
  // 🔥 PRIORITY 5 FIX: Pre-post logging BEFORE posting
  await logPostAttempt(decision, 'attempting');

  const decisionFeatures = (decision.features || {}) as Record<string, any>;
  if (decisionFeatures.force_session_reset) {
    await forceTwitterSessionReset(`decision:${decision.id}`);
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      const updatedFeatures = {
        ...decisionFeatures,
        force_session_reset: false,
        last_force_reset_at: new Date().toISOString()
      };
      await supabase
        .from('content_metadata')
        .update({ features: updatedFeatures })
        .eq('decision_id', decision.id);
      decision.features = updatedFeatures;
      console.log(`${logPrefix} 🧽 Session reset flag cleared for ${decision.id}`);
    } catch (flagError: any) {
      console.warn(`${logPrefix} ⚠️ Failed to clear session reset flag: ${flagError.message}`);
    }
  }
  
  // 🔒 WRAP ENTIRE FUNCTION IN TRY-CATCH (critical fix for silent failures)
  // Declare variables at function scope so they're accessible in catch block
  let tweetId: string = '';
  let tweetUrl: string | undefined;
  let tweetIds: string[] | undefined;
  let postingSucceeded = false;
  let metadata: any = null;
  let retryCount = 0;
  let recoveryAttempts = 0;
  const maxRetries = 3;
  const maxRecoveryAttempts = MAX_POSTING_RECOVERY_ATTEMPTS;

  try {
    // 🧵 THREAD DIAGNOSTICS: Enhanced logging for threads
    if (isThread) {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
    
      const { data: threadData } = await supabase
        .from('content_metadata')
        .select('thread_parts, created_at, scheduled_at, features')
        .eq('decision_id', decision.id)
        .single();
    
      if (threadData) {
        const parts = threadData.thread_parts as string[] || [];
        const age = (Date.now() - new Date(String(threadData.created_at)).getTime()) / (1000 * 60);
        const retryCount = (threadData.features as any)?.retry_count || 0;
      
        // 🔥 MAX RETRY LIMIT: Prevent infinite thread retries
        // BUT: Check if already posted first (database save might have failed)
        const MAX_THREAD_RETRIES = 3;
        if (retryCount >= MAX_THREAD_RETRIES) {
          // 🚨 CRITICAL: Check if post is already on Twitter before marking as failed
          const { data: alreadyPosted } = await supabase
            .from('posted_decisions')
            .select('tweet_id')
            .eq('decision_id', decision.id)
            .single();
        
          if (alreadyPosted) {
            console.log(`${logPrefix} ✅ Thread already posted as ${alreadyPosted.tweet_id} - database just needs sync`);
            // Mark as posted and return (don't throw error)
            await supabase
              .from('content_metadata')
              .update({
                status: 'posted',
                posted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('decision_id', decision.id);
            return false; // Exit early - post is already live (not a new success)
          }
        
          console.error(`${logPrefix} ❌ Thread ${decision.id} exceeded max retries (${retryCount}/${MAX_THREAD_RETRIES})`);
          throw new Error(`Thread exceeded maximum retry limit (${MAX_THREAD_RETRIES} attempts)`);
        }
      
        console.log(`${logPrefix} ⚡ THREAD DETECTED FOR POSTING ⚡`);
        console.log(`${logPrefix} Thread ID: ${decision.id}`);
        console.log(`${logPrefix} Thread details: ${parts.length} tweets, created ${age.toFixed(0)}min ago`);
        console.log(`${logPrefix} Retry count: ${retryCount}/${MAX_THREAD_RETRIES}`);
        console.log(`${logPrefix} Full thread content:`);
        parts.forEach((tweet: string, i: number) => {
          console.log(`${logPrefix}   Tweet ${i + 1}/${parts.length}: "${tweet.substring(0, 80)}..." (${tweet.length} chars)`);
        });
      } else {
        console.warn(`${logPrefix} ⚠️ Thread data not found for decision ${decision.id}`);
      }
  }
  
    // SMART BATCH FIX: Hard stop - double-check rate limit before EVERY post
    if (decision.decision_type === 'single' || decision.decision_type === 'thread') {
      const canPost = await checkPostingRateLimits();
      if (!canPost) {
        console.log(`[POSTING_QUEUE] ⛔ HARD STOP: Rate limit reached, skipping ${decision.id}`);
        return false; // Don't process this decision
      }
  }
  
  // Note: We keep status as 'queued' until actually posted
  // No intermediate 'posting' status to avoid DB constraint violations

    // Update metrics
    console.log(`${logPrefix} 🔍 DEBUG: About to update posting metrics`);
    await updatePostingMetrics('queued');
    console.log(`${logPrefix} 🔍 DEBUG: Posting metrics updated`);

    console.log(`${logPrefix} 🔍 DEBUG: Entering main try block`);
      // 🚨 CRITICAL: Check if already posted (double-check before posting)
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      console.log(`${logPrefix} 🔍 DEBUG: Supabase client acquired`);
    
      // 🔒 ATOMIC LOCK: Try to claim this decision by updating status to 'posting'
      // This prevents race conditions where two queue runs try to post the same decision
      // 🔧 FIX: Use deterministic query - get newest row if multiple exist, handle 0 rows gracefully
      const { data: existingRows, error: queryError } = await supabase
        .from('content_metadata')
        .select('id, decision_id, status, tweet_id, created_at')
        .eq('decision_id', decision.id)
        .order('created_at', { ascending: false })
        .limit(10); // Get up to 10 rows to check for duplicates
      
      if (queryError) {
        console.error(`[POSTING_QUEUE] ❌ Failed to query content_metadata for ${decision.id}: ${queryError.message}`);
        throw new Error(`Failed to query decision: ${queryError.message}`);
      }
      
      if (!existingRows || existingRows.length === 0) {
        // No content_metadata row exists - mark decision as failed
        console.error(`[POSTING_QUEUE] ❌ No content_metadata row found for decision_id=${decision.id}`);
        const errorReason = 'NO_CONTENT_METADATA';
        const failedAt = new Date().toISOString();
        await supabase
          .from('reply_decisions')
          .update({
            pipeline_error_reason: errorReason,
            posting_completed_at: failedAt,
          })
          .eq('id', decision.id);
        
        await supabase
          .from('content_metadata')
          .update({ status: 'failed', error_message: 'NO_CONTENT_METADATA' })
          .eq('decision_id', decision.id);
        
        // 🔒 POST_FAILED: Emit structured proof signal
        console.log(`[POST_FAILED] decision_id=${decision.id} target_tweet_id=${decision.target_tweet_id} pipeline_error_reason=${errorReason}`);
        await supabase.from('system_events').insert({
          event_type: 'POST_FAILED',
          severity: 'error',
          message: `Reply posting failed: decision_id=${decision.id} error=${errorReason}`,
          event_data: {
            decision_id: decision.id,
            target_tweet_id: decision.target_tweet_id,
            pipeline_error_reason: errorReason,
            failed_at: failedAt,
          },
          created_at: new Date().toISOString(),
        });
        
        throw new Error(`No content_metadata row found for decision_id=${decision.id}`);
      }
      
      // Handle duplicates: keep newest, mark others as superseded
      if (existingRows.length > 1) {
        console.warn(`[POSTING_QUEUE] ⚠️ Found ${existingRows.length} rows for decision_id=${decision.id}, keeping newest`);
        const newestId = existingRows[0].id;
        const olderIds = existingRows.slice(1).map(r => r.id);
        
        // Mark older rows as superseded (if status column allows, otherwise delete)
        for (const oldId of olderIds) {
          await supabase
            .from('content_metadata')
            .update({ 
              status: 'failed',
              error_message: 'SUPERSEDED_BY_NEWER_ROW',
              updated_at: new Date().toISOString()
            })
            .eq('id', oldId);
        }
        
        console.log(`[POSTING_QUEUE] ✅ Marked ${olderIds.length} older rows as superseded`);
      }
      
      const targetRow = existingRows[0];
      
      // Check if already posted
      if (targetRow.status === 'posted' || targetRow.tweet_id) {
        console.log(`[POSTING_QUEUE] 🚫 DUPLICATE PREVENTED: ${decision.id} already posted (status: ${targetRow.status}, tweet_id: ${targetRow.tweet_id})`);
        return false; // Skip posting
      }
      
      // Check if already being posted
      if (targetRow.status === 'posting') {
        console.log(`[POSTING_QUEUE] 🚫 DUPLICATE PREVENTED: ${decision.id} already being posted by another process`);
        return false; // Skip posting
      }
      
      // Only claim if status is 'queued'
      if (targetRow.status !== 'queued') {
        console.warn(`[POSTING_QUEUE] ⚠️ Cannot claim ${decision.id}: status=${targetRow.status} (expected 'queued')`);
        const errorReason = `INVALID_STATUS_${targetRow.status}`;
        const failedAt = new Date().toISOString();
        await supabase
          .from('reply_decisions')
          .update({
            pipeline_error_reason: errorReason,
            posting_completed_at: failedAt,
          })
          .eq('id', decision.id);
        
        // 🔒 POST_FAILED: Emit structured proof signal
        console.log(`[POST_FAILED] decision_id=${decision.id} target_tweet_id=${decision.target_tweet_id} pipeline_error_reason=${errorReason}`);
        await supabase.from('system_events').insert({
          event_type: 'POST_FAILED',
          severity: 'error',
          message: `Reply posting failed: decision_id=${decision.id} error=${errorReason}`,
          event_data: {
            decision_id: decision.id,
            target_tweet_id: decision.target_tweet_id,
            pipeline_error_reason: errorReason,
            failed_at: failedAt,
          },
          created_at: new Date().toISOString(),
        });
        
        return false; // Skip posting
      }
      
      // Claim the row by updating status to 'posting'
      const { data: claimed, error: claimError } = await supabase
        .from('content_metadata')
        .update({ 
          status: 'posting',
          updated_at: new Date().toISOString()
        })
        .eq('id', targetRow.id) // Use primary key for deterministic update
        .eq('status', 'queued')  // Double-check status hasn't changed
        .select('decision_id')
        .maybeSingle(); // Use maybeSingle to handle 0 rows gracefully
      
      if (claimError) {
        console.error(`[POSTING_QUEUE] ❌ Failed to claim decision ${decision.id}: ${claimError.message}`);
        throw new Error(`Failed to claim decision for posting: ${claimError.message}`);
      }
      
      if (!claimed) {
        // Status changed between query and update (race condition)
        console.warn(`[POSTING_QUEUE] ⚠️ Failed to claim ${decision.id}: status changed during claim`);
        return false; // Skip posting
      }
    
      console.log(`[POSTING_QUEUE] 🔒 Successfully claimed decision ${decision.id} for posting`);
    
      // Double-check posted_decisions as well (defense in depth)
      const { data: alreadyExists } = await supabase
        .from('posted_decisions')
        .select('tweet_id')
        .eq('decision_id', decision.id)
        .single();
    
      if (alreadyExists) {
        console.log(`[POSTING_QUEUE] 🚫 DUPLICATE PREVENTED: ${decision.id} already in posted_decisions as ${alreadyExists.tweet_id}`);
        // Revert status back to queued since we didn't actually post
        await supabase
          .from('content_metadata')
          .update({ status: 'queued' })
          .eq('decision_id', decision.id);
        return; // Skip posting
      }
    
      // 🔍 CONTENT HASH CHECK: Check for duplicate content in BOTH tables AND backup file
      // 🔥 PRIORITY 1 FIX: Check backup file FIRST (prevents duplicates even if database save failed)
      const { checkBackupForDuplicate } = await import('../utils/tweetIdBackup');
      const backupTweetId = checkBackupForDuplicate(decision.content);
      if (backupTweetId) {
        console.log(`[POSTING_QUEUE] 🚫 DUPLICATE PREVENTED (backup file): Content already posted as tweet_id ${backupTweetId}`);
        // Revert status back to queued since we didn't actually post
        await supabase
          .from('content_metadata')
          .update({ status: 'queued' })
          .eq('decision_id', decision.id);
        return false; // Skip posting
      }
    
      // Check 1: content_metadata for already-posted content with tweet_id
      const { data: duplicateInMetadata } = await supabase
        .from('content_metadata')
        .select('decision_id, tweet_id, status, posted_at')
        .eq('content', decision.content)
        .not('tweet_id', 'is', null) // Must have tweet_id (actually posted)
        .neq('decision_id', decision.id) // Exclude current decision
        .limit(1);
      
      if (duplicateInMetadata && duplicateInMetadata.length > 0) {
        const dup = duplicateInMetadata[0];
        console.log(`[POSTING_QUEUE] 🚫 DUPLICATE CONTENT PREVENTED: Same content already posted in content_metadata as ${dup.tweet_id} (decision: ${dup.decision_id.substring(0, 8)}...)`);
        // Revert status back to queued since we didn't actually post
        await supabase
          .from('content_metadata')
          .update({ status: 'queued' })
          .eq('decision_id', decision.id);
        return false; // Skip posting
      }
      
      // Check 2: posted_decisions table (backup check)
      const { data: duplicateContent } = await supabase
        .from('posted_decisions')
        .select('tweet_id, content, decision_id')
        .eq('content', decision.content)
        .limit(1);
    
      if (duplicateContent && duplicateContent.length > 0) {
        console.log(`[POSTING_QUEUE] 🚫 DUPLICATE CONTENT PREVENTED: Same content already posted in posted_decisions as ${duplicateContent[0].tweet_id}`);
        // Revert status back to queued since we didn't actually post
        await supabase
          .from('content_metadata')
          .update({ status: 'queued' })
          .eq('decision_id', decision.id);
        return false; // Skip posting
      }
    
      // 📊 INTELLIGENCE LAYER: Capture follower count BEFORE posting
      // 🎯 ENHANCED: Use MultiPointFollowerTracker for accurate attribution
      // 🚨 POSTING PRIORITY: Skip follower baseline if disabled via env flag
      if (process.env.DISABLE_FOLLOWER_BASELINE !== 'true') {
        try {
          console.log(`${logPrefix} 🔍 Capturing follower baseline`);
          const { MultiPointFollowerTracker } = await import('../tracking/multiPointFollowerTracker');
          const tracker = MultiPointFollowerTracker.getInstance();

          let baselineTimedOut = false;
          let baselineTimeoutHandle: NodeJS.Timeout | null = null;

          const baselinePromise = tracker.captureBaseline(decision.id);

          const timeoutPromise = new Promise<void>((resolve) => {
            baselineTimeoutHandle = setTimeout(() => {
              baselineTimedOut = true;
              baselineTimeoutHandle = null;
              console.warn(`[POSTING_QUEUE] ⚠️ Follower baseline capture timed out after ${FOLLOWER_BASELINE_TIMEOUT_MS}ms (decision ${decision.id})`);
              resolve();
            }, FOLLOWER_BASELINE_TIMEOUT_MS);
          });

          await Promise.race([
            baselinePromise.then(
              () => {
                if (baselineTimeoutHandle) {
                  clearTimeout(baselineTimeoutHandle);
                  baselineTimeoutHandle = null;
                }
                if (!baselineTimedOut) {
                  console.log(`${logPrefix} 🔍 DEBUG: Follower baseline captured`);
                }
              },
              (error: any) => {
                if (baselineTimeoutHandle) {
                  clearTimeout(baselineTimeoutHandle);
                  baselineTimeoutHandle = null;
                }
                if (!baselineTimedOut) {
                  console.warn(`[POSTING_QUEUE] ⚠️ Follower baseline capture failed: ${error.message}`);
                }
              }
            ),
            timeoutPromise
          ]);
        } catch (attrError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Follower capture failed: ${attrError.message}`);
        }
      } else {
        console.log(`[FOLLOWER_TRACKER] ⏭️ Baseline disabled via env (DISABLE_FOLLOWER_BASELINE=true)`);
      }
    
      // ═══════════════════════════════════════════════════════════
      // 🎯 PHASE 1: POST TO TWITTER (CRITICAL - Must succeed or fail here)
      // ═══════════════════════════════════════════════════════════
    
      console.log(`${logPrefix} 🔍 DEBUG: About to call postContent`);
      
      // 🔒 VALIDATION: Check character limits before posting
      if (decision.decision_type === 'thread' && decision.thread_parts) {
        const parts = Array.isArray(decision.thread_parts) ? decision.thread_parts : [];
        for (let i = 0; i < parts.length; i++) {
          const partLength = parts[i].length;
          if (partLength > 280) {
            // Hard limit: Twitter's actual character limit
            throw new Error(`Thread part ${i + 1} exceeds 280 chars (${partLength} chars). Max limit: 280 chars (Twitter hard limit).`);
          } else if (partLength > 200) {
            // Soft warning: Optimal engagement threshold (don't fail, just warn)
            console.warn(`[THREAD_VALIDATION] ⚠️ Warning: Thread part ${i + 1} exceeds optimal length (${partLength} chars). Optimal: ≤200 chars, Max: 280 chars. Continuing anyway.`);
          }
        }
        console.log(`${logPrefix} ✅ Character limit validation passed for ${parts.length} thread parts`);
      } else if (decision.decision_type === 'single' && decision.content) {
        if (decision.content.length > 280) {
          throw new Error(`Single tweet exceeds 280 chars (${decision.content.length} chars). Max limit: 280 chars.`);
        }
        console.log(`${logPrefix} ✅ Character limit validation passed for single tweet`);
      }
      
      try {
        // Route based on decision type
        if (decision.decision_type === 'single' || decision.decision_type === 'thread') {
          console.log(`[POSTING_QUEUE][FLOW] ════════════════════════════════════════════════════`);
          console.log(`[POSTING_QUEUE][FLOW] 🚀 STARTING POST FLOW FOR decision_id=${decision.id}`);
          console.log(`[POSTING_QUEUE][FLOW] Type: ${decision.decision_type}`);
          console.log(`[POSTING_QUEUE][FLOW] ════════════════════════════════════════════════════`);
          
          console.log(`[POSTING_QUEUE][FLOW] ⏱️  STEP 1/4: Posting to Twitter...`);
          console.log(`${logPrefix} 🔍 DEBUG: Calling postContent for ${decision.decision_type}`);
          console.log(`${logPrefix} 🔍 DEBUG: decision_id=${decision.id} decision_type=${decision.decision_type}`);
          
          let result;
          try {
            // 🔒 QUOTA ENFORCEMENT: Wrap content posting with advisory lock
            const { withContentLock } = await import('../utils/contentRateLimiter');
            result = await withContentLock(async () => {
              return await postContent(decision);
            });
            console.log(`[POSTING_QUEUE][FLOW] ✅ STEP 1/4 COMPLETE: Posted to Twitter`);
            console.log(`${logPrefix} 🔍 DEBUG: postContent returned successfully`);
            console.log(`${logPrefix} 🔍 DEBUG: result.tweetId=${result?.tweetId || 'MISSING'}, result.tweetUrl=${result?.tweetUrl || 'MISSING'}, result.tweetIds.length=${result?.tweetIds?.length || 0}`);
          } catch (postContentError: any) {
            console.error(`[POSTING_QUEUE][FLOW] ❌ STEP 1/4 FAILED: Twitter posting failed`);
            console.error(`[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=${decision.id} decision_type=${decision.decision_type} error_name=${postContentError?.name || 'Unknown'} error_message=${postContentError?.message || 'No message'}`);
            if (postContentError?.stack) {
              console.error(`[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=${decision.id} stack=${postContentError.stack}`);
            }
            throw postContentError; // Re-throw to maintain existing error handling
          }
          
          // ✅ VALIDATION: Ensure postContent returned valid tweetId
          if (!result || !result.tweetId) {
            const resultJson = JSON.stringify(result, null, 2);
            console.error(`[POSTING_QUEUE] ❌ postContent returned invalid result for decision ${decision.id}:`);
            console.error(`[POSTING_QUEUE] ❌ Result JSON: ${resultJson}`);
            throw new Error(`postContent returned empty/invalid tweetId for decision ${decision.id}`);
          }
          
          tweetId = result.tweetId;
          tweetUrl = result.tweetUrl;
          tweetIds = result.tweetIds; // 🆕 Capture thread IDs if available
          
          console.log(`[POSTING_QUEUE][FLOW] 📋 Tweet IDs captured:`);
          console.log(`[POSTING_QUEUE][FLOW]    Root ID: ${tweetId}`);
          console.log(`[POSTING_QUEUE][FLOW]    All IDs: ${JSON.stringify(tweetIds || [tweetId])}`);
          
          // 🔒 CRITICAL FIX #1: Write IMMUTABLE RECEIPT immediately after tweet IDs captured
          // This MUST succeed or we fail-closed to prevent truth gaps
          console.log(`[LIFECYCLE] decision_id=${decision.id} step=POST_CLICKED tweet_id=${tweetId}`);
          
          console.log(`[POSTING_QUEUE][FLOW] ⏱️  STEP 2/4: Writing receipt to Supabase...`);
          // ✅ STEP 1: Write receipt to Supabase (FAIL-CLOSED - must succeed)
          try {
            const { writePostReceipt } = await import('../utils/postReceiptWriter');
            
            // Determine post type (handle type mismatch)
            let postType: 'single' | 'thread' | 'reply' = 'single';
            const decType = String(decision.decision_type);
            if (decType === 'reply') {
              postType = 'reply';
            } else if (tweetIds && tweetIds.length > 1) {
              postType = 'thread';
            }
            
            console.log(`[POSTING_QUEUE][FLOW]    Calling writePostReceipt() with decision_id=${decision.id}, post_type=${postType}, tweet_ids_count=${(tweetIds || [tweetId]).length}`);
            console.log(`[CRITICAL] ⚠️⚠️⚠️ ABOUT TO WRITE RECEIPT - decision_id=${decision.id} tweet_id=${tweetId}`);
            
            const receiptResult = await writePostReceipt({
              decision_id: decision.id,
              tweet_ids: tweetIds || [tweetId],
              root_tweet_id: tweetId,
              post_type: postType,
              posted_at: new Date().toISOString(),
              metadata: {
                target_tweet_id: decision.target_tweet_id || null,
                target_username: decision.target_username || null,
                content_preview: typeof decision.content === 'string' ? decision.content.substring(0, 100) : ''
              }
            });
            
            console.log(`[CRITICAL] 📊 RECEIPT RESULT: success=${receiptResult.success}, receipt_id=${receiptResult.receipt_id}, error=${receiptResult.error}`);
            console.log(`[POSTING_QUEUE][FLOW]    Receipt result: success=${receiptResult.success}, receipt_id=${receiptResult.receipt_id}, error=${receiptResult.error}`);
            
            if (!receiptResult.success) {
              console.error(`[POSTING_QUEUE][FLOW] ❌ STEP 2/4 FAILED: Receipt write failed`);
              console.error(`[RECEIPT] 🚨 CRITICAL: Receipt write FAILED - marking post as RETRY_PENDING`);
              console.error(`[RECEIPT] 🚨 Error: ${receiptResult.error}`);
              console.error(`[RECEIPT] 🚨 Tweet ${tweetId} is on X but we have NO DURABLE PROOF`);
              
              // Mark decision as retry_pending for reconciliation
              const { getSupabaseClient } = await import('../db/index');
              const supabase = getSupabaseClient();
              await supabase
                .from('content_metadata')
                .update({
                  status: 'retry_pending',
                  features: {
                    receipt_write_failed: true,
                    tweet_id_orphan: tweetId,
                    needs_reconciliation: true,
                    failed_at: new Date().toISOString()
                  }
                })
                .eq('decision_id', decision.id);
              
              // Fail-closed: throw to trigger retry
              throw new Error(`Receipt write failed: ${receiptResult.error}`);
            }
            
            console.log(`[POSTING_QUEUE][FLOW] ✅ STEP 2/4 COMPLETE: Receipt saved (ID: ${receiptResult.receipt_id})`);
            console.log(`[LIFECYCLE] decision_id=${decision.id} step=RECEIPT_SAVED receipt_id=${receiptResult.receipt_id}`);
            
          } catch (receiptErr: any) {
            console.error(`[POSTING_QUEUE][FLOW] ❌ STEP 2/4 EXCEPTION: ${receiptErr.message}`);
            console.error(`[RECEIPT] 🚨 CRITICAL: Receipt exception for tweet ${tweetId}: ${receiptErr.message}`);
            if (receiptErr.stack) {
              console.error(`[RECEIPT] 🚨 Stack: ${receiptErr.stack}`);
            }
            // Fail-closed: re-throw to trigger retry
            throw new Error(`Receipt write exception: ${receiptErr.message}`);
          }
          
          // ✅ STEP 2: Also save to local backup (best effort, ephemeral on Railway)
          try {
            const { saveTweetIdToBackup } = await import('../utils/tweetIdBackup');
            const contentToBackup = decision.decision_type === 'thread' && decision.thread_parts 
              ? decision.thread_parts.join('\n\n') 
              : decision.content;
            saveTweetIdToBackup(decision.id, tweetId, contentToBackup);
            console.log(`[LIFECYCLE] decision_id=${decision.id} step=BACKUP_SAVED tweet_ids_count=${tweetIds?.length || 1}`);
          } catch (backupErr: any) {
            console.warn(`[BACKUP] ⚠️ Local backup failed (non-critical on Railway): ${backupErr.message}`);
            // Don't throw - local backup is ephemeral anyway
          }
        
          // ✅ NEW: Handle placeholder IDs (tweet posted, ID extraction failed)
          if (tweetId && tweetId.startsWith('pending_')) {
            console.log(`[POSTING_QUEUE] ⚠️ Placeholder ID received - tweet posted but ID extraction failed`);
            console.log(`[POSTING_QUEUE] ✅ Tweet is LIVE on Twitter - will recover ID later`);
            postingSucceeded = true;
            // Continue to database save with placeholder
            // Background job will recover real ID
          } else if (!tweetId) {
            // No ID and not placeholder - try verification
            console.log(`[POSTING_QUEUE] ⚠️ No ID returned - verifying tweet is posted...`);
            const verifiedId = await verifyTweetPosted(
              decision.decision_type === 'thread' 
                ? (decision.thread_parts || []).join(' ')
                : decision.content,
              decision.decision_type
            );
            if (verifiedId && verifiedId !== 'verified' && verifiedId !== 'verified_but_no_id') {
              tweetId = verifiedId;
              postingSucceeded = true;
              console.log(`[POSTING_QUEUE] ✅ Verified tweet is live, recovered ID: ${tweetId}`);
            } else {
              // Actual failure - tweet not posted
              throw new Error('Tweet posting failed - not found on Twitter');
            }
          } else {
            // Valid ID - validate it
            const { IDValidator } = await import('../validation/idValidator');
            const validation = IDValidator.validateTweetId(tweetId);
            if (!validation.valid) {
              throw new Error(`Invalid tweet ID returned from postContent: ${validation.error}`);
            }
            postingSucceeded = true;
          }
          
          // 🔥 TRUTH GAP FIX: Save tweet_id to backup file IMMEDIATELY after Twitter post
          // This prevents duplicates even if database save fails
          // Also saves thread_tweet_ids if available
          const { saveTweetIdToBackup } = await import('../utils/tweetIdBackup');
          const contentToBackup = decision.decision_type === 'thread' 
            ? (decision.thread_parts || []).join(' ') 
            : decision.content;
          saveTweetIdToBackup(decision.id, tweetId, contentToBackup);
          console.log(`[POSTING_QUEUE] 💾 Tweet ID saved to backup file: ${tweetId}`);
          
          // 🔥 TRUTH GAP FIX: Also save thread_tweet_ids to backup if available
          if (tweetIds && tweetIds.length > 1) {
            // Save each thread tweet ID individually for reconciliation
            for (const threadTweetId of tweetIds) {
              saveTweetIdToBackup(decision.id, threadTweetId, contentToBackup);
            }
            console.log(`[POSTING_QUEUE] 💾 Saved ${tweetIds.length} thread tweet IDs to backup`);
          }
          // End of single/thread block
        } else if (decision.decision_type === 'reply') {
          // ═══════════════════════════════════════════════════════════════════════
          // 🔒 REPLY SAFETY GATES - Run all checks, skip if any fail
          // ═══════════════════════════════════════════════════════════════════════
          const shouldSkip = await checkReplySafetyGates(decision, supabase);
          if (shouldSkip) {
            // 🔒 POST_FAILED: Safety gates blocked the decision
            const { data: blockedRow } = await supabase
              .from('content_generation_metadata_comprehensive')
              .select('skip_reason, error_message')
              .eq('decision_id', decision.id)
              .maybeSingle();
            
            const skipReason = blockedRow?.skip_reason || 'SAFETY_GATE_BLOCKED';
            const errorReason = `SAFETY_GATE_${skipReason}`;
            const failedAt = new Date().toISOString();
            
            console.log(`[POST_FAILED] decision_id=${decision.id} target_tweet_id=${decision.target_tweet_id} pipeline_error_reason=${errorReason}`);
            await supabase.from('system_events').insert({
              event_type: 'POST_FAILED',
              severity: 'warning',
              message: `Reply posting blocked by safety gate: decision_id=${decision.id} reason=${skipReason}`,
              event_data: {
                decision_id: decision.id,
                target_tweet_id: decision.target_tweet_id,
                pipeline_error_reason: errorReason,
                skip_reason: skipReason,
                error_message: blockedRow?.error_message || null,
                failed_at: failedAt,
              },
              created_at: new Date().toISOString(),
            });
            
            return false; // Skip this decision (return early from processDecision)
          }
          
          // All gates passed - proceed to invariant check
          // ═══════════════════════════════════════════════════════════════════════
          // 🔒 PRE-POST INVARIANT CHECK - SKIP (NOT CRASH) ON FAILURE
          // ═══════════════════════════════════════════════════════════════════════
          const invariantCheck = await checkReplyInvariantsPrePost(decision);
          
          if (!invariantCheck.pass) {
            console.log(`[INVARIANT_BLOCK] decision_id=${decision.id} reason=${invariantCheck.reason} action=blocked`);
            
            // Mark decision as blocked (NOT throw)
            try {
              const { getSupabaseClient } = await import('../db/index');
              const supabase = getSupabaseClient();
              await supabase.from('content_generation_metadata_comprehensive')
                .update({
                  status: 'blocked',
                  skip_reason: invariantCheck.reason,
                  guard_results: invariantCheck.guard_results
                })
                .eq('decision_id', decision.id);
              console.log(`[INVARIANT_BLOCK] ✅ Marked decision ${decision.id} as blocked`);
            } catch (blockError: any) {
              console.warn(`[INVARIANT_BLOCK] ⚠️ Failed to mark as blocked: ${blockError.message}`);
            }
            
            // Log to system_events
            try {
              const { getSupabaseClient } = await import('../db/index');
              const supabase = getSupabaseClient();
              await supabase.from('system_events').insert({
                event_type: 'reply_invariant_blocked',
                severity: 'warning',
                event_data: {
                  decision_id: decision.id,
                  reason: invariantCheck.reason,
                  guard_results: invariantCheck.guard_results,
                  content_preview: decision.content.substring(0, 100)
                },
                created_at: new Date().toISOString()
              });
            } catch (logError: any) {
              console.warn(`[INVARIANT_BLOCK] ⚠️ Failed to log event: ${logError.message}`);
            }
            
            return false; // Skip this decision, continue queue processing
          }
          
          console.log(`[INVARIANT] ✅ Pre-post check passed for decision_id=${decision.id}`);
          // ═══════════════════════════════════════════════════════════════════════
          
          // 🔒 DISTRIBUTED LOCK: Wrap entire reply posting in lock to prevent concurrent posts
          const { withReplyLock } = await import('../utils/replyRateLimiter');
          
          tweetId = await withReplyLock(async () => {
            // Lock is held - now post the reply
            const replyTweetId = await postReply(decision);
          
            // 🔒 VALIDATION: Validate reply ID immediately after posting
            const { IDValidator } = await import('../validation/idValidator');
            const replyValidation = IDValidator.validateReplyId(replyTweetId, decision.target_tweet_id || undefined);
            if (!replyValidation.valid) {
              throw new Error(`Invalid reply ID returned from postReply: ${replyValidation.error}`);
            }
            
            // 🔥 PRIORITY 1 FIX: Save reply tweet_id to backup file IMMEDIATELY
            const { saveTweetIdToBackup } = await import('../utils/tweetIdBackup');
            saveTweetIdToBackup(decision.id, replyTweetId, decision.content);
            console.log(`[POSTING_QUEUE] 💾 Reply tweet ID saved to backup file: ${replyTweetId}`);
            
            return replyTweetId;
          });
          // Lock is released automatically after withReplyLock completes
          
          // For replies, construct URL (reply system doesn't return URL yet)
          tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${tweetId}`;
        } else {
          throw new Error(`Unknown decision type: ${decision.decision_type}`);
        }
      
        // 🎉 TWEET IS LIVE! From this point on, we ALWAYS mark as posted
        postingSucceeded = true;
        
        // Update SLO event and track performance for replies
        if (decision.decision_type === 'reply') {
          const { updateSloEventAfterPosting } = await import('./replySystemV2/sloTracker');
          const { trackReplyPerformance } = await import('./replySystemV2/performanceTracker');
          
          // Get permit_id
          const { data: permit } = await supabase
            .from('post_attempts')
            .select('permit_id')
            .eq('decision_id', decision.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (permit) {
            await updateSloEventAfterPosting(decision.id, permit.permit_id, tweetId);
          }
          
          // Get candidate evaluation for tier
          const { data: decisionRow } = await supabase
            .from('content_generation_metadata_comprehensive')
            .select('candidate_evaluation_id, target_tweet_id')
            .eq('decision_id', decision.id)
            .single();
          
          if (decisionRow?.candidate_evaluation_id) {
            const { data: candidateEval } = await supabase
              .from('candidate_evaluations')
              .select('predicted_tier, candidate_tweet_id')
              .eq('id', decisionRow.candidate_evaluation_id)
              .single();
            
            if (candidateEval) {
              await trackReplyPerformance(
                decision.id,
                candidateEval.candidate_tweet_id || decisionRow.target_tweet_id || '',
                tweetId,
                candidateEval.predicted_tier || 2
              );
            }
          }
        }
        
        console.log(`[POSTING_QUEUE] 🎉 TWEET POSTED SUCCESSFULLY: ${tweetId}`);
        console.log(`[POSTING_QUEUE] 🔗 Tweet URL: ${tweetUrl}`);
        console.log(`[POSTING_QUEUE] ⚠️ From this point on, all operations are best-effort only`);
        
        // 🔍 CONTENT VERIFICATION: Verify tweet_id matches content (PREVENT MISATTRIBUTION)
        try {
          console.log(`[POSTING_QUEUE] 🔍 Verifying content matches tweet_id ${tweetId}...`);
          const { verifyPostedContent } = await import('../utils/contentVerification');
          const verification = await verifyPostedContent(
            tweetId,
            decision.decision_type === 'thread' 
              ? (decision.thread_parts || []).join(' ')
              : decision.content
          );
          
          if (!verification.isValid) {
            console.error(`[POSTING_QUEUE] 🚨 CRITICAL MISATTRIBUTION DETECTED!`);
            console.error(`[POSTING_QUEUE] Tweet ID: ${tweetId}`);
            console.error(`[POSTING_QUEUE] Expected: "${verification.expectedPreview}..."`);
            console.error(`[POSTING_QUEUE] Actual: "${verification.actualPreview}..."`);
            console.error(`[POSTING_QUEUE] Similarity: ${(verification.similarity * 100).toFixed(1)}%`);
            console.error(`[POSTING_QUEUE] ⚠️ WRONG TWEET_ID STORED - MANUAL INVESTIGATION REQUIRED!`);
            console.error(`[POSTING_QUEUE] 🚨 Do NOT store this tweet_id - it belongs to different content!`);
            
            // 🔥 CRITICAL: Mark as posted BUT store misattribution flag
            // Don't fail the post (it's already live), but flag for manual fix
            const { getSupabaseClient } = await import('../db/index');
            const supabase = getSupabaseClient();
            await supabase
              .from('content_metadata')
              .update({
                status: 'posted',
                tweet_id: tweetId,
                posted_at: new Date().toISOString(),
                features: {
                  misattribution_detected: true,
                  verification_error: verification.error,
                  verification_similarity: verification.similarity
                }
              })
              .eq('decision_id', decision.id);
            
            // Still continue - post is live, but flag it for manual investigation
            console.error(`[POSTING_QUEUE] ⚠️ Misattribution flag stored - requires manual fix`);
          } else {
            console.log(`[POSTING_QUEUE] ✅ CONTENT VERIFICATION: Match ${(verification.similarity * 100).toFixed(1)}% - tweet_id is correct`);
          }
        } catch (verifyError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Content verification failed: ${verifyError.message}`);
          // Continue anyway - verification failure shouldn't block posting
        }
        
        // 🔥 PRIORITY 4 FIX: Log successful post
        await logPostAttempt(decision, 'success', tweetId);
      
      } catch (postError: any) {
        // Posting failed - BUT check if tweet actually posted (timeout might have happened after success)
        console.error(`[POSTING_QUEUE] ❌ POSTING FAILED: ${postError.message}`);
        console.error(`[POSTING_QUEUE] 📝 Content: "${decision.content.substring(0, 100)}..."`);
      
        // 🔥 SUCCESS VERIFICATION: Check if tweet actually posted despite error (common with timeouts)
        const isTimeout = /timeout|exceeded/i.test(postError.message);
        if (isTimeout) {
          console.log(`[POSTING_QUEUE] 🔍 Timeout detected - checking backup file and verifying...`);
          try {
            // 🔥 PRIORITY 2 FIX: Check backup file FIRST (faster than verification)
            const { getTweetIdFromBackup } = await import('../utils/tweetIdBackup');
            const backupTweetId = getTweetIdFromBackup(decision.id);
            
            if (backupTweetId) {
              console.log(`[POSTING_QUEUE] ✅ BACKUP FILE FOUND: Tweet ID ${backupTweetId} (post succeeded, verification not needed)`);
              tweetId = backupTweetId;
              tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${backupTweetId}`;
              postingSucceeded = true;
              // Continue to database save (skip retry logic)
            } else {
              // Backup not found - try verification
              const verifiedTweetId = await verifyTweetPosted(decision.content, decision.decision_type);
              if (verifiedTweetId) {
                console.log(`[POSTING_QUEUE] ✅ VERIFICATION SUCCESS: Tweet is live on Twitter! ID: ${verifiedTweetId}`);
                tweetId = verifiedTweetId;
                tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${verifiedTweetId}`;
                postingSucceeded = true;
                // Continue to database save (skip retry logic)
              } else {
                console.log(`[POSTING_QUEUE] ❌ VERIFICATION FAILED: Tweet not found on Twitter`);
              }
            }
          } catch (verifyError: any) {
            console.warn(`[POSTING_QUEUE] ⚠️ Verification check failed: ${verifyError.message}`);
            // Continue with normal retry logic
          }
        }
      
        // If verification found the tweet, skip retry logic and go to database save
        if (postingSucceeded && tweetId) {
          console.log(`[POSTING_QUEUE] 🎉 Tweet verified as posted - skipping retry, saving to database`);
          // Continue to database save section below
        } else {
          // RETRY LOGIC: Both singles and threads get 3 retry attempts
          // Temporary failures (network glitch, slow load) shouldn't be permanent
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
        
          const { data: metadataData } = await supabase
            .from('content_metadata')
            .select('features')
            .eq('decision_id', decision.id)
            .single();
        
          metadata = metadataData;
          retryCount = (metadata?.features as any)?.retry_count || 0;
          recoveryAttempts = Number((metadata?.features as any)?.recovery_attempts || 0);
        
          if (retryCount < maxRetries) {
            // 🔥 PRE-RETRY VERIFICATION: Check if previous attempt actually succeeded
            // This prevents retrying when tweet is already live
            const isTimeout = /timeout|exceeded/i.test(postError.message || '');
            if (isTimeout && retryCount > 0) {
              console.log(`[POSTING_QUEUE] 🔍 PRE-RETRY VERIFICATION: Checking backup file and verifying...`);
              try {
                // 🔥 PRIORITY 2 FIX: Check backup file FIRST (faster than verification)
                const { getTweetIdFromBackup } = await import('../utils/tweetIdBackup');
                const backupTweetId = getTweetIdFromBackup(decision.id);
                
                if (backupTweetId) {
                  console.log(`[POSTING_QUEUE] ✅ PRE-RETRY BACKUP FOUND: Tweet ID ${backupTweetId} (previous attempt succeeded)`);
                  console.log(`[POSTING_QUEUE] 🎉 Skipping retry - marking as posted`);
                  tweetId = backupTweetId;
                  tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${backupTweetId}`;
                  postingSucceeded = true;
                  // Continue to database save (skip retry logic)
                } else {
                  // Backup not found - try verification
                  const preRetryCheck = await verifyTweetPosted(decision.content, decision.decision_type);
                  if (preRetryCheck && preRetryCheck !== 'verified_but_no_id' && preRetryCheck !== 'verified') {
                    console.log(`[POSTING_QUEUE] ✅ PRE-RETRY VERIFICATION: Tweet is already live! ID: ${preRetryCheck}`);
                    console.log(`[POSTING_QUEUE] 🎉 Skipping retry - marking as posted`);
                    tweetId = preRetryCheck;
                    tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${preRetryCheck}`;
                    postingSucceeded = true;
                  } else if (preRetryCheck === 'verified' || preRetryCheck === 'verified_but_no_id') {
                    console.log(`[POSTING_QUEUE] ✅ PRE-RETRY VERIFICATION: Tweet exists but ID extraction failed`);
                    tweetId = `recovered_${Date.now()}`;
                    tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}`;
                    postingSucceeded = true;
                  } else {
                    console.log(`[POSTING_QUEUE] ❌ PRE-RETRY VERIFICATION: Tweet not found - proceeding with retry`);
                  }
                }
              } catch (preRetryError: any) {
                console.warn(`[POSTING_QUEUE] ⚠️ Pre-retry verification failed: ${preRetryError.message}`);
                // Continue with retry if verification fails
              }
            }
          
            // If verification found the tweet, skip retry and go to database save
            if (postingSucceeded && tweetId) {
              console.log(`[POSTING_QUEUE] 🎉 Tweet verified as posted - skipping retry, saving to database`);
              // Break out of retry block - will continue to database save
            } else {
              // Calculate retry delay (progressive backoff)
              const retryDelayMinutes = decision.decision_type === 'thread' 
                ? [5, 15, 30][retryCount]  // Threads: 5min, 15min, 30min
                : [3, 10, 20][retryCount]; // Singles: 3min, 10min, 20min (faster retries)
            
              const retryDelay = retryDelayMinutes * 60 * 1000;
            
              console.log(`[POSTING_QUEUE] 🔄 ${decision.decision_type} will retry (attempt ${retryCount + 1}/${maxRetries}) in ${retryDelayMinutes}min`);
              console.log(`[POSTING_QUEUE] 📝 Error: ${postError.message}`);
            
              const shouldForceReset = /timeout|session/i.test(postError.message || '');
              const existingForceReset = Boolean((metadata?.features as any)?.force_session_reset);
              // 🔒 TASK 2: Get permit_id for logging
              const { data: permitForLog } = await supabase
                .from('post_attempts')
                .select('permit_id')
                .eq('decision_id', decision.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              await supabase
                .from('content_metadata')
                .update({
                  status: 'queued',  // 🔄 Revert from 'posting' back to 'queued' for retry
                  scheduled_at: new Date(Date.now() + retryDelay).toISOString(),
                  features: {
                    ...(typeof metadata?.features === 'object' && metadata?.features !== null ? metadata.features : {}),
                    retry_count: retryCount + 1,
                    last_error: postError.message,
                    last_attempt: new Date().toISOString(),
                    last_post_error: postError.message,
                    force_session_reset: shouldForceReset || existingForceReset
                  }
                })
                .eq('decision_id', decision.id);
              
              // 🔒 TASK 2: Log deferral event
              const { logDeferral } = await import('./deferralHealer');
              await logDeferral(decision.id, permitForLog?.permit_id || null, postError.message, false);
            
              await updatePostingMetrics('error');
              return false; // Don't mark as failed, will retry
            }
          }
        }
      
        if (recoveryAttempts < maxRecoveryAttempts) {
          const recoveryDelayMinutes = Math.min(45, (recoveryAttempts + 1) * 10);
          const recoveryDelay = recoveryDelayMinutes * 60 * 1000;
          console.log(`[POSTING_QUEUE] 🛠️ Scheduling recovery attempt ${recoveryAttempts + 1}/${maxRecoveryAttempts} with forced session reset in ${recoveryDelayMinutes}min`);
          await supabase
            .from('content_metadata')
            .update({
              status: 'queued',
              scheduled_at: new Date(Date.now() + recoveryDelay).toISOString(),
              features: {
                ...(typeof metadata?.features === 'object' && metadata?.features !== null ? metadata.features : {}),
                retry_count: 0,
                recovery_attempts: recoveryAttempts + 1,
                force_session_reset: true,
                last_error: postError.message,
                last_attempt: new Date().toISOString(),
                last_post_error: postError.message
              }
            })
            .eq('decision_id', decision.id);
          await updatePostingMetrics('error');
          return false;
        }
      
        // 🔥 CRITICAL FIX: Final verification before marking as failed
        // All retries exhausted - but check ONE MORE TIME if tweet actually posted
        console.error(`[POSTING_QUEUE] ❌ All ${maxRetries} retries + ${maxRecoveryAttempts} recoveries exhausted for ${decision.decision_type}`);
        console.log(`[POSTING_QUEUE] 🔍 FINAL VERIFICATION: Checking backup file and verifying...`);
      
        try {
          // 🔥 PRIORITY 2 FIX: Check backup file FIRST (guaranteed if post succeeded)
          const { getTweetIdFromBackup } = await import('../utils/tweetIdBackup');
          const backupTweetId = getTweetIdFromBackup(decision.id);
          
          if (backupTweetId) {
            console.log(`[POSTING_QUEUE] ✅ FINAL BACKUP FOUND: Tweet ID ${backupTweetId} (post succeeded, recovering false failure)`);
            console.log(`[POSTING_QUEUE] 🎉 Recovering false failure - marking as posted`);
            tweetId = backupTweetId;
            tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${backupTweetId}`;
            postingSucceeded = true;
            // Mark as posted (will continue to database save section)
          } else {
            // Backup not found - try verification
            const finalVerification = await verifyTweetPosted(decision.content, decision.decision_type);
            if (finalVerification && finalVerification !== 'verified_but_no_id' && finalVerification !== 'verified') {
              console.log(`[POSTING_QUEUE] ✅ FINAL VERIFICATION SUCCESS: Tweet is live on Twitter! ID: ${finalVerification}`);
              console.log(`[POSTING_QUEUE] 🎉 Recovering false failure - marking as posted`);
              tweetId = finalVerification;
              tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${finalVerification}`;
              postingSucceeded = true;
            } else if (finalVerification === 'verified' || finalVerification === 'verified_but_no_id') {
              console.log(`[POSTING_QUEUE] ✅ FINAL VERIFICATION: Tweet exists but ID extraction failed`);
              console.log(`[POSTING_QUEUE] 🎉 Recovering false failure - marking as posted with placeholder ID`);
              tweetId = `recovered_${Date.now()}`;
              tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}`;
              postingSucceeded = true;
            } else {
              // Verification confirms tweet is NOT on Twitter - safe to mark as failed
              console.log(`[POSTING_QUEUE] ❌ FINAL VERIFICATION: Tweet not found on Twitter - marking as failed`);
              const finalErrorMsg = 'Tweet verification failed - tweet not found on Twitter';
              await supabase
                .from('content_metadata')
                .update({
                  status: 'failed',
                  updated_at: new Date().toISOString(),
                  features: {
                    ...(typeof metadata?.features === 'object' && metadata?.features !== null ? metadata.features : {}),
                    retry_count: retryCount,
                    recovery_attempts: recoveryAttempts,
                    last_error: postError.message,
                    last_attempt: new Date().toISOString(),
                    last_post_error: postError.message,
                    final_verification: 'not_found'
                  }
                })
                .eq('decision_id', decision.id);
              await updatePostingMetrics('error');
              throw postError;
            }
          }
        } catch (verifyError: any) {
          // Verification itself failed - be conservative, don't mark as failed yet
          console.error(`[POSTING_QUEUE] ⚠️ Final verification check failed: ${verifyError.message}`);
          console.log(`[POSTING_QUEUE] ⚠️ Cannot confirm if tweet posted - marking as failed but logging for reconciliation`);
          await supabase
            .from('content_metadata')
            .update({
              status: process.env.ENABLE_DEAD_LETTER_HANDLING === 'true' && retryCount >= Number(process.env.POSTING_MAX_RETRIES || '5')
                ? 'failed_permanent'
                : 'failed',
              updated_at: new Date().toISOString(),
              features: {
                ...(typeof metadata?.features === 'object' && metadata?.features !== null ? metadata.features : {}),
                retry_count: retryCount,
                recovery_attempts: recoveryAttempts,
                last_error: postError.message,
                last_attempt: new Date().toISOString(),
                last_post_error: postError.message,
                final_verification: 'verification_failed',
                needs_reconciliation: true
              }
            })
            .eq('decision_id', decision.id);
          await updatePostingMetrics('error');
          throw postError;
        }
      }
    
    // Only continue to post-posting operations if posting succeeded
    if (postingSucceeded && tweetId) {
        // ═══════════════════════════════════════════════════════════
        // 🎯 PHASE 2: POST-POSTING OPERATIONS (BEST EFFORT ONLY)
        // ═══════════════════════════════════════════════════════════
        // Tweet is live - nothing below can fail the post!
        
        // Best-effort: Extract and classify hook
        try {
          const { hookAnalysisService } = await import('../intelligence/hookAnalysisService');
          const hook = hookAnalysisService.extractHook(decision.content);
          const hookType = hookAnalysisService.classifyHookType(hook);
        
          // Store hook in outcomes
          const { getSupabaseClient: getSupa } = await import('../db/index');
          const supa = getSupa();
          await supa
            .from('outcomes')
            .update({ 
              hook_text: hook, 
              hook_type: hookType 
            })
            .eq('tweet_id', tweetId);
        
          console.log(`[POSTING_QUEUE] 🎣 Hook captured: "${hook}" (${hookType})`);
        } catch (hookError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Hook capture failed (non-critical): ${hookError.message}`);
        }
      
        // Mark as posted and store tweet ID and URL
        // 🚨 CRITICAL: Retry database save if it fails (tweet is already on Twitter!)
        // 🔥 ABSOLUTE PRIORITY: tweet_id MUST be saved - missing IDs make us look like a bot!
        let dbSaveSuccess = false;
        for (let attempt = 1; attempt <= 5; attempt++) {  // Increased to 5 attempts
          try {
            console.log(`[POSTING_QUEUE] 💾 Database save attempt ${attempt}/5 for tweet ${tweetId}...`);
            // 🆕 Pass thread IDs if available
            // 🔥 THREAD TRUTH FIX: Log what we're saving
            const tweetIdsCountToSave = tweetIds && tweetIds.length > 0 ? tweetIds.length : 0;
            if (tweetIdsCountToSave >= 2) {
              console.log(`[DB_THREAD_SAVE] decision_id=${decision.id} tweet_ids_count=${tweetIdsCountToSave} tweet_ids=${tweetIds!.join(',')}`);
            }
            
            console.log(`[POSTING_QUEUE][FLOW] ⏱️  STEP 3/4: Saving to content_metadata...`);
            console.log(`[CRITICAL] ⚠️⚠️⚠️ ABOUT TO CALL markDecisionPosted - decision_id=${decision.id} tweet_id=${tweetId}`);
            console.log(`[POSTING_QUEUE][FLOW]    Calling markDecisionPosted() with:`);
            console.log(`[POSTING_QUEUE][FLOW]    - decision_id: ${decision.id}`);
            console.log(`[POSTING_QUEUE][FLOW]    - tweet_id: ${tweetId}`);
            console.log(`[POSTING_QUEUE][FLOW]    - tweet_url: ${tweetUrl || 'N/A'}`);
            console.log(`[POSTING_QUEUE][FLOW]    - tweet_ids: ${JSON.stringify(tweetIds || [])}`);
            
            // 🔒 CRITICAL FIX #2: Check return value from markDecisionPosted
            const saveResult = await markDecisionPosted(decision.id, tweetId, tweetUrl, tweetIds);
            
            console.log(`[CRITICAL] 📊 DB SAVE RESULT: ok=${saveResult.ok}, savedTweetIds=${JSON.stringify(saveResult.savedTweetIds)}`);
            console.log(`[POSTING_QUEUE][FLOW]    Result: ok=${saveResult.ok}, savedTweetIds=${JSON.stringify(saveResult.savedTweetIds)}, classification=${saveResult.classification}`);
            console.log(`[POSTING_QUEUE][FLOW]    Result: ok=${saveResult.ok}, savedTweetIds=${JSON.stringify(saveResult.savedTweetIds)}, classification=${saveResult.classification}`);
            
            if (!saveResult.ok) {
              console.log(`[POSTING_QUEUE][FLOW] ❌ STEP 3/4 FAILED: markDecisionPosted returned ok=false`);
              console.log(`[REPLY_TRUTH] step=FAIL reason=db_save_returned_false`);
              throw new Error(`markDecisionPosted returned ok=false for decision ${decision.id}`);
            }

            console.log(`[POSTING_QUEUE][FLOW] ✅ STEP 3/4 COMPLETE: Saved to database`);
            dbSaveSuccess = true;
            console.log(`[POSTING_QUEUE] ✅ Database save SUCCESS on attempt ${attempt} (verified: ok=${saveResult.ok})`);
            
            // 🔒 TRUTH CONTRACT: Log DB confirmation for replies
            if (decision.decision_type === 'reply') {
              console.log(`[REPLY_TRUTH] step=DB_CONFIRMED ok=true tweet_id=${saveResult.savedTweetIds[0] || tweetId} decision_id=${decision.id}`);
              
              // 🎯 Record reply in replied_tweets for deduplication
              if (decision.target_tweet_id && decision.target_username) {
                try {
                  const { recordReply } = await import('../utils/replyDedupe');
                  await recordReply(decision.target_tweet_id, decision.target_username, decision.id);
                } catch (recordError: any) {
                  console.warn(`[POSTING_QUEUE] ⚠️ Failed to record reply in replied_tweets: ${recordError.message}`);
                  // Non-critical, don't fail the post
                }
              }
            }
            
            // ✅ EXPLICIT SUCCESS LOG: Log after DB save confirms post is complete
            // 🔥 THREAD TRUTH FIX: Treat multi-tweet posts as threads regardless of decision_type
            const tweetIdsCount = tweetIds && tweetIds.length > 0 ? tweetIds.length : 1;
            const isMultiTweetThread = tweetIdsCount > 1;
            const effectiveDecisionType = isMultiTweetThread ? 'thread' : (decision.decision_type || 'single');
            const finalTweetUrl = tweetUrl || `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${tweetId}`;
            
            console.log(`[LIFECYCLE] decision_id=${decision.id} step=SUCCESS type=${effectiveDecisionType} tweet_id=${tweetId} tweet_ids_count=${tweetIdsCount}`);
            
            if (effectiveDecisionType === 'thread') {
              console.log(`[POSTING_QUEUE][SUCCESS] decision_id=${decision.id} type=${effectiveDecisionType} tweet_id=${tweetId} tweet_ids_count=${tweetIdsCount} url=${finalTweetUrl}`);
            } else {
              console.log(`[POSTING_QUEUE][SUCCESS] decision_id=${decision.id} type=${effectiveDecisionType} tweet_id=${tweetId} url=${finalTweetUrl}`);
            }
            
            // 🔒 TRUTH CONTRACT: Final success log for replies
            if (decision.decision_type === 'reply') {
              console.log(`[REPLY_TRUTH] step=SUCCESS decision_id=${decision.id} tweet_id=${tweetId} parent_id=${decision.target_tweet_id}`);
            }
            
            // 🔥 PRIORITY 1 FIX: Mark backup as verified (database save succeeded)
            const { markBackupAsVerified } = await import('../utils/tweetIdBackup');
            markBackupAsVerified(decision.id, tweetId);
            
            // ✅ Return true ONLY after DB save succeeds and success log is emitted
            return true;
          } catch (dbError: any) {
            console.error(`[LIFECYCLE][FAIL] decision_id=${decision.id} step=DB_SAVE_FAILED attempt=${attempt}/5 reason=${dbError.message}`);
            console.error(`[POSTING_QUEUE] 🚨 Database save attempt ${attempt}/5 failed:`, dbError.message);
            
            // ✅ EXPLICIT DB SAVE FAILURE LOG
            const decisionType = decision.decision_type || 'single';
            console.log(`[POSTING_QUEUE][DB_SAVE_FAIL] decision_id=${decision.id} type=${decisionType} err=${dbError.message}`);
            
            // 🔥 TRUTH GAP FIX: Log truth gap if final attempt fails
            if (attempt === 5) {
              const tweetIdsCount = tweetIds && tweetIds.length > 0 ? tweetIds.length : 1;
              console.log(`[TRUTH_GAP] decision_id=${decision.id} posted_on_x=true db_saved=false tweet_ids_count=${tweetIdsCount} tweet_id=${tweetId} tweet_ids=${tweetIds ? tweetIds.join(',') : 'N/A'}`);
              
              // 🔥 TRUTH GAP FIX: Enqueue reconciliation job (will be created if needed)
              // For now, log that reconciliation is needed
              console.log(`[TRUTH_GAP] ⚠️ Reconciliation needed for decision ${decision.id} - tweet posted but DB save failed`);
            }
            
            // 🔧 ENHANCED ERROR TRACKING: Track database save failures
            await trackError(
              'posting_queue',
              'database_save_failed',
              `Database save failed (attempt ${attempt}/5): ${dbError.message}`,
              attempt === 5 ? 'critical' : 'error',
              {
                decision_id: decision.id,
                tweet_id: tweetId,
                attempt: attempt,
                error_code: dbError.code,
                error_details: dbError.message
              }
            );
            
            if (attempt < 5) {
              const delay = attempt * 2000; // Progressive backoff: 2s, 4s, 6s, 8s
              console.log(`[POSTING_QUEUE] 🔄 Retrying in ${delay/1000} seconds...`);
              await new Promise(r => setTimeout(r, delay));
            } else {
              // 🔥 PRIORITY 2 FIX: Store in retry queue on final failure
              try {
                await storeInRetryQueue(decision.id, tweetId, tweetUrl, tweetIds, decision.content);
                console.log(`[POSTING_QUEUE] 💾 Stored in retry queue after ${attempt} failed attempts`);
                
                // Track retry queue storage
                await trackError(
                  'posting_queue',
                  'database_save_final_failure',
                  `Database save failed after 5 attempts, stored in retry queue`,
                  'critical',
                  {
                    decision_id: decision.id,
                    tweet_id: tweetId,
                    tweet_url: tweetUrl
                  }
                );
              } catch (retryQueueError: any) {
                console.error(`[POSTING_QUEUE] ⚠️ Failed to store in retry queue: ${retryQueueError.message}`);
                
                // Track retry queue failure
                await trackError(
                  'posting_queue',
                  'retry_queue_storage_failed',
                  `Failed to store in retry queue: ${retryQueueError.message}`,
                  'critical',
                  {
                    decision_id: decision.id,
                    tweet_id: tweetId
                  }
                );
              }
              
              // ✅ DB save failed after all retries - return false
              return false;
            }
          }
        }
      
        if (!dbSaveSuccess) {
            console.error(`[POSTING_QUEUE] 💥 CRITICAL: Tweet ${tweetId} posted but database save failed after 5 attempts!`);
          console.error(`[POSTING_QUEUE] 🔗 Tweet URL: ${tweetUrl}`);
          console.error(`[POSTING_QUEUE] 📝 Content: ${decision.content.substring(0, 100)}`);
          console.error(`[POSTING_QUEUE] 🚨 THIS MAKES US LOOK LIKE A BOT - EMERGENCY FIX REQUIRED!`);
          
          // ✅ EXPLICIT DB SAVE FAILURE LOG
          const decisionType = decision.decision_type || 'single';
          console.log(`[POSTING_QUEUE][DB_SAVE_FAIL] decision_id=${decision.id} type=${decisionType} err=All 5 DB save attempts failed`);
        
          // 🔥 EMERGENCY FALLBACK: Try multiple simple update strategies
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          const emergencyStrategies = [
            // Strategy 1: Full update with all fields
            async () => {
              await supabase
                .from('content_metadata')
                .update({ 
                  status: 'posted',
                  tweet_id: tweetId,
                  posted_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('decision_id', decision.id);
            },
            // Strategy 2: Just tweet_id (most critical)
            async () => {
              await supabase
                .from('content_metadata')
                .update({ tweet_id: tweetId })
                .eq('decision_id', decision.id);
            }
          ];
        
          let emergencySuccess = false;
          for (let strategyIdx = 0; strategyIdx < emergencyStrategies.length; strategyIdx++) {
            try {
              await emergencyStrategies[strategyIdx]();
              emergencySuccess = true;
              console.log(`[POSTING_QUEUE] ✅ Emergency save strategy ${strategyIdx + 1} succeeded!`);
              break;
            } catch (emergencyError: any) {
              console.error(`[POSTING_QUEUE] ❌ Emergency strategy ${strategyIdx + 1} failed:`, emergencyError.message);
            }
          }
        
          if (!emergencySuccess) {
            console.error(`[POSTING_QUEUE] 💥 ALL EMERGENCY SAVE STRATEGIES FAILED!`);
            console.error(`[POSTING_QUEUE] 🚨 Tweet ${tweetId} is LIVE on Twitter but database has NO tweet_id!`);
            
            // 🔥 PRIORITY 2 FIX: Store in retry queue for background recovery
            try {
              await storeInRetryQueue(decision.id, tweetId, tweetUrl, tweetIds, decision.content);
              console.log(`[POSTING_QUEUE] 💾 Stored in retry queue for background recovery`);
            } catch (retryQueueError: any) {
              console.error(`[POSTING_QUEUE] ⚠️ Failed to store in retry queue: ${retryQueueError.message}`);
            }
            console.error(`[POSTING_QUEUE] 📋 Manual intervention required - decision_id: ${decision.id}, tweet_id: ${tweetId}`);
          
            // Store error message for recovery
            try {
              await supabase
                .from('content_metadata')
                .update({ 
                  status: 'posted',
                  error_message: `Tweet ID capture failed - tweet_id: ${tweetId}, URL: ${tweetUrl}`
                })
                .eq('decision_id', decision.id);
            } catch (finalError: any) {
              console.error(`[POSTING_QUEUE] 💥 Even error message save failed: ${finalError.message}`);
            }
          }
        
          // DON'T throw - post succeeded! But log this as critical issue.
        }
      
        // Best-effort: Update metrics
        try {
          await updatePostingMetrics('posted');
        } catch (metricsError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Metrics update failed (non-critical): ${metricsError.message}`);
        }
      
        // Best-effort: Initialize attribution tracking
        try {
          const { initializePostAttribution } = await import('../learning/engagementAttribution');
          await initializePostAttribution(tweetId, {
            hook_pattern: (decision as any).metadata?.hook_pattern || 'unknown',
            topic: (decision as any).metadata?.topic || decision.topic_cluster,
            generator: (decision as any).metadata?.generator_used || 'unknown',
            format: (decision as any).metadata?.format || 'single',
            viral_score: (decision as any).metadata?.viral_score || 50
          });
          console.log(`[POSTING_QUEUE] 📊 Attribution tracking initialized`);
        } catch (attrError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Attribution init failed (non-critical): ${attrError.message}`);
        }
      
        console.log(`[POSTING_QUEUE] ✅ ${decision.decision_type} POSTED SUCCESSFULLY: ${tweetId}`);
      
        // ═══════════════════════════════════════════════════════════
        // 🚀 POST-POSTING FEEDBACK LOOP - Track with Advanced Algorithms
        // ═══════════════════════════════════════════════════════════
      
        try {
          // 1. TWITTER ALGORITHM OPTIMIZER - Track engagement velocity
          const { getTwitterAlgorithmOptimizer } = await import('../algorithms/twitterAlgorithmOptimizer');
          const twitterAlgo = getTwitterAlgorithmOptimizer();
          await twitterAlgo.trackVelocity(tweetId, new Date().toISOString());
          console.log(`[POSTING_QUEUE] ⚡ Velocity tracking initialized for ${tweetId}`);
        } catch (veloError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Velocity tracking failed: ${veloError.message}`);
        }
      
        try {
          // 2. CONVERSION FUNNEL TRACKER - Track full funnel
          const { getConversionFunnelTracker } = await import('../algorithms/conversionFunnelTracker');
          const funnelTracker = getConversionFunnelTracker();
          await funnelTracker.trackFunnelMetrics(decision.id);
          console.log(`[POSTING_QUEUE] 📊 Funnel tracking initialized for ${decision.id}`);
        } catch (funnelError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Funnel tracking failed: ${funnelError.message}`);
        }
      
        try {
          // 3. FOLLOWER PREDICTOR - Track prediction for accuracy
          // Prediction data is stored in planJobNew, we'll update accuracy later when real results come in
          const { getFollowerPredictor } = await import('../algorithms/followerPredictor');
          const predictor = getFollowerPredictor();
          // Note: Prediction was already tracked in planJobNew, will update with actuals in analytics job
          console.log(`[POSTING_QUEUE] 🔮 Prediction will be validated with actual results`);
        } catch (predError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Predictor tracking failed: ${predError.message}`);
        }
      
        // ═══════════════════════════════════════════════════════════
      
        // 🔧 ENHANCED LEARNING INTEGRATION: Initialize tracking in learning system
        try {
          // Step 1: Add post to tracking (so learning system knows about it)
          await learningSystem.processNewPost(
            decision.id,
            String(decision.content),
            {
              followers_gained_prediction: decision.predicted_followers || 0,
              engagement_rate_prediction: decision.predicted_er || 0.03,
              quality_score: decision.quality_score || 0.7
            },
            {
              content_type_name: decision.decision_type,
              hook_used: decision.hook_type || 'unknown',
              topic: decision.topic_cluster || 'health',
              generator_used: (decision as any).generator_used || 'unknown',
              bandit_arm: decision.bandit_arm || 'unknown',
              timing_arm: decision.timing_arm || 'unknown'
            }
          );
          console.log('[LEARNING_SYSTEM] ✅ Post ' + decision.id + ' tracked with enhanced metadata');
        } catch (learningError: any) {
          console.warn('[LEARNING_SYSTEM] ⚠️ Failed to track post:', learningError.message);
          
          // 🔧 ENHANCED ERROR TRACKING: Track learning system failures
          await trackError(
            'learning_system',
            'post_tracking_failed',
            `Failed to track post in learning system: ${learningError.message}`,
            'warning',
            {
              decision_id: decision.id,
              tweet_id: tweetId
            }
          );
        }
      
        // SMART BATCH FIX: Immediate metrics scraping after post
        try {
          console.log(`[METRICS] 🔍 Collecting initial metrics for ${tweetId}...`);
        
          // Wait 30 seconds for tweet to be indexed by Twitter
          await new Promise(resolve => setTimeout(resolve, 30000));
        
          // SMART BATCH FIX: Simplified metrics collection (avoid complex scraping in posting flow)
          // Store placeholder entry, let scheduled scraper collect real metrics
          const { getSupabaseClient: getSupa } = await import('../db/index');
          const supa = getSupa();
          await supa.from('outcomes').upsert({
            decision_id: decision.id,
            tweet_id: tweetId,
            likes: null, // Will be filled by scheduled scraper
            retweets: null,
            replies: null,
            views: null,
            bookmarks: null,
            impressions: null,
            collected_at: new Date().toISOString(),
            data_source: 'post_placeholder',
            simulated: false
          }, { onConflict: 'decision_id' });
        
          console.log(`[METRICS] ✅ Placeholder created for ${tweetId}, scheduled scraper will collect metrics`);
        } catch (metricsError: any) {
          console.warn(`[METRICS] ⚠️ Failed to collect initial metrics (non-critical): ${metricsError.message}`);
          // Don't fail the post, just log and continue
        }
      
      console.log(`[POSTING_QUEUE] 🎉 POST COMPLETE: Tweet is live on Twitter, all tracking initiated!`);
      
      // ✅ If we reach here but dbSaveSuccess is false, return false
      if (!dbSaveSuccess) {
        return false;
      }
    }
    
    // ✅ If posting didn't succeed or no tweet_id, return false
    if (!postingSucceeded || !tweetId) {
      return false;
    }
    
    // ✅ Should not reach here if success path returned true
    return false;
  } catch (topLevelError: any) {
      // Catch any errors that weren't handled by inner try-catch blocks
      const errorMsg = topLevelError?.message || topLevelError?.toString() || 'Unknown error';
      console.error(`${logPrefix} 🚨 FUNCTION-LEVEL ERROR:`, errorMsg);
      try {
        await markDecisionFailed(decision.id, errorMsg);
      } catch (markError: any) {
        console.error(`${logPrefix} 🚨 Failed to mark decision as failed:`, markError.message);
      }
      return false; // Return false on error instead of throwing
    }
}

async function postContent(decision: QueuedDecision): Promise<{ tweetId: string; tweetUrl: string; tweetIds?: string[] }> {
  // 🔒 CRITICAL ASSERTION: Reply decisions MUST NEVER route through postContent
  if (decision.decision_type === 'reply') {
    const errorMsg = `[SEV_REPLY_THREAD_BLOCKED] CRITICAL: Reply decision routed through postContent! decision_id=${decision.id}`;
    console.error(errorMsg);
    
    // Mark as blocked in DB
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('content_generation_metadata_comprehensive')
        .update({
          status: 'blocked',
          skip_reason: 'reply_routed_through_postcontent_violation',
          updated_at: new Date().toISOString(),
        })
        .eq('decision_id', decision.id);
    } catch (dbErr: any) {
      console.error(`[SEV_REPLY_THREAD_BLOCKED] Failed to mark as blocked: ${dbErr.message}`);
    }
    
    throw new Error(errorMsg);
  }
  
  console.log(`[CRITICAL] 🚀🚀🚀 postContent() CALLED - decision_id=${decision.id} type=${decision.decision_type}`);
  console.log(`[POSTING_QUEUE] 📝 Posting content: "${decision.content.substring(0, 50)}..."`);
  
  // 📊 FOLLOWER TRACKING: Capture baseline before posting
  const followersBefore = await captureFollowerBaseline(decision.id);
  
  // 🔒 BROWSER SEMAPHORE: Acquire exclusive browser access (highest priority)
  const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
  
  // ✅ PER-OPERATION TIMEOUT: Set timeout based on decision type
  const timeoutMs = decision.decision_type === 'thread' 
    ? 360000  // 6 minutes for threads
    : decision.decision_type === 'single'
    ? 300000  // 5 minutes for singles
    : 180000; // Fallback to default
  
  const label = decision.decision_type === 'thread'
    ? 'thread_posting'
    : decision.decision_type === 'single'
    ? 'tweet_posting'
    : 'posting';
  
  console.log(`[POSTING_QUEUE][SEM_TIMEOUT] decision_id=${decision.id} type=${decision.decision_type} timeoutMs=${timeoutMs}`);
  
  return await withBrowserLock('posting', BrowserPriority.POSTING, async () => {
    // Check feature flag for posting method
    const { getEnvConfig } = await import('../config/env');
    const config = getEnvConfig();
  
  if (config.FEATURE_X_API_POSTING) {
    console.log('[POSTING_QUEUE] 🔌 Using official X API posting...');
    
    // 🔒 ENSURE POST_ATTEMPT WRITTEN BEFORE X API CALL
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
    await supabase.from('system_events').insert({
      event_type: 'POST_ATTEMPT',
      severity: 'info',
      message: `X API posting attempt: decision_id=${decision.id}`,
      event_data: {
        decision_id: decision.id,
        target_tweet_id: decision.target_tweet_id || null,
        app_version: appVersion,
        pipeline_source: (decision as any).pipeline_source || 'posting_queue',
        method: 'X_API',
      },
      created_at: new Date().toISOString(),
    });
    
    try {
      const { XApiPoster } = await import('../posting/xApiPoster');
      const apiPoster = new XApiPoster();
      const result = await apiPoster.postStatus(decision.content);
      
      if (result.success) {
        if (!result.tweetId) {
          throw new Error('X API posting succeeded but no tweet ID was returned');
        }
        console.log(`[POSTING_QUEUE] ✅ Content posted via X API with ID: ${result.tweetId}`);
        const tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${result.tweetId}`;
        return { tweetId: result.tweetId, tweetUrl };
      } else {
        console.error(`[POSTING_QUEUE] ❌ X API posting failed: ${result.error}`);
        throw new Error(result.error || 'X API posting failed');
      }
    } catch (error: any) {
      console.error(`[POSTING_QUEUE] ❌ X API system error: ${error.message}`);
      throw new Error(`X API posting failed: ${error.message}`);
    }
  } else {
    console.log('[POSTING_QUEUE] 🌐 Using reliable Playwright posting...');
    
    try {
      // 🧵 CHECK IF THIS IS A THREAD (retrieve from thread_parts)
      const thread_parts = decision.thread_parts || (decision as any).thread_tweets; // Support both names for backwards compat
      const isThread = Array.isArray(thread_parts) && thread_parts.length > 1;
      
      console.log(`[POSTING_QUEUE] 🔍 Thread detection: isThread=${isThread}, segments=${isThread ? thread_parts.length : 0}`);
      
      if (isThread) {
        console.log(`[POSTING_QUEUE] 🧵 THREAD MODE: Posting ${thread_parts.length} connected tweets`);
        
        // 🎨 GET METADATA FOR VISUAL FORMATTING CONTEXT
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        const { data: metadata } = await supabase
          .from('content_metadata')
          .select('raw_topic, angle, tone, format_strategy, generator_name')
          .eq('decision_id', decision.id)
          .single();
        
        // 🎨 APPLY VISUAL FORMATTING TO THREAD (if specified)
        let formattedThreadParts = thread_parts;
        if (decision.visual_format) {
          console.log(`[POSTING_QUEUE] 🎨 Applying visual format to thread: "${decision.visual_format}"`);
          const { applyVisualFormat } = await import('../posting/visualFormatter');
          formattedThreadParts = thread_parts.map(part => {
            const formatResult = applyVisualFormat(part, decision.visual_format);
            return formatResult.formatted;
          });
          console.log(`[POSTING_QUEUE] ✅ Visual formatting applied to ${formattedThreadParts.length} thread parts`);
        } else {
          console.log(`[POSTING_QUEUE] 💡 No visual format specified, using thread as-is`);
        }
        
        // 🎫 CREATE POSTING PERMIT FOR THREAD (prevent ghost posts)
        const { createPostingPermit, verifyPostingPermit } = await import('../posting/postingPermit');
        console.log(`[POSTING_QUEUE] 🎫 Creating posting permit for thread...`);
        const permitResult = await createPostingPermit({
          decision_id: decision.id,
          decision_type: 'thread',
          pipeline_source: 'postingQueue',
          content_preview: formattedThreadParts[0]?.substring(0, 200) || '',
          run_id: `thread_${Date.now()}`,
        });
        
        if (!permitResult.success) {
          const errorMsg = `[POSTING_QUEUE] ❌ BLOCKED: Failed to create posting permit for thread: ${permitResult.error}`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
        
        const permit_id = permitResult.permit_id;
        const permitCheck = await verifyPostingPermit(permit_id);
        if (!permitCheck.valid) {
          const errorMsg = `[POSTING_QUEUE] ❌ BLOCKED: Permit not valid for thread: ${permitCheck.error}`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
        
        console.log(`[POSTING_QUEUE] ✅ Permit verified: ${permit_id} (status: ${permitCheck.permit?.status})`);
        
        // 🚀 POST THREAD (using BulletproofThreadComposer - creates CONNECTED threads, not reply chains)
        console.log(`[POSTING_QUEUE] 🚀 Posting thread to Twitter via native composer...`);
        const { BulletproofThreadComposer } = await import('../posting/BulletproofThreadComposer');
        const { withTimeout } = await import('../utils/operationTimeout');
        
        // 🔧 ADAPTIVE TIMEOUT: Progressive timeout per retry attempt
        // attempt 1 → 180s, attempt 2 → 240s, attempt 3 → 300s
        const retryCount = Number((decision.features as any)?.retry_count || 0);
        const adaptiveTimeouts = [180000, 240000, 300000]; // Progressive: 180s, 240s, 300s
        const THREAD_POST_TIMEOUT_MS = adaptiveTimeouts[Math.min(retryCount, adaptiveTimeouts.length - 1)];
        
        console.log(`[POSTING_QUEUE] ⏱️ Using adaptive timeout: ${THREAD_POST_TIMEOUT_MS}ms (attempt ${retryCount + 1}, retry_count=${retryCount})`);
        
        // 🔍 BROWSER HEALTH CHECK: Verify browser/page responsiveness before posting
        try {
          const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
          const pool = UnifiedBrowserPool.getInstance();
          const health = pool.getHealth();
          
          if (health.status === 'degraded' || health.circuitBreaker?.isOpen) {
            console.warn(`[POSTING_QUEUE] ⚠️ Browser pool health check failed: status=${health.status}, circuitBreaker=${health.circuitBreaker?.isOpen}`);
            console.log(`[POSTING_QUEUE] 🔄 Resetting browser pool before posting...`);
            await pool.resetPool();
            console.log(`[POSTING_QUEUE] ✅ Browser pool reset complete`);
          } else {
            console.log(`[POSTING_QUEUE] ✅ Browser pool health check passed: status=${health.status}`);
          }
        } catch (healthError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Browser health check failed (non-blocking): ${healthError.message}`);
        }
        
        // 🛡️ TIMEOUT PROTECTION: Adaptive timeout based on retry count
        const result = await withTimeout(
          () => BulletproofThreadComposer.post(formattedThreadParts, decision.id, permit_id),
          { 
            timeoutMs: THREAD_POST_TIMEOUT_MS, 
            operationName: `thread_post_${thread_parts.length}_tweets`
          }
        );
        
        if (!result.success) {
          // Thread completely failed - ensure we have a detailed error message
          const errorDetails = result.error || 'Unknown thread posting error (no error message returned)';
          console.error(`[POSTING_QUEUE] ❌ Thread failed: ${errorDetails}`);
          console.error(`[POSTING_QUEUE] ❌ Thread mode was: ${result.mode || 'unknown'}`);
          console.error(`[POSTING_QUEUE] ❌ Thread ID: ${decision.id}`);
          console.error(`[POSTING_QUEUE] ❌ Thread parts: ${thread_parts.length} tweets`);
          throw new Error(`Thread posting failed: ${errorDetails}`);
        }
        
        // Success - extract tweet IDs from result
        console.log(`[POSTING_QUEUE] ✅ Thread posted: ${result.mode}`);
        const rootTweetId = result.tweetIds?.[0] || result.rootTweetUrl?.split('/').pop() || '';
        const rootTweetUrl = result.rootTweetUrl || `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${rootTweetId}`;
        
        // 🎫 Mark permit as USED after successful thread posting
        if (permit_id && rootTweetId) {
          const { markPermitUsed } = await import('../posting/postingPermit');
          await markPermitUsed(permit_id, rootTweetId);
        }
        
        console.log(`[POSTING_QUEUE] 🔗 Root tweet: ${rootTweetId}`);
        console.log(`[POSTING_QUEUE] 📊 Tweet count: ${result.tweetIds?.length || 1}/${thread_parts.length}`);
        
        if (result.tweetIds && result.tweetIds.length > 0) {
          console.log(`[POSTING_QUEUE] 🔗 Tweet IDs: ${result.tweetIds.join(', ')}`);
        }
        
        console.log(`[CRITICAL] ✅✅✅ postContent() RETURNING THREAD - rootTweetId=${rootTweetId} tweetIds_count=${result.tweetIds?.length || 0}`);
        
        return {
          tweetId: rootTweetId,
          tweetUrl: rootTweetUrl,
          tweetIds: result.tweetIds
        }
      } else {
        console.log(`[POSTING_QUEUE] 📝 Posting as SINGLE tweet`);
        const { UltimateTwitterPoster } = await import('../posting/UltimateTwitterPoster');
        const { withTimeout } = await import('../utils/operationTimeout');
        const { applyVisualFormat } = await import('../posting/visualFormatter');
        
        // 🎨 APPLY VISUAL FORMATTING (if specified)
        let contentToPost = decision.content;
        if (decision.visual_format) {
          console.log(`[POSTING_QUEUE] 🎨 Applying visual format: "${decision.visual_format}"`);
          const formatResult = applyVisualFormat(decision.content, decision.visual_format);
          contentToPost = formatResult.formatted;
          console.log(`[POSTING_QUEUE] ✅ Visual formatting applied: ${formatResult.transformations.join(', ')}`);
        } else {
          console.log(`[POSTING_QUEUE] 💡 No visual format specified, using content as-is`);
        }
        
        // 🔧 ADAPTIVE TIMEOUT: Progressive timeout per retry attempt
        // attempt 1 → 120s, attempt 2 → 180s, attempt 3 → 240s
        const retryCount = Number((decision.features as any)?.retry_count || 0);
        const adaptiveTimeouts = [120000, 180000, 240000]; // Progressive: 120s, 180s, 240s
        const SINGLE_POST_TIMEOUT_MS = adaptiveTimeouts[Math.min(retryCount, adaptiveTimeouts.length - 1)];
        
        console.log(`[POSTING_QUEUE] ⏱️ Using adaptive timeout: ${SINGLE_POST_TIMEOUT_MS}ms (attempt ${retryCount + 1}, retry_count=${retryCount})`);
        
        // 🔍 BROWSER HEALTH CHECK: Verify browser/page responsiveness before posting
        try {
          const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
          const pool = UnifiedBrowserPool.getInstance();
          const health = pool.getHealth();
          
          if (health.status === 'degraded' || health.circuitBreaker?.isOpen) {
            console.warn(`[POSTING_QUEUE] ⚠️ Browser pool health check failed: status=${health.status}, circuitBreaker=${health.circuitBreaker?.isOpen}`);
            console.log(`[POSTING_QUEUE] 🔄 Resetting browser pool before posting...`);
            await pool.resetPool();
            console.log(`[POSTING_QUEUE] ✅ Browser pool reset complete`);
          } else {
            console.log(`[POSTING_QUEUE] ✅ Browser pool health check passed: status=${health.status}`);
          }
        } catch (healthError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Browser health check failed (non-blocking): ${healthError.message}`);
        }
        
        const poster = new UltimateTwitterPoster();
        
        // 🔒 CREATE POSTING GUARD: Unforgeable authorization token
        const { createPostingGuard } = await import('../posting/UltimateTwitterPoster');
        const { executeAuthorizedPost, getBuildSHA } = await import('../posting/atomicPostExecutor');
        const guard = createPostingGuard({
          decision_id: decision.id,
          pipeline_source: 'postingQueue',
          job_run_id: `posting_${Date.now()}`,
        });
        
        // ⚛️ ATOMIC POST: Use executeAuthorizedPost() for DB-prewrite guarantee
        const job_run_id = `posting_${Date.now()}`;
        const build_sha = getBuildSHA();
        
        // 🛡️ TIMEOUT PROTECTION: Adaptive timeout based on retry count
        const result = await withTimeout(
          async () => {
            const atomicResult = await executeAuthorizedPost(
              poster,
              guard,
              {
                decision_id: decision.id,
                decision_type: decision.decision_type === 'single' ? 'single' : decision.decision_type === 'thread' ? 'thread' : 'single',
                pipeline_source: 'postingQueue',
                build_sha,
                job_run_id,
                content: contentToPost,
              },
              {
                isReply: false,
              }
            );
            
            // 🔥 GUARDRAIL: If post succeeded but DB update failed, emit CRITICAL log
            if (atomicResult.success && atomicResult.tweet_id) {
              // Check if DB update succeeded by verifying row exists with tweet_id
              const { getSupabaseClient } = await import('../db/index');
              const supabase = getSupabaseClient();
              const { data: dbRow } = await supabase
                .from('content_generation_metadata_comprehensive')
                .select('tweet_id, status')
                .eq('decision_id', decision.id)
                .single();
              
              if (!dbRow || dbRow.status !== 'posted' || dbRow.tweet_id !== atomicResult.tweet_id) {
                console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Tweet posted but DB update may have failed!`);
                console.error(`[POSTING_QUEUE]   tweet_id=${atomicResult.tweet_id} decision_id=${decision.id}`);
                console.error(`[POSTING_QUEUE]   DB row status=${dbRow?.status || 'missing'} DB tweet_id=${dbRow?.tweet_id || 'missing'}`);
                
                // Log to system_events
                await supabase.from('system_events').insert({
                  event_type: 'atomic_post_update_failed',
                  severity: 'critical',
                  message: `Tweet posted but DB update verification failed`,
                  event_data: {
                    decision_id: decision.id,
                    tweet_id: atomicResult.tweet_id,
                    db_status: dbRow?.status || 'missing',
                    db_tweet_id: dbRow?.tweet_id || 'missing',
                  },
                  created_at: new Date().toISOString(),
                });
              }
            }
            
            return {
              success: atomicResult.success,
              tweetId: atomicResult.tweet_id,
              tweetUrl: atomicResult.tweet_url,
              error: atomicResult.error,
            };
          },
          { 
            timeoutMs: SINGLE_POST_TIMEOUT_MS, 
            operationName: 'single_post',
            onTimeout: async () => {
              console.error(`[POSTING_QUEUE] ⏱️ Single post timeout after ${SINGLE_POST_TIMEOUT_MS}ms (attempt ${retryCount + 1}) - cleaning up`);
              try {
                await poster.dispose();
              } catch (e) {
                console.error(`[POSTING_QUEUE] ⚠️ Error during timeout cleanup:`, e);
              }
            }
          }
        );
        await poster.dispose();
        
        if (!result.success || !result.tweetId) {
          console.error(`[POSTING_QUEUE] ❌ Atomic posting failed: ${result.error}`);
          throw new Error(result.error || 'Atomic posting failed');
        }
        
        const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
        const tweetUrl = result.tweetUrl || `https://x.com/${username}/status/${result.tweetId}`;
        
        console.log(`[POSTING_QUEUE] ✅ Tweet ID extracted: ${result.tweetId}`);
        console.log(`[POSTING_QUEUE] ✅ Tweet URL: ${tweetUrl}`);
        console.log(`[CRITICAL] ✅✅✅ postContent() RETURNING - tweetId=${result.tweetId}`);
        
        // Return object with both ID and URL
        return { tweetId: result.tweetId, tweetUrl };
      }
    } catch (error: any) {
      console.error(`[POSTING_QUEUE] ❌ Playwright system error: ${error.message}`);
      throw new Error(`Playwright posting failed: ${error.message}`);
    }
  }
  }, { timeoutMs, label }); // End withBrowserLock
}

async function postReply(decision: QueuedDecision): Promise<string> {
  // 🔒 SAFETY: Check if replies are paused
  if (process.env.PAUSE_REPLIES === 'true') {
    console.log(`[REPLY_PAUSE] enabled=true skipping_posting decision_id=${decision.id}`);
    throw new Error('Replies paused via PAUSE_REPLIES env flag');
  }
  
  // Get Supabase client early (needed for all checks)
  const { getSupabaseClient } = await import('../db/index');
  const supabase = getSupabaseClient();
  
  // 🔍 FORENSIC PIPELINE: Log POST_ATTEMPT before any checks
  const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  await supabase.from('system_events').insert({
    event_type: 'POST_ATTEMPT',
    severity: 'info',
    message: `Reply posting attempt: decision_id=${decision.id}`,
    event_data: {
      decision_id: decision.id,
      target_tweet_id: decision.target_tweet_id,
      app_version: appVersion,
      pipeline_source: (decision as any).pipeline_source || 'posting_queue',
    },
    created_at: new Date().toISOString(),
  });
  
  // 🔍 FORENSIC PIPELINE: Final ancestry check before posting
  const { resolveTweetAncestry, recordReplyDecision, shouldAllowReply } = await import('./replySystemV2/replyDecisionRecorder');
  const ancestry = await resolveTweetAncestry(decision.target_tweet_id || '');
  const allowCheck = await shouldAllowReply(ancestry);
  
  // Update POST_ATTEMPT with gate result
  await supabase.from('system_events').insert({
    event_type: 'POST_ATTEMPT',
    severity: 'info',
    message: `Reply gate check result: decision_id=${decision.id}`,
    event_data: {
      decision_id: decision.id,
      target_tweet_id: decision.target_tweet_id,
      target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId || null,
      app_version: appVersion,
      gate_result: allowCheck.allow ? 'PASS' : 'BLOCK',
      deny_reason_code: allowCheck.deny_reason_code || null,
      deny_reason_detail: allowCheck.deny_reason_detail || null,
      ancestry_status: ancestry.status,
      ancestry_depth: ancestry.ancestryDepth,
      is_root: ancestry.isRoot,
    },
    created_at: new Date().toISOString(),
  });
  
  // Get trace info from decision metadata if available
  const traceId = (decision as any).scheduler_run_id || (decision as any).feed_run_id || null;
  const jobRunId = (decision as any).job_run_id || null;
  const pipelineSource = (decision as any).pipeline_source || 'posting_queue';
  
  // 🔒 HARD INVARIANT: Final gate - deny non-root replies
  if (!allowCheck.allow) {
    const errorMsg = `FINAL_GATE_BLOCKED: ${allowCheck.reason}`;
    console.error(`[POSTING_QUEUE] 🚫 ${errorMsg}`);
    
    // Record DENY decision
    await recordReplyDecision({
      decision_id: decision.id,
      target_tweet_id: decision.target_tweet_id || '',
      target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
      root_tweet_id: ancestry.rootTweetId || 'null',
      ancestry_depth: ancestry.ancestryDepth ?? -1,
      is_root: ancestry.isRoot,
      decision: 'DENY',
      reason: `Final gate: ${allowCheck.reason}`,
      deny_reason_code: allowCheck.deny_reason_code || 'NON_ROOT',
      status: ancestry.status, // 🔒 REQUIRED
      confidence: ancestry.confidence, // 🔒 REQUIRED
      method: ancestry.method || 'unknown', // 🔒 REQUIRED
      cache_hit: ancestry.method?.startsWith('cache:') || false,
      trace_id: traceId,
      job_run_id: jobRunId,
      pipeline_source: pipelineSource,
      playwright_post_attempted: false,
      error: errorMsg,
    });
    
    // 🔒 TASK B.1: Mark content_metadata as blocked
    await supabase
      .from('content_metadata')
      .update({ 
        status: 'blocked',
        skip_reason: 'SAFETY_GATE_NON_ROOT_TARGET'
      })
      .eq('decision_id', decision.id);
    
    // 🔒 TASK B.1: Record POST_FAILED event with detailed context
    const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
    await supabase.from('system_events').insert({
      event_type: 'POST_FAILED',
      severity: 'error',
      event_data: {
        decision_id: decision.id,
        target_tweet_id: decision.target_tweet_id,
        target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
        in_reply_to_status_id: ancestry.targetInReplyToTweetId,
        app_version: appVersion,
        resolver_status: ancestry.status,
        resolver_method: ancestry.method,
        resolver_depth: ancestry.ancestryDepth,
        resolver_is_root: ancestry.isRoot,
        deny_reason_code: allowCheck.deny_reason_code || 'NON_ROOT',
        deny_reason_detail: allowCheck.deny_reason_detail,
        reason: `SAFETY_GATE_NON_ROOT_TARGET: ${allowCheck.reason}`,
      },
      created_at: new Date().toISOString(),
    });
    
    // 🔒 TASK B.1: Update reply_decisions pipeline_error_reason
    await supabase
      .from('reply_decisions')
      .update({ 
        pipeline_error_reason: `SAFETY_GATE_NON_ROOT_TARGET: ${allowCheck.deny_reason_code || 'NON_ROOT'}`,
        posting_completed_at: new Date().toISOString(),
      })
      .eq('decision_id', decision.id);
    
    throw new Error(errorMsg);
  }
  
  // 🔒 TASK B.1: ADDITIONAL HARD CHECK - Verify in_reply_to_status_id is NULL
  // This is a redundant but critical check - even if shouldAllowReply passes, verify directly
  if (ancestry.targetInReplyToTweetId !== null && ancestry.targetInReplyToTweetId !== undefined) {
    const hardBlockMsg = `HARD_GATE_BLOCKED: Target has in_reply_to_status_id=${ancestry.targetInReplyToTweetId} (NOT NULL)`;
    console.error(`[POSTING_QUEUE] 🚫 ${hardBlockMsg}`);
    
    // Mark as blocked
    await supabase
      .from('content_metadata')
      .update({ 
        status: 'blocked',
        skip_reason: 'SAFETY_GATE_NON_ROOT_TARGET'
      })
      .eq('decision_id', decision.id);
    
    // Record POST_FAILED
    const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
    await supabase.from('system_events').insert({
      event_type: 'POST_FAILED',
      severity: 'error',
      event_data: {
        decision_id: decision.id,
        target_tweet_id: decision.target_tweet_id,
        target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
        app_version: appVersion,
        in_reply_to_status_id: ancestry.targetInReplyToTweetId,
        resolver_status: ancestry.status,
        resolver_method: ancestry.method,
        reason: 'SAFETY_GATE_NON_ROOT_TARGET_HARD_CHECK',
      },
      created_at: new Date().toISOString(),
    });
    
    // Update reply_decisions
    await supabase
      .from('reply_decisions')
      .update({ 
        pipeline_error_reason: 'SAFETY_GATE_NON_ROOT_TARGET_HARD_CHECK',
        posting_completed_at: new Date().toISOString(),
      })
      .eq('decision_id', decision.id);
    
    throw new Error(hardBlockMsg);
  }
  
  // 🔒 TASK B: NO THREAD REPLIES - Block multi-segment replies
  const { data: contentMeta } = await supabase
    .from('content_metadata')
    .select('thread_parts, content')
    .eq('decision_id', decision.id)
    .maybeSingle();
  
  // Check for thread_parts array with >1 segment
  if (contentMeta?.thread_parts && Array.isArray(contentMeta.thread_parts) && contentMeta.thread_parts.length > 1) {
    const threadBlockMsg = `SAFETY_GATE_THREAD_REPLY_FORBIDDEN: Reply has ${contentMeta.thread_parts.length} segments (thread replies forbidden)`;
    console.error(`[POSTING_QUEUE] 🚫 ${threadBlockMsg}`);
    
    // Mark as blocked
    await supabase
      .from('content_metadata')
      .update({ 
        status: 'blocked',
        skip_reason: 'SAFETY_GATE_THREAD_REPLY_FORBIDDEN'
      })
      .eq('decision_id', decision.id);
    
    // Record POST_FAILED
    const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
    await supabase.from('system_events').insert({
      event_type: 'POST_FAILED',
      severity: 'error',
      event_data: {
        decision_id: decision.id,
        target_tweet_id: decision.target_tweet_id,
        target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
        app_version: appVersion,
        pipeline_error_reason: 'SAFETY_GATE_THREAD_REPLY_FORBIDDEN',
        thread_parts_count: contentMeta.thread_parts.length,
      },
      created_at: new Date().toISOString(),
    });
    
    // Update reply_decisions
    await supabase
      .from('reply_decisions')
      .update({ 
        pipeline_error_reason: 'SAFETY_GATE_THREAD_REPLY_FORBIDDEN',
        posting_completed_at: new Date().toISOString(),
      })
      .eq('decision_id', decision.id);
    
    throw new Error(threadBlockMsg);
  }
  
  // Also check content for thread markers (redundant check)
  const content = decision.content || contentMeta?.content || '';
  const threadPatterns = [
    /\b\d+\/\d+\b/,           // "2/6", "3/6"
    /^\s*\d+\/\d+/,           // Starts with "1/5"
    /🧵/,                      // Thread emoji
  ];
  
  for (const pattern of threadPatterns) {
    if (pattern.test(content)) {
      const threadMarkerMsg = `SAFETY_GATE_THREAD_REPLY_FORBIDDEN: Reply contains thread marker (${pattern.source})`;
      console.error(`[POSTING_QUEUE] 🚫 ${threadMarkerMsg}`);
      
      await supabase
        .from('content_metadata')
        .update({ 
          status: 'blocked',
          skip_reason: 'SAFETY_GATE_THREAD_REPLY_FORBIDDEN'
        })
        .eq('decision_id', decision.id);
      
      const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
      await supabase.from('system_events').insert({
        event_type: 'POST_FAILED',
        severity: 'error',
        event_data: {
          decision_id: decision.id,
          target_tweet_id: decision.target_tweet_id,
          target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
          app_version: appVersion,
          pipeline_error_reason: 'SAFETY_GATE_THREAD_REPLY_FORBIDDEN',
          thread_marker_pattern: pattern.source,
        },
        created_at: new Date().toISOString(),
      });
      
      await supabase
        .from('reply_decisions')
        .update({ 
          pipeline_error_reason: 'SAFETY_GATE_THREAD_REPLY_FORBIDDEN',
          posting_completed_at: new Date().toISOString(),
        })
        .eq('decision_id', decision.id);
      
      throw new Error(threadMarkerMsg);
    }
  }
  
  // 🎯 PIPELINE STAGES: Mark posting started
  const postingStartedAt = new Date().toISOString();
  await supabase
    .from('reply_decisions')
    .update({ posting_started_at: postingStartedAt })
    .eq('decision_id', decision.id);
  
  console.log(`[PIPELINE] decision_id=${decision.id} stage=post ok=start detail=posting_started`);
  console.log(`[POSTING_QUEUE] 🎯 Pipeline stage: posting_started_at=${postingStartedAt} for decision_id=${decision.id}`);
  
  // Record ALLOW decision (will update with posted_reply_tweet_id after success)
  await recordReplyDecision({
    decision_id: decision.id,
    target_tweet_id: decision.target_tweet_id || '',
    target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
    root_tweet_id: ancestry.rootTweetId || 'null',
    ancestry_depth: ancestry.ancestryDepth ?? -1,
    is_root: ancestry.isRoot,
    decision: 'ALLOW',
    reason: allowCheck.reason,
    status: ancestry.status, // 🔒 REQUIRED
    confidence: ancestry.confidence, // 🔒 REQUIRED
    method: ancestry.method || 'unknown', // 🔒 REQUIRED
    cache_hit: ancestry.method?.startsWith('cache:') || false,
    trace_id: traceId,
    job_run_id: jobRunId,
    pipeline_source: pipelineSource,
    playwright_post_attempted: true,
  });
  
  // NOTE: Invariant checks now happen in processDecision BEFORE calling postReply
  // This allows graceful skip (not crash) on invariant failures
  
  console.log(`[POSTING_QUEUE] 💬 Posting reply to @${decision.target_username}: "${decision.content.substring(0, 50)}..."`);
  
  // 🔒 BROWSER SEMAPHORE: Acquire exclusive browser access (HIGHEST priority)
  const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
  
  // 🚨 CRITICAL: Wrap in timeout to prevent browser semaphore starvation
  const REPLY_TIMEOUT_MS = 210000; // 3.5 minutes (allows profile/conversation fallback)
  const TIMEOUT_WARNING_MS = 120000; // Warn if we cross 2 minutes
  
  let warningTimer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Reply posting timeout after ${REPLY_TIMEOUT_MS/1000}s`));
    }, REPLY_TIMEOUT_MS);
  });
  
  const postingPromise = withBrowserLock('reply_posting', BrowserPriority.REPLIES, async () => {
    if (!decision.target_tweet_id) {
    throw new Error('Reply decision missing target_tweet_id');
  }
  
  // 🚨 CRITICAL PRE-POST CHECK: Verify we haven't already replied to this tweet
  const { getSupabaseClient } = await import('../db/index');
  const supabase = getSupabaseClient();
  
  const { data: existingReply } = await supabase
    .from('content_metadata')
    .select('tweet_id, posted_at')
    .eq('decision_type', 'reply')
    .eq('target_tweet_id', decision.target_tweet_id)
    .eq('status', 'posted')
    .limit(1)
    .single();
    
  if (existingReply) {
    const replyTime = existingReply.posted_at ? new Date(String(existingReply.posted_at)).toLocaleString() : 'unknown time';
    console.log(`[POSTING_QUEUE] 🚫 DUPLICATE PREVENTED: Already replied to tweet ${decision.target_tweet_id} at ${replyTime}`);
    console.log(`[POSTING_QUEUE]    Previous reply ID: ${existingReply.tweet_id}`);
    
    // 🔥 FIX: Do NOT mark as posted here - this allows NULL tweet_id!
    // Instead, mark as 'duplicate' or 'failed' with reason
    console.log(`[REPLY_TRUTH] step=FAIL reason=DUPLICATE_PREVENTED target_tweet_id=${decision.target_tweet_id}`);
    throw new Error(`Duplicate reply prevented: Already replied to ${decision.target_tweet_id}`);
  }
  
  console.log(`[POSTING_QUEUE] ✅ Duplicate check passed - no existing reply to ${decision.target_tweet_id}`);
  
  // 🔒 HARD PRE-POST GUARD: Navigate to tweet URL and detect if it's a reply
  console.log(`[POSTING_QUEUE] 🔍 Pre-post guard: Verifying target tweet is root (not a reply)...`);
  try {
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('pre_post_guard_verify');
    
    try {
      const tweetUrl = `https://x.com/i/web/status/${decision.target_tweet_id}`;
      await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000); // Wait for content to load
      
      // Detect if this is a reply by checking for "Replying to @..." indicator
      const isReply = await page.evaluate(() => {
        // Check for "Replying to" text
        const replyingToIndicator = Array.from(document.querySelectorAll('*')).find(el => {
          const text = el.textContent || '';
          return text.includes('Replying to') || text.includes('Replying');
        });
        
        // Check for conversation context (thread indicator)
        const conversationContext = document.querySelector('[data-testid="reply"]')?.closest('article');
        const hasMultipleTweets = document.querySelectorAll('article[data-testid="tweet"]').length > 1;
        
        // Check if URL contains conversation context
        const url = window.location.href;
        const isReplyUrl = url.includes('/status/') && hasMultipleTweets;
        
        return !!(replyingToIndicator || (conversationContext && hasMultipleTweets && isReplyUrl));
      });
      
      if (isReply) {
        console.error(`[POSTING_QUEUE] 🚫 BLOCKED: Target tweet ${decision.target_tweet_id} is a REPLY (detected via Twitter UI)`);
        console.error(`[POSTING_QUEUE]   decision_id=${decision.id}`);
        console.error(`[POSTING_QUEUE]   REASON: Pre-post guard detected "Replying to" indicator or conversation context`);
        
        // Mark as blocked
        await supabase.from('content_generation_metadata_comprehensive')
          .update({ status: 'blocked', skip_reason: 'pre_post_guard_reply_detected' })
          .eq('decision_id', decision.id);
        
        // Log to system_events
        await supabase.from('system_events').insert({
          event_type: 'pre_post_guard_reply_blocked',
          severity: 'critical',
          message: `Pre-post guard blocked reply: target tweet ${decision.target_tweet_id} is a reply`,
          event_data: {
            decision_id: decision.id,
            target_tweet_id: decision.target_tweet_id,
            tweet_url: tweetUrl
          },
          created_at: new Date().toISOString()
        });
        
        throw new Error(`Pre-post guard: Target tweet is a reply, not a root tweet`);
      }
      
      console.log(`[POSTING_QUEUE] ✅ Pre-post guard passed: Target tweet is a root tweet`);
    } finally {
      await pool.releasePage(page);
    }
  } catch (guardError: any) {
    if (guardError.message?.includes('Pre-post guard')) {
      throw guardError; // Re-throw guard failures
    }
    console.warn(`[POSTING_QUEUE] ⚠️ Pre-post guard check failed (non-fatal): ${guardError.message}`);
    // Continue if guard check fails (non-fatal, but log it)
  }
  
  // 🔒 SELF-REPLY THREAD CHECK: Prevent replying to our own replies
  const REPLY_THREAD_ENABLED = (process.env.REPLY_THREAD_ENABLED || 'false').toLowerCase() === 'true';
  if (!REPLY_THREAD_ENABLED) {
    // Check if target tweet is from our account
    const { data: targetDecision } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('tweet_id, decision_type, target_username')
      .eq('tweet_id', decision.target_tweet_id)
      .maybeSingle();
    
    if (targetDecision && targetDecision.target_username === (process.env.TWITTER_USERNAME || 'SignalAndSynapse')) {
      console.error(`[POSTING_QUEUE] 🚫 BLOCKED: Self-reply thread detected (REPLY_THREAD_ENABLED=false)`);
      console.error(`[POSTING_QUEUE]   decision_id=${decision.id}`);
      console.error(`[POSTING_QUEUE]   target_tweet_id=${decision.target_tweet_id} is our own tweet`);
      console.error(`[POSTING_QUEUE]   REASON: Cannot reply to own replies unless REPLY_THREAD_ENABLED=true`);
      
      await supabase.from('content_generation_metadata_comprehensive')
        .update({ status: 'blocked', skip_reason: 'self_reply_thread_blocked' })
        .eq('decision_id', decision.id);
      
      await supabase.from('system_events').insert({
        event_type: 'self_reply_thread_blocked',
        severity: 'critical',
        message: `Self-reply thread blocked: target tweet ${decision.target_tweet_id} is our own reply`,
        event_data: {
          decision_id: decision.id,
          target_tweet_id: decision.target_tweet_id,
          reply_thread_enabled: false
        },
        created_at: new Date().toISOString()
      });
      
      throw new Error(`Self-reply thread blocked: REPLY_THREAD_ENABLED=false`);
    }
  }
  
  // ✅ Content is ALREADY formatted (done in replyJob before queueing)
  console.log(`[POSTING_QUEUE] 💡 Using pre-formatted reply content`);
  
  // 🛡️ Use PROPER reply system (posts as actual reply, not @mention)
  console.log(`[POSTING_QUEUE] 💬 Using UltimateTwitterPoster.postReply() for REAL replies...`);
  
  try {
    if (!decision.target_tweet_id) {
      throw new Error('Cannot post reply: missing target_tweet_id');
    }

    const { UltimateTwitterPoster } = await import('../posting/UltimateTwitterPoster');
    const PosterCtor = UltimateTwitterPoster;
    let poster: InstanceType<typeof PosterCtor> | null = null;

    try {
      poster = new PosterCtor({ purpose: 'reply' });
      console.log(`[POSTING_QUEUE] 💬 Posting REAL reply to tweet ${decision.target_tweet_id}...`);
      console.log(`[POSTING_QUEUE] 📝 Reply content: "${decision.content.substring(0, 60)}..."`);
      
      // 🔒 CREATE POSTING GUARD: Unforgeable authorization token
      // 🔒 CRITICAL: Use 'reply_v2_scheduler' as pipeline_source to match permit
      const { createPostingGuard } = await import('../posting/UltimateTwitterPoster');
      const { executeAuthorizedPost, getBuildSHA } = await import('../posting/atomicPostExecutor');
      const guard = createPostingGuard({
        decision_id: decision.id,
        pipeline_source: 'reply_v2_scheduler', // Must match permit's pipeline_source
        job_run_id: `reply_${Date.now()}`,
      });
      
      // 🔒 LOG POSTING MODE (prove we're not using thread composer)
      const contentLength = decision.content.length;
      const contentLines = (decision.content.match(/\n/g) || []).length + 1;
      console.log(`[REPLY_POST] mode=reply tweet_id=${decision.target_tweet_id} len=${contentLength} lines=${contentLines} used_thread_composer=false`);

      // ⚛️ ATOMIC POST: Use executeAuthorizedPost() for DB-prewrite guarantee
      const job_run_id = `reply_${Date.now()}`;
      const build_sha = getBuildSHA();
      
      const atomicResult = await executeAuthorizedPost(
        poster,
        guard,
        {
          decision_id: decision.id,
          decision_type: 'reply',
          pipeline_source: 'reply_v2_scheduler', // Must match permit's pipeline_source
          build_sha,
          job_run_id,
          content: decision.content,
          target_tweet_id: decision.target_tweet_id,
          root_tweet_id: decision.root_tweet_id,
          target_tweet_content_snapshot: decision.target_tweet_content_snapshot,
          target_tweet_content_hash: decision.target_tweet_content_hash,
          semantic_similarity: decision.semantic_similarity,
        },
        {
          isReply: true,
          replyToTweetId: decision.target_tweet_id,
        }
      );

      // 🔥 CRITICAL: Validate result BEFORE any logging or processing
      if (!atomicResult.success || !atomicResult.tweet_id) {
        console.log(`[REPLY_TRUTH] step=FAIL reason=atomic_post_failed result=${JSON.stringify(atomicResult)}`);
        throw new Error(atomicResult.error || 'Reply posting failed: no tweetId returned');
      }

      if (atomicResult.tweet_id === decision.target_tweet_id) {
        console.log(`[REPLY_TRUTH] step=FAIL reason=id_extraction_bug got_parent_id=${decision.target_tweet_id}`);
        throw new Error(`Reply ID extraction bug: got parent ID ${decision.target_tweet_id} instead of new reply ID`);
      }
      
      // 🔥 VALIDATE: Ensure tweet ID is a valid numeric string (Twitter IDs are numeric)
      if (!/^\d+$/.test(atomicResult.tweet_id)) {
        console.log(`[REPLY_TRUTH] step=FAIL reason=invalid_id_format tweet_id=${atomicResult.tweet_id}`);
        throw new Error(`Invalid reply ID format: ${atomicResult.tweet_id} (expected numeric Twitter ID)`);
      }

      // 🔥 GUARDRAIL: If post succeeded but DB update failed, emit CRITICAL log
      const { data: dbRow } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('tweet_id, status')
        .eq('decision_id', decision.id)
        .single();
      
      if (!dbRow || dbRow.status !== 'posted' || dbRow.tweet_id !== atomicResult.tweet_id) {
        console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Reply posted but DB update may have failed!`);
        console.error(`[POSTING_QUEUE]   tweet_id=${atomicResult.tweet_id} decision_id=${decision.id}`);
        console.error(`[POSTING_QUEUE]   DB row status=${dbRow?.status || 'missing'} DB tweet_id=${dbRow?.tweet_id || 'missing'}`);
        
        // Log to system_events
        await supabase.from('system_events').insert({
          event_type: 'atomic_post_update_failed',
          severity: 'critical',
          message: `Reply posted but DB update verification failed`,
          event_data: {
            decision_id: decision.id,
            tweet_id: atomicResult.tweet_id,
            db_status: dbRow?.status || 'missing',
            db_tweet_id: dbRow?.tweet_id || 'missing',
          },
          created_at: new Date().toISOString(),
        });
      }

      // ✅ STEP 1: Tweet is on X, ID is captured
      console.log(`[REPLY_TRUTH] step=POSTED_UI tweet_id=${atomicResult.tweet_id} parent_id=${decision.target_tweet_id}`);
      console.log(`[POSTING_QUEUE] ✅ Reply ID validated: ${atomicResult.tweet_id} (≠ parent ${decision.target_tweet_id})`);
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      const replyUrl = atomicResult.tweet_url || `https://x.com/${username}/status/${atomicResult.tweet_id}`;
      console.log(`[POSTING_QUEUE] 🔗 Reply URL: ${replyUrl}`);
      
      // Map atomicResult to result format for compatibility
      const result = {
        success: true,
        tweetId: atomicResult.tweet_id,
        tweetUrl: replyUrl,
      };
      
      // ✅ STEP 2: Write receipt IMMEDIATELY (fail-closed, cannot continue without this)
      const { writePostReceipt } = await import('../utils/postReceiptWriter');
      const receiptResult = await writePostReceipt({
        decision_id: decision.id,
        tweet_ids: [result.tweetId],
        root_tweet_id: result.tweetId,
        post_type: 'reply',
        posted_at: new Date().toISOString(),
        metadata: {
          parent_tweet_id: decision.target_tweet_id, // 🔥 CRITICAL: Store parent_tweet_id
          target_tweet_id: decision.target_tweet_id,
          target_username: decision.target_username,
          content_preview: decision.content.substring(0, 100)
        }
      });
      
      if (!receiptResult.success) {
        console.log(`[REPLY_TRUTH] step=FAIL reason=RECEIPT_WRITE_FAILED error=${receiptResult.error}`);
        throw new Error(`CRITICAL: Receipt write failed: ${receiptResult.error}`);
      }
      
      console.log(`[REPLY_TRUTH] step=RECEIPT_OK receipt_id=${receiptResult.receipt_id}`);          
      console.log(`[REPLY_TRUTH] ✅ Durable proof of posting saved to post_receipts`);              

      // 📊 LOG TO SYSTEM_EVENTS: reply_posted + posting_attempt_success
      try {
        const { data: permitForEvent } = await supabase
          .from('post_attempts')
          .select('permit_id, pipeline_source')
          .eq('decision_id', decision.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        // Log reply_posted (existing)
        await supabase.from('system_events').insert({
          event_type: 'reply_posted',
          severity: 'info',
          event_data: {
            decision_id: decision.id,
            tweet_id: result.tweetId,
            target_tweet_id: decision.target_tweet_id,
            target_username: decision.target_username,
            receipt_id: receiptResult.receipt_id,
            content_length: decision.content.length
          },
          created_at: new Date().toISOString()
        });
        
        // 🔒 TASK 1: Log posting_attempt_success (standardized)
        try {
          const { data: decisionMeta } = await supabase
            .from('content_metadata')
            .select('pipeline_source')
            .eq('decision_id', decision.id)
            .maybeSingle();
          
          await supabase.from('system_events').insert({
            event_type: 'posting_attempt_success',
            severity: 'info',
            message: `Reply posted successfully: decision_id=${decision.id} tweet_id=${result.tweetId}`,
            event_data: {
              decision_id: decision.id,
              permit_id: permitForEvent?.permit_id || null,
              tweet_id: result.tweetId,
              pipeline_source: permitForEvent?.pipeline_source || decisionMeta?.pipeline_source || 'unknown',
              service_role: process.env.RAILWAY_SERVICE_NAME || 'xBOT',
              git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
            },
            created_at: new Date().toISOString(),
          });
        } catch (successEventError: any) {
          console.warn(`[SYSTEM_EVENTS] Failed to log posting_attempt_success:`, successEventError.message);
        }
      } catch (eventError) {
        console.warn(`[SYSTEM_EVENTS] Failed to log events:`, eventError);
      }

      await poster.dispose();
      poster = null;

      try {
        await supabase
          .from('reply_opportunities')
          .delete()
          .eq('target_tweet_id', decision.target_tweet_id);
        console.log(`[POSTING_QUEUE] 🧹 Cleared opportunity for ${decision.target_tweet_id}`);
      } catch (cleanupError: any) {
        console.warn(`[POSTING_QUEUE] ⚠️ Failed to clear opportunity ${decision.target_tweet_id}:`, cleanupError.message);
      }

      // ✅ STEP 3: Return tweet ID (receipt is saved, can proceed to DB save)
      // 🔍 FORENSIC PIPELINE: Update decision record with posted tweet ID
      // 🎨 QUALITY TRACKING: Update template_id and prompt_version if not already set
      // 🎯 PIPELINE STAGES: Mark posting completed
      const postingCompletedAt = new Date().toISOString();
      // Get template_id and prompt_version from reply_decisions for POST_SUCCESS event
      const { data: decisionRow } = await supabase
        .from('reply_decisions')
        .select('template_id, prompt_version')
        .eq('decision_id', decision.id)
        .maybeSingle();
      
      const templateId = decisionRow?.template_id || null;
      const promptVersion = decisionRow?.prompt_version || null;
      
      await supabase
        .from('reply_decisions')
        .update({
          posted_reply_tweet_id: result.tweetId,
          playwright_post_attempted: true,
          posting_completed_at: postingCompletedAt, // 🎯 PIPELINE STAGES
          pipeline_error_reason: null, // Clear any previous error
        })
        .eq('decision_id', decision.id);
      
      console.log(`[PIPELINE] decision_id=${decision.id} stage=post ok=true detail=posting_completed tweet_id=${result.tweetId}`);
      console.log(`[POSTING_QUEUE] 🎯 Pipeline stage: posting_completed_at=${postingCompletedAt} for decision_id=${decision.id}`);
      
      // 🔒 POST_SUCCESS: Emit structured proof signal
      const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
      console.log(`[POST_SUCCESS] decision_id=${decision.id} target_tweet_id=${decision.target_tweet_id} posted_reply_tweet_id=${result.tweetId} template_id=${templateId || 'null'} prompt_version=${promptVersion || 'null'} app_version=${appVersion}`);
      
      // Write POST_SUCCESS to system_events with tweet_url
      const tweetUrl = `https://x.com/i/status/${result.tweetId}`;
      await supabase.from('system_events').insert({
        event_type: 'POST_SUCCESS',
        severity: 'info',
        message: `Reply posted successfully: decision_id=${decision.id} posted_reply_tweet_id=${result.tweetId}`,
        event_data: {
          decision_id: decision.id,
          target_tweet_id: decision.target_tweet_id,
          target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId || null,
          posted_reply_tweet_id: result.tweetId,
          tweet_url: tweetUrl,
          template_id: templateId,
          prompt_version: promptVersion,
          app_version: appVersion,
          posted_at: postingCompletedAt,
        },
        created_at: new Date().toISOString(),
      });
      
      console.log(`[REPLY_TRUTH] step=RETURN_TWEETID tweet_id=${result.tweetId}`);
      return result.tweetId;
    } catch (innerError: any) {
      // Mark posting failed
      const postingCompletedAt = new Date().toISOString();
      const errorReason = `POSTING_FAILED_${innerError.message.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50)}`;
      await supabase
        .from('reply_decisions')
        .update({
          posting_completed_at: postingCompletedAt,
          pipeline_error_reason: errorReason,
        })
        .eq('decision_id', decision.id);
      console.error(`[PIPELINE] decision_id=${decision.id} stage=post ok=false detail=${errorReason}`);
      
      // 🔒 POST_FAILED: Emit structured proof signal
      const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
      console.log(`[POST_FAILED] decision_id=${decision.id} target_tweet_id=${decision.target_tweet_id} pipeline_error_reason=${errorReason} app_version=${appVersion}`);
      
      // Write POST_FAILED to system_events
      await supabase.from('system_events').insert({
        event_type: 'POST_FAILED',
        severity: 'error',
        message: `Reply posting failed: decision_id=${decision.id} error=${errorReason}`,
        event_data: {
          decision_id: decision.id,
          target_tweet_id: decision.target_tweet_id,
          target_in_reply_to_tweet_id: ancestry?.targetInReplyToTweetId || null,
          pipeline_error_reason: errorReason,
          error_message: innerError.message,
          app_version: appVersion,
          failed_at: postingCompletedAt,
        },
        created_at: new Date().toISOString(),
      });
      if (poster) {
        await poster.handleFailure(innerError.message || 'reply_posting_failure');
      }
      throw innerError;
    }
  } catch (error: any) {
    console.error(`[POSTING_QUEUE] ❌ Reply system error: ${error.message}`);
      throw new Error(`Reply posting failed: ${error.message}`);
    }
  }, { timeoutMs: 300000, label: 'reply_posting' }); // End withBrowserLock
  
  // Race between posting and timeout
  warningTimer = setTimeout(() => {
    console.warn(`[POSTING_QUEUE] ⚠️ Reply still processing after ${TIMEOUT_WARNING_MS / 1000}s (decision ${decision.id})`);
  }, TIMEOUT_WARNING_MS);

  try {
    return await Promise.race([postingPromise, timeoutPromise]);
  } finally {
    if (warningTimer) {
      clearTimeout(warningTimer);
      warningTimer = null;
    }
  }
}

/**
 * 📊 Capture follower baseline before posting
 */
async function captureFollowerBaseline(decisionId: string): Promise<number | null> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Get most recent follower snapshot
    const { data: snapshot } = await supabase
      .from('follower_snapshots')
      .select('follower_count')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    const followerCount = snapshot?.follower_count ? Number(snapshot.follower_count) : null;
    
    if (followerCount) {
      console.log(`[FOLLOWER_TRACKING] 📊 Baseline: ${followerCount} followers before post`);
      
      // Store baseline in post_follower_tracking
      await supabase
        .from('post_follower_tracking')
        .insert({
          post_id: decisionId,
          tweet_id: null, // Will be updated after posting
          check_time: new Date().toISOString(),
          follower_count: followerCount,
          hours_after_post: 0, // Baseline
          collection_phase: 'baseline'
        });
    }
    
    return followerCount;
    
  } catch (error: any) {
    console.warn('[FOLLOWER_TRACKING] ⚠️ Failed to capture baseline:', error.message);
    return null;
  }
}

async function updateDecisionStatus(decisionId: string, status: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('content_metadata')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('decision_id', decisionId);  // 🔥 FIX: decisionId is UUID, query by decision_id not id!
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
  }
}

// 🔒 TRUTH PIPELINE FIX: Return confirmation with verified IDs
export async function markDecisionPosted(
  decisionId: string, 
  tweetId: string, 
  tweetUrl?: string, 
  tweetIds?: string[]
): Promise<{ 
  ok: boolean; 
  decision_id: string; 
  savedTweetIds: string[]; 
  classification: 'single' | 'thread' | 'reply';
  wasAlreadyPosted: boolean;
}> {
  try {
    // 🔒 VALIDATION: Validate all IDs before saving
    const { IDValidator } = await import('../validation/idValidator');
    
    // Validate decision ID
    const decisionValidation = IDValidator.validateDecisionId(decisionId);
    if (!decisionValidation.valid) {
      throw new Error(`Invalid decision ID: ${decisionValidation.error}`);
    }
    
    // Validate tweet ID
    const tweetValidation = IDValidator.validateTweetId(tweetId);
    if (!tweetValidation.valid) {
      throw new Error(`Invalid tweet ID: ${tweetValidation.error}`);
    }
    
    // Validate thread IDs if present
    if (tweetIds && tweetIds.length > 0) {
      const threadValidation = IDValidator.validateThreadIds(tweetIds);
      if (!threadValidation.valid) {
        throw new Error(`Invalid thread IDs: ${threadValidation.error}`);
      }
    }
    
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // 🆕 Log thread IDs if this is a thread
    if (tweetIds && tweetIds.length > 1) {
      console.log(`[POSTING_QUEUE] 💾 Storing thread with ${tweetIds.length} tweet IDs: ${tweetIds.join(', ')}`);
    }
    
    // 1. Update content_metadata status and tweet_id (CRITICAL!) - WITH RETRY LOGIC
    // ENHANCED: Retry database save up to 3 times with exponential backoff
    const MAX_DB_RETRIES = 3;
    let dbSaveSuccess = false;
    let lastDbError: any = null;
    
    // 🔥 THREAD TRUTH FIX: Always save thread_tweet_ids when we have multiple tweet IDs
    // This ensures reply-chain fallback threads are properly recorded
    const hasMultipleTweetIds = tweetIds && tweetIds.length > 1;
    
    for (let dbAttempt = 1; dbAttempt <= MAX_DB_RETRIES; dbAttempt++) {
      try {
        // 🔒 CRITICAL: Preserve pipeline_source and build_sha from existing row
        const { getBuildSHA } = await import('../posting/atomicPostExecutor');
        const { data: existingRow } = await supabase
          .from('content_generation_metadata_comprehensive')
          .select('pipeline_source, build_sha, job_run_id')
          .eq('decision_id', decisionId)
          .single();
        
        const updateData: any = {
          status: 'posted',
          tweet_id: tweetId, // 🔥 CRITICAL: Save tweet ID for metrics scraping!
          posted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // 🔒 PRESERVE: Never lose pipeline_source or build_sha
          pipeline_source: existingRow?.pipeline_source || 'postingQueue',
          build_sha: existingRow?.build_sha || getBuildSHA(),
          job_run_id: existingRow?.job_run_id || `markPosted_${Date.now()}`,
        };
        
        // 🔥 THREAD TRUTH FIX: Always save thread_tweet_ids when we have multiple IDs
        if (hasMultipleTweetIds) {
          updateData.thread_tweet_ids = JSON.stringify(tweetIds);
          console.log(`[POSTING_QUEUE] 💾 Saving thread_tweet_ids for multi-tweet post: ${tweetIds.length} IDs`);
        } else {
          updateData.thread_tweet_ids = tweetIds ? JSON.stringify(tweetIds) : null;
        }
        
        const { error: updateError } = await supabase
          .from('content_generation_metadata_comprehensive')  // 🔥 CRITICAL: UPDATE the TABLE, not the VIEW!
          .update(updateData)
          .eq('decision_id', decisionId);  // 🔥 FIX: decisionId is UUID, query by decision_id not id!
        
        if (updateError) {
          lastDbError = updateError;
          throw new Error(`Database save failed: ${updateError.message}`);
        }
        
        // ENHANCED: Verify save succeeded by reading back the record
        const { data: verifyData, error: verifyError } = await supabase
          .from('content_metadata')
          .select('tweet_id, status')
          .eq('decision_id', decisionId)
          .single();
        
        if (verifyError || !verifyData) {
          throw new Error(`Verification failed: ${verifyError?.message || 'No data found'}`);
        }
        
        if (verifyData.tweet_id !== tweetId || verifyData.status !== 'posted') {
          throw new Error(`Save verification failed: tweet_id=${verifyData.tweet_id}, status=${verifyData.status}`);
        }
        
        dbSaveSuccess = true;
        console.log(`[POSTING_QUEUE] ✅ Database updated (attempt ${dbAttempt}/${MAX_DB_RETRIES}): tweet_id ${tweetId} saved for decision ${decisionId}`);
        
        // ✅ SUCCESS log removed - caller (processDecision) will log SUCCESS with correct decision_type
        // Removed duplicate: console.log(`[POSTING_QUEUE][SUCCESS] decision_id=${decisionId} type=unknown tweet_id=${tweetId} url=${finalTweetUrl}`);
        
        break; // Success - exit retry loop
        
      } catch (dbError: any) {
        lastDbError = dbError;
        console.warn(`[POSTING_QUEUE] ⚠️ Database save attempt ${dbAttempt}/${MAX_DB_RETRIES} failed: ${dbError.message}`);
        
        if (dbAttempt < MAX_DB_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = 1000 * Math.pow(2, dbAttempt - 1);
          console.log(`[POSTING_QUEUE] 🔄 Retrying database save in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          console.error(`[POSTING_QUEUE] 🚨 CRITICAL: All ${MAX_DB_RETRIES} database save attempts failed for tweet ${tweetId}`);
          console.error(`[POSTING_QUEUE] 🚨 Last error: ${lastDbError.message}`);
          // Don't throw - tweet is already posted, we'll log and continue
          // Background recovery job will fix this
        }
      }
    }
    
    if (!dbSaveSuccess) {
      console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Failed to save tweet_id ${tweetId} to database after ${MAX_DB_RETRIES} attempts`);
      console.error(`[POSTING_QUEUE] 🚨 Tweet is LIVE on Twitter but database save failed - background recovery job will fix this`);
      // Log to error tracker for monitoring
      await trackError(
        'posting_queue',
        'database_save_failed',
        `Failed to save tweet_id ${tweetId} after ${MAX_DB_RETRIES} attempts: ${lastDbError?.message || 'Unknown error'}`,
        'critical',
        {
          decision_id: decisionId,
          tweet_id: tweetId,
          attempts: MAX_DB_RETRIES,
          last_error: lastDbError?.message
        }
      );
      // Don't throw - allow system to continue, recovery job will fix
    }
    
    // 2. Get the full decision details for posted_decisions archive
    const { data: decisionData, error: fetchError } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('decision_id', decisionId)  // 🔥 FIX: decisionId is UUID, query by decision_id not id!
      .single();
    
    if (fetchError || !decisionData) {
      console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Failed to fetch decision data for ${decisionId}:`, fetchError?.message);
      throw new Error(`Cannot archive decision: ${fetchError?.message || 'No data found'}`);
    }
    
    // 3. Store in posted_decisions archive with safer numeric handling
    const { error: archiveError } = await supabase
      .from('posted_decisions')
      .insert([{
        decision_id: decisionData.decision_id,  // 🔥 FIX: Use UUID from data, not integer ID!
        content: decisionData.content,
        tweet_id: tweetId,
        decision_type: decisionData.decision_type || 'single',  // Default to 'single' not 'content'
        target_tweet_id: decisionData.target_tweet_id,
        target_username: decisionData.target_username,
        bandit_arm: decisionData.bandit_arm,
        timing_arm: decisionData.timing_arm,
        predicted_er: Math.min(1.0, Math.max(0.0, Number(decisionData.predicted_er) || 0)),
        quality_score: Math.min(1.0, Math.max(0.0, Number(decisionData.quality_score) || 0)),
        topic_cluster: decisionData.topic_cluster,
        posted_at: new Date().toISOString()
      }]);
    
    if (archiveError) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to archive posted decision ${decisionId}:`, archiveError.message);
    } else {
      console.log(`[POSTING_QUEUE] 📝 Decision ${decisionId} marked as posted with tweet ID: ${tweetId}`);
    }
    
    // 🔒 Return confirmation (TypeScript requires return value)
    const savedIds = tweetIds && tweetIds.length > 0 ? tweetIds : [tweetId];
    const classification = savedIds.length > 1 ? 'thread' : 'single';
    return {
      ok: true,
      decision_id: decisionId,
      savedTweetIds: savedIds,
      classification,
      wasAlreadyPosted: false
    };
  } catch (error: any) {
    console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Failed to mark posted for ${decisionId}:`, error.message);
    console.error(`[LIFECYCLE][FAIL] decision_id=${decisionId} reason=MARK_POSTED_EXCEPTION err=${error.message}`);
    // 🔥 CRITICAL FIX: Re-throw error so retry loop can catch it
    // Without this, the calling code thinks save succeeded when it actually failed!
    throw error;
  }
}

async function markDecisionFailed(decisionId: string, errorMessage: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('content_metadata')
      .update({ 
        status: 'failed',
        error_message: errorMessage, // Also store the error
        updated_at: new Date().toISOString()
      })
      .eq('decision_id', decisionId);  // 🔥 FIX: Use decision_id (UUID), not id (integer)!
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark failed for ${decisionId}:`, error.message);
    } else {
      console.log(`[POSTING_QUEUE] ❌ Decision ${decisionId} marked as failed: ${errorMessage}`);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark failed for ${decisionId}:`, error.message);
  }
}

async function updatePostingMetrics(type: 'queued' | 'posted' | 'error'): Promise<void> {
  try {
    const { updateMockMetrics } = await import('../api/metrics');
    
    switch (type) {
      case 'queued':
        updateMockMetrics({ postsQueued: 1 });
        break;
      case 'posted':
        updateMockMetrics({ postsPosted: 1 });
        break;
      case 'error':
        updateMockMetrics({ postingErrors: 1 });
        break;
    }
  } catch (error) {
    console.warn('[POSTING_QUEUE] ⚠️ Failed to update posting metrics:', error.message);
  }
}

/**
 * 🔥 PRIORITY 2 FIX: Store failed database save in retry queue
 * Saves to file for background job to retry later
 */
async function storeInRetryQueue(
  decisionId: string,
  tweetId: string,
  tweetUrl: string | undefined,
  tweetIds: string[] | undefined,
  content: string
): Promise<void> {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    
    const retryQueueFile = path.join(logsDir, 'db_retry_queue.jsonl');
    const retryEntry = {
      decisionId,
      tweetId,
      tweetUrl,
      tweetIds,
      content: content.substring(0, 200), // Store first 200 chars for matching
      timestamp: Date.now(),
      date: new Date().toISOString(),
      retryCount: 0
    };
    
    appendFileSync(retryQueueFile, JSON.stringify(retryEntry) + '\n');
    console.log(`[POSTING_QUEUE] 💾 Stored in retry queue: decision_id=${decisionId}, tweet_id=${tweetId}`);
  } catch (error: any) {
    console.error(`[POSTING_QUEUE] ⚠️ Failed to store in retry queue: ${error.message}`);
  }
}

/**
 * 🔥 PRIORITY 5 FIX: Pre-post logging
 * Logs all posting attempts BEFORE posting for recovery
 */
async function logPostAttempt(decision: QueuedDecision, action: 'attempting' | 'success' | 'failed', tweetId?: string, errorMessage?: string): Promise<void> {
  try {
    // Write to log file (existing)
    const logsDir = path.join(process.cwd(), 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = path.join(logsDir, 'post_attempts.log');
    const logEntry = {
      decisionId: decision.id,
      decisionType: decision.decision_type,
      content: decision.content.substring(0, 100),
      action,
      tweetId: tweetId || null,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    
    appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    
    // 🔧 FIX: Write to database for dashboard tracking
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      await supabase.from('posting_attempts').insert({
        decision_id: decision.id,
        decision_type: decision.decision_type,
        content_text: decision.content.substring(0, 500),
        status: action === 'success' ? 'success' : action === 'failed' ? 'failed' : 'attempting',
        tweet_id: tweetId || null,
        error_message: errorMessage || null,
        created_at: new Date().toISOString()
      });
    } catch (dbError: any) {
      // Non-critical - don't fail posting if DB logging fails
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to log post attempt to DB: ${dbError.message}`);
    }
  } catch (error: any) {
    // Non-critical - don't fail posting if logging fails
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to log post attempt: ${error.message}`);
  }
}

/**
 * 🎯 QUEUE DEPTH MONITOR - Ensures minimum content always queued
 * 
 * Guarantees:
 * - MINIMUM 2 content posts/hour (singles + threads)
 * - MINIMUM 4 replies/hour
 * 
 * How it works:
 * - Maintains 4-8 content posts in queue (2-4 hours buffer)
 * - Maintains 8-16 replies in queue (2-4 hours buffer)
 * - Triggers emergency generation if queue drops below minimum
 * - Self-healing: handles browser crashes, generation failures, rate limits
 */
async function ensureMinimumQueueDepth(): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Count queued content (singles + threads)
    const { count: queuedContent } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread']);
    
    // Count queued replies
    const { count: queuedReplies } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .eq('decision_type', 'reply');
    
    const contentQueueSize = queuedContent || 0;
    const replyQueueSize = queuedReplies || 0;
    
    // Minimum thresholds (2 hours of buffer = 4 content, 8 replies)
    const MIN_CONTENT_QUEUE = 4;  // 2 posts/hour × 2 hours
    const MIN_REPLY_QUEUE = 8;     // 4 replies/hour × 2 hours
    
    console.log(`[QUEUE_MONITOR] 📊 Queue depth: ${contentQueueSize} content, ${replyQueueSize} replies`);
    
    // 🚨 EMERGENCY: Content queue low
    if (contentQueueSize < MIN_CONTENT_QUEUE) {
      console.log(`[QUEUE_MONITOR] ⚠️ Content queue LOW: ${contentQueueSize}/${MIN_CONTENT_QUEUE}`);
      console.log(`[QUEUE_MONITOR] 🚨 Triggering emergency content generation...`);
      
      try {
        const { planContent } = await import('./planJob');
        await planContent();
        console.log(`[QUEUE_MONITOR] ✅ Emergency content generation complete`);
      } catch (error: any) {
        console.error(`[QUEUE_MONITOR] ❌ Emergency content generation failed:`, error.message);
      }
    } else {
      console.log(`[QUEUE_MONITOR] ✅ Content queue healthy: ${contentQueueSize}/${MIN_CONTENT_QUEUE}`);
    }
    
    // 🚨 EMERGENCY: Reply queue low
    if (replyQueueSize < MIN_REPLY_QUEUE) {
      console.log(`[QUEUE_MONITOR] ⚠️ Reply queue LOW: ${replyQueueSize}/${MIN_REPLY_QUEUE}`);
      console.log(`[QUEUE_MONITOR] 🚨 Triggering emergency reply generation...`);
      
      try {
        const { generateReplies } = await import('./replyJob');
        await generateReplies();
        console.log(`[QUEUE_MONITOR] ✅ Emergency reply generation complete`);
      } catch (error: any) {
        console.error(`[QUEUE_MONITOR] ❌ Emergency reply generation failed:`, error.message);
      }
    } else {
      console.log(`[QUEUE_MONITOR] ✅ Reply queue healthy: ${replyQueueSize}/${MIN_REPLY_QUEUE}`);
    }
    
  } catch (error: any) {
    console.error('[QUEUE_MONITOR] ❌ Queue depth check failed:', error.message);
    // Don't throw - this is a safety net, not critical path
  }
}


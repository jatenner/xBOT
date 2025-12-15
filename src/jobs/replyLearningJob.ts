/**
 * 🧠 REPLY LEARNING JOB - Phase 3
 * 
 * Updates discovered_accounts.priority_score based on reply performance
 * 
 * Runs: Every 60-120 minutes (configurable)
 * Purpose: Learn which accounts are worth replying to based on v2 metrics
 * 
 * Strategy:
 * - Read reply performance from vw_learning (decision_type='reply')
 * - Aggregate performance per target_username
 * - Use v2 metrics: followers_gained_weighted, primary_objective_score
 * - Apply time decay (recent replies matter more)
 * - Update discovered_accounts.priority_score
 */

import { getSupabaseClient } from '../db';
import { calculateAgeDays, calculateDecayedScore, getDecayConfig, TimeDecayConfig } from '../utils/timeDecayLearning';

const LEARNING_WINDOW_DAYS = 30; // Learn from last 30 days of replies
const MIN_SAMPLES_FOR_SCORE = 3; // Need at least 3 replies to trust the score
const PRIORITY_SCORE_MIN = 0.0;
const PRIORITY_SCORE_MAX = 1.0;

interface AccountReplyStats {
  username: string;
  reply_count: number;
  avg_followers_gained_weighted: number;
  avg_primary_objective_score: number;
  total_impressions: number;
  total_engagement_rate: number;
  latest_reply_at: Date | null;
  weighted_score: number; // Time-decayed aggregate score
}

export async function replyLearningJob(): Promise<void> {
  console.log('[REPLY_LEARNING] 🧠 Starting reply learning cycle...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Step 1: Query vw_learning for reply performance
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LEARNING_WINDOW_DAYS);
    
    console.log(`[REPLY_LEARNING] 📊 Querying reply performance from last ${LEARNING_WINDOW_DAYS} days...`);
    
    const { data: replyData, error: queryError } = await supabase
      .from('vw_learning')
      .select('*')
      .eq('decision_type', 'reply')
      .not('target_username', 'is', null)
      .gte('posted_at', cutoffDate.toISOString())
      .not('posted_at', 'is', null);
    
    if (queryError) {
      console.error('[REPLY_LEARNING] ❌ Failed to query vw_learning:', queryError.message);
      throw queryError;
    }
    
    if (!replyData || replyData.length === 0) {
      console.log('[REPLY_LEARNING] ⚠️ No reply data found in learning window');
      return;
    }
    
    console.log(`[REPLY_LEARNING] 📈 Found ${replyData.length} reply records`);
    
    // Step 2: Aggregate performance by target_username
    const accountStatsMap = new Map<string, AccountReplyStats>();
    
    for (const reply of replyData) {
      const username = String(reply.target_username || '').trim().toLowerCase();
      if (!username) continue;
      
      const postedAt = reply.posted_at ? new Date(reply.posted_at) : new Date();
      const ageDays = calculateAgeDays(postedAt);
      // Use reply-specific decay config (faster decay for replies - 15% per day)
      const decayConfig: TimeDecayConfig = {
        lambda: 0.15, // 15% decay per day (replies need faster adaptation)
        minDecayFactor: 0.1,
        maxAgeDays: LEARNING_WINDOW_DAYS
      };
      
      // Get v2 metrics (use 0 if not available)
      const followersGainedWeighted = Number(reply.followers_gained_weighted || 0);
      const primaryObjectiveScore = Number(reply.primary_objective_score || 0);
      
      // Calculate decayed scores
      const decayedFollowers = calculateDecayedScore(followersGainedWeighted, ageDays, decayConfig);
      const decayedObjective = calculateDecayedScore(primaryObjectiveScore, ageDays, decayConfig);
      
      // Combined score (weighted: 60% followers, 40% objective score)
      const combinedScore = (decayedFollowers.effectiveScore * 0.6) + (decayedObjective.effectiveScore * 0.4);
      
      const existing = accountStatsMap.get(username);
      
      if (existing) {
        // Update aggregate stats
        existing.reply_count += 1;
        existing.avg_followers_gained_weighted = 
          (existing.avg_followers_gained_weighted * (existing.reply_count - 1) + followersGainedWeighted) / existing.reply_count;
        existing.avg_primary_objective_score = 
          (existing.avg_primary_objective_score * (existing.reply_count - 1) + primaryObjectiveScore) / existing.reply_count;
        existing.total_impressions += Number(reply.impressions || 0);
        existing.total_engagement_rate += Number(reply.engagement_rate || 0);
        
        // Update weighted score (time-decayed aggregate)
        const oldWeight = existing.weighted_score * (existing.reply_count - 1);
        const newWeight = combinedScore * decayedFollowers.decayFactor;
        existing.weighted_score = (oldWeight + newWeight) / existing.reply_count;
        
        // Update latest reply timestamp
        if (!existing.latest_reply_at || postedAt > existing.latest_reply_at) {
          existing.latest_reply_at = postedAt;
        }
      } else {
        // New account
        accountStatsMap.set(username, {
          username,
          reply_count: 1,
          avg_followers_gained_weighted: followersGainedWeighted,
          avg_primary_objective_score: primaryObjectiveScore,
          total_impressions: Number(reply.impressions || 0),
          total_engagement_rate: Number(reply.engagement_rate || 0),
          latest_reply_at: postedAt,
          weighted_score: combinedScore * decayedFollowers.decayFactor
        });
      }
    }
    
    console.log(`[REPLY_LEARNING] 📊 Aggregated stats for ${accountStatsMap.size} accounts`);
    
    // Log first 20 usernames we intend to update
    const usernamesToUpdate = Array.from(accountStatsMap.keys())
      .filter(u => accountStatsMap.get(u)!.reply_count >= MIN_SAMPLES_FOR_SCORE)
      .slice(0, 20);
    console.log(`[REPLY_LEARNING] 📝 First 20 usernames to update:`, usernamesToUpdate);
    
    // Step 3: Calculate priority scores and update discovered_accounts
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    for (const [username, stats] of accountStatsMap.entries()) {
      // Skip accounts with too few samples
      if (stats.reply_count < MIN_SAMPLES_FOR_SCORE) {
        skippedCount++;
        continue;
      }
      
      // Normalize weighted_score to 0-1 range
      // Use percentile-based normalization (top 10% get 0.9-1.0, bottom 50% get 0.0-0.3)
      const allScores = Array.from(accountStatsMap.values())
        .filter(s => s.reply_count >= MIN_SAMPLES_FOR_SCORE)
        .map(s => s.weighted_score);
      
      if (allScores.length === 0) continue;
      
      allScores.sort((a, b) => b - a); // Descending
      const maxScore = allScores[0];
      const minScore = allScores[allScores.length - 1];
      const scoreRange = maxScore - minScore;
      
      let normalizedScore = 0.0;
      if (scoreRange > 0) {
        // Percentile-based: top 10% = 0.9-1.0, next 20% = 0.7-0.9, next 30% = 0.4-0.7, bottom 40% = 0.0-0.4
        const percentile = allScores.findIndex(s => s <= stats.weighted_score) / allScores.length;
        
        if (percentile <= 0.1) {
          // Top 10%
          normalizedScore = 0.9 + (0.1 * (stats.weighted_score - allScores[Math.floor(allScores.length * 0.1)]) / 
            (maxScore - allScores[Math.floor(allScores.length * 0.1)] || 1));
        } else if (percentile <= 0.3) {
          // Next 20%
          normalizedScore = 0.7 + (0.2 * (stats.weighted_score - allScores[Math.floor(allScores.length * 0.3)]) / 
            (allScores[Math.floor(allScores.length * 0.1)] - allScores[Math.floor(allScores.length * 0.3)] || 1));
        } else if (percentile <= 0.6) {
          // Next 30%
          normalizedScore = 0.4 + (0.3 * (stats.weighted_score - allScores[Math.floor(allScores.length * 0.6)]) / 
            (allScores[Math.floor(allScores.length * 0.3)] - allScores[Math.floor(allScores.length * 0.6)] || 1));
        } else {
          // Bottom 40%
          normalizedScore = 0.0 + (0.4 * (stats.weighted_score - minScore) / 
            (allScores[Math.floor(allScores.length * 0.6)] - minScore || 1));
        }
        
        normalizedScore = Math.max(PRIORITY_SCORE_MIN, Math.min(PRIORITY_SCORE_MAX, normalizedScore));
      } else {
        // All scores are the same, use average
        normalizedScore = 0.5;
      }
      
      // Update or create discovered_accounts entry
      // Normalize username (remove @ prefix, lowercase for matching)
      const normalizedUsername = username.replace(/^@/, '').toLowerCase();
      
      // Try to find existing account (case-insensitive)
      const { data: existingAccount } = await supabase
        .from('discovered_accounts')
        .select('id, username')
        .ilike('username', normalizedUsername)
        .limit(1)
        .maybeSingle();
      
      const updatePayload = {
        priority_score: normalizedScore,
        reply_performance_score: stats.weighted_score,
        last_successful_reply_at: stats.latest_reply_at?.toISOString() || null,
        last_updated: new Date().toISOString()
      };
      
      let updateSuccess = false;
      let rowsAffected = 0;
      
      if (existingAccount) {
        // Update existing account using its actual username (preserve case)
        const { data: updateData, error: updateError } = await supabase
          .from('discovered_accounts')
          .update(updatePayload)
          .eq('id', existingAccount.id)
          .select('id');
        
        if (updateError) {
          console.warn(`[REPLY_LEARNING] ⚠️ Failed to update ${existingAccount.username} (id=${existingAccount.id}):`, updateError.message);
          failedCount++;
        } else if (updateData && updateData.length > 0) {
          updateSuccess = true;
          rowsAffected = updateData.length;
          updatedCount++;
          console.log(`[REPLY_LEARNING] ✅ Updated ${existingAccount.username}: priority_score=${normalizedScore.toFixed(3)}, replies=${stats.reply_count}, weighted=${stats.weighted_score.toFixed(3)}, rows_affected=${rowsAffected}`);
        }
      } else {
        // Create new account entry
        const { data: insertData, error: insertError } = await supabase
          .from('discovered_accounts')
          .insert({
            username: normalizedUsername, // Store lowercase
            priority_score: normalizedScore,
            reply_performance_score: stats.weighted_score,
            last_successful_reply_at: stats.latest_reply_at?.toISOString() || null,
            last_updated: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
          .select('id');
        
        if (insertError) {
          console.warn(`[REPLY_LEARNING] ⚠️ Failed to create ${normalizedUsername}:`, insertError.message);
          failedCount++;
        } else if (insertData && insertData.length > 0) {
          updateSuccess = true;
          rowsAffected = insertData.length;
          updatedCount++;
          console.log(`[REPLY_LEARNING] ✅ Created ${normalizedUsername}: priority_score=${normalizedScore.toFixed(3)}, replies=${stats.reply_count}, weighted=${stats.weighted_score.toFixed(3)}, rows_affected=${rowsAffected}`);
        }
      }
    }
    
    // Step 4: Decay priority scores for accounts with no recent replies
    // Accounts without replies in the learning window get their score reduced
    const decayCutoff = new Date();
    decayCutoff.setDate(decayCutoff.getDate() - LEARNING_WINDOW_DAYS);
    
    // Manual decay update (Supabase client doesn't support raw SQL in update)
    const { data: staleAccounts } = await supabase
      .from('discovered_accounts')
      .select('id, priority_score')
      .or(`last_successful_reply_at.is.null,last_successful_reply_at.lt.${decayCutoff.toISOString()}`)
      .gt('priority_score', 0);
    
    if (staleAccounts && staleAccounts.length > 0) {
      let decayedCount = 0;
      for (const acc of staleAccounts) {
        const newScore = Math.max(0, Number(acc.priority_score) * 0.95);
        const { error: updateError } = await supabase
          .from('discovered_accounts')
          .update({ priority_score: newScore, last_updated: new Date().toISOString() })
          .eq('id', acc.id);
        
        if (!updateError) {
          decayedCount++;
        }
      }
      console.log(`[REPLY_LEARNING] 🔄 Decayed ${decayedCount} stale priority scores`);
    }
    
    console.log(`[REPLY_LEARNING] ✅ Learning cycle complete:`);
    console.log(`  📊 Accounts updated: ${updatedCount}`);
    console.log(`  ⏭️ Accounts skipped (insufficient samples): ${skippedCount}`);
    console.log(`  ❌ Accounts failed to update: ${failedCount}`);
    console.log(`  📈 Total accounts analyzed: ${accountStatsMap.size}`);
    
    // Log summary stats
    const { data: topAccounts } = await supabase
      .from('discovered_accounts')
      .select('username, priority_score, reply_performance_score')
      .gt('priority_score', 0)
      .order('priority_score', { ascending: false })
      .limit(10);
    
    if (topAccounts && topAccounts.length > 0) {
      console.log(`[REPLY_LEARNING] 🏆 Top 10 priority accounts:`);
      topAccounts.forEach((acc, idx) => {
        console.log(`  ${idx + 1}. @${acc.username}: ${Number(acc.priority_score).toFixed(3)} (perf: ${Number(acc.reply_performance_score || 0).toFixed(3)})`);
      });
    }
    
  } catch (error: any) {
    console.error('[REPLY_LEARNING] ❌ Learning job failed:', error.message);
    throw error;
  }
}


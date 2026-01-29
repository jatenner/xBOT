/**
 * 🔍 REPLY METRICS SCRAPER JOB
 * 
 * METADATA GOATNESS: Tracks performance of every reply
 * - Views/impressions per reply
 * - Likes/retweets on replies
 * - Followers gained from each reply
 * - Parent tweet context
 * - Timing data
 * 
 * Runs every 30 minutes to collect fresh data for learning system
 */

import { getSupabaseClient } from '../db';
import { BulletproofTwitterScraper } from '../scrapers/bulletproofTwitterScraper';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { validateTweetIdForScraping } from './metricsScraperValidation';
import { IDValidator } from '../validation/idValidator';

const MAX_SCRAPE_RETRIES = 5;

export async function replyMetricsScraperJob(): Promise<void> {
  console.log('[REPLY_METRICS] 🔍 Starting reply performance scraping...');
  if (!process.env.USE_ANALYTICS_PAGE) {
    process.env.USE_ANALYTICS_PAGE = 'false';
  }
  
  try {
    const supabase = getSupabaseClient();
    
    // PRIORITY 1: Replies missing metrics (last 7 days) - scrape aggressively
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const postedAfterIso = sevenDaysAgo.toISOString();
    const { data: missingMetricsReplies, error: missingError } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, posted_at, content, features, actual_impressions, target_username, target_tweet_id')
      .eq('status', 'posted')
      .eq('decision_type', 'reply')
      .not('tweet_id', 'is', null)
      .gte('posted_at', postedAfterIso)
      .or('actual_impressions.is.null,actual_impressions.eq.0')  // 🔥 FIX: Focus on missing metrics
      .order('posted_at', { ascending: false })
      .limit(50); // 🔥 INCREASED: Process more replies per run
    
    // 🔒 VALIDATION: Filter out replies with invalid tweet IDs
    const validReplies = (missingMetricsReplies || []).filter((reply: any) => {
      const validation = validateTweetIdForScraping(reply.tweet_id);
      if (!validation.valid) {
        console.warn(`[REPLY_METRICS] ⚠️ Skipping reply with invalid tweet_id: ${reply.decision_id} (${validation.error})`);
        return false;
      }
      return true;
    });
    
    // PRIORITY 2: Recent replies (last 24h) that might need refresh
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { data: recentReplies, error: recentError } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, posted_at, content, features, actual_impressions, target_username, target_tweet_id')
      .eq('status', 'posted')
      .eq('decision_type', 'reply')
      .not('tweet_id', 'is', null)
      .gte('posted_at', oneDayAgo.toISOString())
      .order('posted_at', { ascending: false })
      .limit(20); // Refresh recent replies even if they have metrics
    
    // 🔒 VALIDATION: Filter out replies with invalid tweet IDs
    const validRecentReplies = (recentReplies || []).filter((reply: any) => {
      const validation = validateTweetIdForScraping(reply.tweet_id);
      if (!validation.valid) {
        console.warn(`[REPLY_METRICS] ⚠️ Skipping recent reply with invalid tweet_id: ${reply.decision_id} (${validation.error})`);
        return false;
      }
      return true;
    });
    
    // Combine and deduplicate
    const allReplies = [...validReplies, ...validRecentReplies];
    const seen = new Set<string>();
    const recentRepliesDeduped = allReplies.filter(reply => {
      if (seen.has(reply.decision_id)) return false;
      seen.add(reply.decision_id);
      return true;
    });
    
    const repliesError = missingError || recentError;
    
    if (repliesError) {
      console.error('[REPLY_METRICS] ❌ Failed to fetch recent replies:', repliesError.message);
      return;
    }
    
    const repliesToScrape = recentRepliesDeduped.filter((reply) => {
      const features = (reply.features || {}) as Record<string, any>;
      const retryCount = Number(features.metrics_retry_count || 0);
      if (retryCount >= MAX_SCRAPE_RETRIES) {
        console.warn(`[REPLY_METRICS] ⏭️ Skipping ${reply.tweet_id} after ${retryCount} failed scraping attempts`);
        return false;
      }
      return true;
    });

    if (repliesToScrape.length === 0) {
      console.log('[REPLY_METRICS] ℹ️ No recent replies to scrape');
      return;
    }
    
    const missingCount = missingMetricsReplies?.length || 0;
    const refreshCount = recentReplies?.length || 0;
    console.log(`[REPLY_METRICS] 📊 Found ${repliesToScrape.length} replies to scrape (${missingCount} missing metrics, ${refreshCount} recent refresh)`);
    
    // Get current follower count (to calculate followers gained)
    let currentFollowerCount = 0;
    try {
      const { data: accountData } = await supabase
        .from('system_health_metrics')
        .select('follower_count')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      currentFollowerCount = Number(accountData?.follower_count) || 0;
    } catch (error) {
      console.warn('[REPLY_METRICS] ⚠️ Could not get current follower count');
    }
    
    // Scrape metrics for each reply
    let scrapedCount = 0;
    let failedCount = 0;
    
    // Get browser page for scraping
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('reply_metrics_scrape');
    
    try {
      for (const reply of repliesToScrape) {
        let baseFeatures: Record<string, any> = {};
        let retryCount = 0;
        let nowIso = new Date().toISOString();
        let parentUsername: string | undefined;
        let canonicalTweetUrl: string | undefined;
        let reservationFeatures: Record<string, any> = {};

        try {
          baseFeatures = (reply.features || {}) as Record<string, any>;
          retryCount = Number(baseFeatures.metrics_retry_count || 0);
          nowIso = new Date().toISOString();
          parentUsername = typeof baseFeatures.parent_username === 'string' && baseFeatures.parent_username.length > 0
            ? baseFeatures.parent_username
            : typeof reply.target_username === 'string' && reply.target_username.length > 0
              ? reply.target_username
              : undefined;
          canonicalTweetUrl =
            typeof baseFeatures.tweet_url === 'string' && baseFeatures.tweet_url.length > 0
              ? baseFeatures.tweet_url
              : parentUsername
                ? `https://x.com/${parentUsername}/status/${reply.tweet_id}`
                : undefined;

          // Mark job in progress to avoid double-scraping in parallel runs
          reservationFeatures = {
            ...baseFeatures,
            metrics_in_progress: true,
            metrics_last_attempt_at: nowIso
          };
          if (!reservationFeatures.tweet_url && canonicalTweetUrl) {
            reservationFeatures.tweet_url = canonicalTweetUrl;
          }
          try {
            await supabase
              .from('content_metadata')
              .update({
                features: reservationFeatures,
                updated_at: nowIso
              })
              .eq('decision_id', reply.decision_id);
          } catch (reservationError: any) {
            console.warn(`[REPLY_METRICS]   ⚠️ Failed to flag in-progress for ${reply.tweet_id}: ${reservationError.message}`);
          }

          console.log(`[REPLY_METRICS]   🔍 Scraping reply ${reply.tweet_id}...`);
          
          // Scrape tweet metrics
          const scraper = BulletproofTwitterScraper.getInstance();
          const result = await scraper.scrapeTweetMetrics(
            page,
            String(reply.tweet_id),
            2,
            {
              isReply: true,
              useAnalytics: false,
              tweetUrl: canonicalTweetUrl
            }
          );
          
          if (!result.success || !result.metrics) {
            console.warn(`[REPLY_METRICS]   ⚠️ No metrics for ${reply.tweet_id}: ${result.error || 'Unknown error'}`);
            failedCount++;

            const updatedFeatures = {
              ...reservationFeatures,
              metrics_retry_count: retryCount + 1,
              metrics_in_progress: false,
              metrics_last_error: result.error || 'Unknown',
              metrics_last_attempt_at: nowIso
            };
            try {
              await supabase
                .from('content_metadata')
                .update({
                  features: updatedFeatures,
                  updated_at: new Date().toISOString()
                })
                .eq('decision_id', reply.decision_id);
            } catch (updateError: any) {
              console.warn(`[REPLY_METRICS]   ⚠️ Failed to persist retry count for ${reply.tweet_id}: ${updateError.message}`);
            }

            if (updatedFeatures.metrics_retry_count >= MAX_SCRAPE_RETRIES) {
              try {
                await supabase.from('system_events').insert({
                  event_type: 'reply_metrics_giveup',
                  severity: 'warning',
                  event_data: {
                    reply_tweet_id: reply.tweet_id,
                    decision_id: reply.decision_id,
                    retries: updatedFeatures.metrics_retry_count,
                    error: result.error || 'Unknown'
                  },
                  created_at: new Date().toISOString()
                });
              } catch (eventError: any) {
                console.warn(`[REPLY_METRICS]   ⚠️ Failed to log metrics give-up event: ${eventError.message}`);
              }
            }

            continue;
          }
          
          const metrics = result.metrics;
          // Extract parent tweet info from features
          const parentTweetId = baseFeatures.parent_tweet_id || reply.target_tweet_id || '';
          const parentUsernameFinal = parentUsername || '';
        
          // Calculate engagement rate
          const totalEngagement = (metrics.likes || 0) + (metrics.replies || 0) + (metrics.retweets || 0);
          const engagementRate = metrics.views && metrics.views > 0 ? totalEngagement / metrics.views : 0;
        
          // Check if reply was already tracked
          const { data: existingPerf } = await supabase
            .from('reply_performance')
            .select('id, followers_gained')
            .eq('reply_tweet_id', reply.tweet_id)
            .single();
        
          // Calculate followers gained (if we have baseline)
          let followersGained = 0;
          if (existingPerf && existingPerf.followers_gained) {
            followersGained = Number(existingPerf.followers_gained); // Keep existing value
          } else if (currentFollowerCount > 0) {
            // Try to estimate (very rough)
            // In reality, you'd track follower count at time of posting
            const hoursOld = (Date.now() - new Date(String(reply.posted_at)).getTime()) / (1000 * 60 * 60);
            const estimatedGrowthRate = 0.5; // Assume 0.5 followers/hour baseline
            
            // If engagement is high, attribute some followers
            if (engagementRate > 0.02) { // 2%+ engagement rate
              followersGained = Math.floor(metrics.likes * 0.01); // Rough estimate: 1% of likes
            }
          }
          
          // Calculate visibility score (how visible was it in the thread?)
          // Higher = better position, fewer competing replies
          const parentReplies = baseFeatures.parent_replies || 1;
          const replyPosition = baseFeatures.reply_position || parentReplies;
          const visibilityScore = Math.max(0, 1 - (replyPosition / Math.max(parentReplies, 10)));
          
          // Check if conversation continued (did we get replies?)
          const conversationContinued = (metrics.replies || 0) > 0;
          
          // 🔥 STORE ALL METADATA in reply_performance table
          const perfData = {
            decision_id: reply.decision_id,
            reply_tweet_id: reply.tweet_id,
            parent_tweet_id: parentTweetId,
            parent_username: parentUsernameFinal,
            
            // Engagement metrics
            likes: metrics.likes || 0,
            replies: metrics.replies || 0,
            impressions: metrics.views || 0,
            
            // Follower impact
            followers_gained: followersGained,
            
            // Quality metrics
            reply_relevance_score: engagementRate,
            conversation_continuation: conversationContinued,
            visibility_score: visibilityScore,
            engagement_rate: engagementRate,
            
            // Metadata (store extra context as JSON)
            reply_metadata: {
              retweets: metrics.retweets || 0,
              bookmarks: metrics.bookmarks || 0,
              parent_likes: baseFeatures.parent_likes || 0,
              parent_replies: baseFeatures.parent_replies || 0,
              reply_position: replyPosition,
              time_of_day: new Date(String(reply.posted_at)).getHours(),
              day_of_week: new Date(String(reply.posted_at)).getDay(),
              hours_since_parent: baseFeatures.hours_since_parent || 0,
              parent_account_size: baseFeatures.parent_account_size || 0,
              generator_used: baseFeatures.generator || 'unknown'
            },
            
            updated_at: new Date().toISOString()
          };
          
          // Upsert to reply_performance
          const { error: perfError } = await supabase
            .from('reply_performance')
            .upsert(perfData, { onConflict: 'reply_tweet_id' });
          
          if (perfError) {
            console.error(`[REPLY_METRICS]   ❌ Failed to store performance:`, perfError);
          } else {
            console.log(`[REPLY_METRICS]   ✅ Stored reply_performance for ${reply.tweet_id}`);
          }

          // Update content_metadata so dashboards & analytics stay in sync (always attempt)
          const successFeatures: Record<string, any> = {
            ...reservationFeatures,
            metrics_in_progress: false,
            metrics_last_success_at: nowIso,
            metrics_last_error: null,
            metrics_last_views: metrics.views ?? null,
            metrics_last_likes: metrics.likes ?? null
          };
          if ('metrics_retry_count' in successFeatures) {
            delete successFeatures.metrics_retry_count;
          }
          if (canonicalTweetUrl) {
            successFeatures.tweet_url = canonicalTweetUrl;
          }

          // 🎯 PHASE 6.3B: Compute and persist reward for strategy learning
          let reward = 0;
          let rewardData: Record<string, any> = {};
          
          try {
            const { computeReward, formatRewardForStorage } = await import('../growth/reward');
            const { recordStrategyReward } = await import('../growth/strategyRewards');
            
            // Get strategy info from features
            const strategyId = reservationFeatures.strategy_id || 'baseline';
            const strategyVersion = String(reservationFeatures.strategy_version || '1');
            
            // 🔒 FOLLOWER GROWTH: Extract follower_delta from features (if tracked)
            const followerDelta24h = reservationFeatures.follower_delta_24h || null;
            const followerDelta6h = reservationFeatures.follower_delta_6h || null;
            const followerDelta1h = reservationFeatures.follower_delta_1h || null;
            const profileClicks = reservationFeatures.profile_clicks || null;
            
            // Compute reward from engagement metrics (with follower shaping)
            reward = computeReward({
              likes: metrics.likes || 0,
              replies: metrics.replies || 0,
              reposts: metrics.retweets || 0,
              retweets: metrics.retweets || 0,
              bookmarks: 0, // Not available in current metrics
              impressions: metrics.views || 0,
              follower_delta_1h: followerDelta1h || undefined,
              follower_delta_6h: followerDelta6h || undefined,
              follower_delta_24h: followerDelta24h || undefined,
              profile_clicks: profileClicks || undefined,
            });
            
            // Format reward for storage (includes follower telemetry)
            rewardData = formatRewardForStorage(reward, {
              likes: metrics.likes || 0,
              replies: metrics.replies || 0,
              reposts: metrics.retweets || 0,
              impressions: metrics.views || 0,
              follower_delta_1h: followerDelta1h || undefined,
              follower_delta_6h: followerDelta6h || undefined,
              follower_delta_24h: followerDelta24h || undefined,
              profile_clicks: profileClicks || undefined,
            });
            
            // Record reward in strategy_rewards table
            await recordStrategyReward(strategyId, strategyVersion, reward);
            
            console.log(`[REPLY_METRICS] 🎯 Computed reward=${reward.toFixed(3)} for strategy=${strategyId}/${strategyVersion}`);
          } catch (rewardError: any) {
            console.warn(`[REPLY_METRICS] ⚠️ Failed to compute/persist reward:`, rewardError.message);
            // Don't fail - reward tracking is not critical
          }
          
          // Update content_metadata so dashboards & analytics stay in sync
          const { error: metaError } = await supabase
            .from('content_metadata')
            .update({
              actual_impressions: metrics.views ?? null,
              actual_likes: metrics.likes ?? null,
              actual_retweets: metrics.retweets ?? null,
              actual_replies: metrics.replies ?? null,
              updated_at: new Date().toISOString(),
              features: {
                ...successFeatures,
                ...rewardData, // Include reward data
              }
            })
            .eq('decision_id', reply.decision_id);

          if (metaError) {
            console.error(`[REPLY_METRICS]   ❌ Failed to update content_metadata for ${reply.tweet_id}:`, metaError.message);
            failedCount++;
          } else {
            scrapedCount++;
            console.log(`[REPLY_METRICS]   ✅ Updated content_metadata for ${reply.tweet_id}: ${metrics.views || 0} views, ${metrics.likes || 0} likes`);
          }
          
          // 🔥 CRITICAL: Also write to tweet_metrics table (dashboard checks this!)
          const { error: tweetMetricsError } = await supabase
            .from('tweet_metrics')
            .upsert({
              tweet_id: reply.tweet_id,
              impressions_count: metrics.views ?? null,
              likes_count: metrics.likes ?? null,
              retweets_count: metrics.retweets ?? null,
              replies_count: metrics.replies ?? null,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'tweet_id'
            });
          
          if (tweetMetricsError) {
            console.warn(`[REPLY_METRICS]   ⚠️ Failed to update tweet_metrics for ${reply.tweet_id}:`, tweetMetricsError.message);
          } else {
            console.log(`[REPLY_METRICS]   ✅ Updated tweet_metrics for ${reply.tweet_id}`);
          }
          
          // 🧠 PHASE 3: UPDATE ACCOUNT PERFORMANCE FOR ADAPTIVE TARGETING
          // If this is a high-value reply, update discovered_accounts for prioritization
          if (followersGained >= 10 && reply.target_username) {
            try {
              const { error: accountUpdateError } = await supabase
                .from('discovered_accounts')
                .upsert({
                  username: reply.target_username,
                  avg_followers_per_reply: followersGained, // Will be averaged over time
                  performance_tier: 'excellent',
                  last_high_value_reply_at: new Date().toISOString(),
                  total_replies_count: 1, // Will be incremented
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'username',
                  ignoreDuplicates: false
                });
              
              if (accountUpdateError) {
                console.warn(`[REPLY_METRICS]   ⚠️ Failed to update account performance for @${reply.target_username}:`, accountUpdateError.message);
              } else {
                console.log(`[REPLY_METRICS]   🌟 HIGH-VALUE REPLY: Updated @${reply.target_username} performance (+${followersGained} followers)`);
              }
            } catch (accountError: any) {
              console.warn(`[REPLY_METRICS]   ⚠️ Account performance update failed:`, accountError.message);
            }
          }
          
          // 🔥 CRITICAL: Write to outcomes table (used by bandit algorithms and learning systems)
          const { error: outcomesError } = await supabase
            .from('outcomes')
            .upsert({
              decision_id: reply.decision_id,
              tweet_id: reply.tweet_id,
              likes: metrics.likes ?? null,
              retweets: metrics.retweets ?? null,
              replies: metrics.replies ?? null,
              views: metrics.views ?? null,
              impressions: metrics.views ?? null,
              bookmarks: metrics.bookmarks ?? null,
              engagement_rate: engagementRate,
              collected_at: new Date().toISOString(),
              data_source: 'reply_metrics_scraper',
              simulated: false
            }, {
              onConflict: 'decision_id'
            });
          
          if (outcomesError) {
            console.warn(`[REPLY_METRICS]   ⚠️ Failed to update outcomes for ${reply.tweet_id}:`, outcomesError.message);
          } else {
            console.log(`[REPLY_METRICS]   ✅ Updated outcomes for ${reply.tweet_id}`);
          }
          
          // 🔥 CRITICAL: Write to learning_posts table (used by 30+ learning systems)
          const { error: learningError } = await supabase
            .from('learning_posts')
            .upsert({
              tweet_id: reply.tweet_id,
              likes_count: metrics.likes ?? 0,
              retweets_count: metrics.retweets ?? 0,
              replies_count: metrics.replies ?? 0,
              bookmarks_count: metrics.bookmarks ?? 0,
              impressions_count: metrics.views ?? 0,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'tweet_id'
            });
          
          if (learningError) {
            console.warn(`[REPLY_METRICS]   ⚠️ Failed to update learning_posts for ${reply.tweet_id}:`, learningError.message);
          } else {
            console.log(`[REPLY_METRICS]   ✅ Updated learning_posts for ${reply.tweet_id}`);
          }
          
          // Small delay between scrapes
          await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error: any) {
        console.error(`[REPLY_METRICS]   ❌ Error scraping ${reply.tweet_id}:`, error.message);
        failedCount++;

        const failureFeatures = {
          ...reservationFeatures,
          metrics_in_progress: false,
          metrics_retry_count: retryCount + 1,
          metrics_last_error: error.message,
          metrics_last_attempt_at: nowIso
        };
        try {
          await supabase
            .from('content_metadata')
            .update({
              features: failureFeatures,
              updated_at: new Date().toISOString()
            })
            .eq('decision_id', reply.decision_id);
        } catch (persistError: any) {
          console.warn(`[REPLY_METRICS]   ⚠️ Failed to persist failure state for ${reply.tweet_id}: ${persistError.message}`);
        }

        if (failureFeatures.metrics_retry_count >= MAX_SCRAPE_RETRIES) {
          try {
            await supabase.from('system_events').insert({
              event_type: 'reply_metrics_giveup',
              severity: 'warning',
              event_data: {
                reply_tweet_id: reply.tweet_id,
                decision_id: reply.decision_id,
                retries: failureFeatures.metrics_retry_count,
                error: error.message || 'Unknown'
              },
              created_at: new Date().toISOString()
            });
          } catch (eventError: any) {
            console.warn(`[REPLY_METRICS]   ⚠️ Failed to log metrics give-up event (catch): ${eventError.message}`);
          }
        }
      }
    }
    } finally {
      // Release browser page
      await pool.releasePage(page);
    }
    
    console.log(`[REPLY_METRICS] ✅ Scraping complete: ${scrapedCount} successful, ${failedCount} failed`);
    
  } catch (error: any) {
    console.error('[REPLY_METRICS] ❌ Job failed:', error.message);
    throw error;
  }
}


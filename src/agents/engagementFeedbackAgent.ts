import { supabaseClient } from '../utils/supabaseClient';
import { xClient } from '../utils/xClient';
import { AwarenessLogger } from '../utils/awarenessLogger';
import * as quotaGuard from '../utils/quotaGuard';

export class EngagementFeedbackAgent {
  private lastRun: Date | null = null;

  async run(): Promise<void> {
    console.log('📊 === ENGAGEMENT FEEDBACK AGENT STARTED ===');
    
    try {
      // Get tweets from last 48 hours that need engagement updates
      const tweetsToUpdate = await this.getTweetsNeedingUpdate();
      console.log(`📊 Found ${tweetsToUpdate.length} tweets needing engagement updates`);

      let updatedCount = 0;
      let newFollowersTotal = 0;
      let impressionsTotal = 0;

      for (const tweet of tweetsToUpdate) {
        // Rate limit protection
        if (!(await quotaGuard.canMakeRead())) {
          console.log('⏸️ Rate limit reached, stopping engagement updates');
          break;
        }

        const engagement = await this.fetchTweetEngagement(tweet.tweet_id);
        if (engagement) {
          await this.updateTweetEngagement(tweet.tweet_id, engagement);
          
          // Track daily aggregates
          impressionsTotal += engagement.impressions || 0;
          newFollowersTotal += engagement.new_followers || 0;
          updatedCount++;
        }

        // Throttle to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Nightly aggregation (if running between 2-4 AM)
      const currentHour = new Date().getUTCHours();
      if (currentHour >= 2 && currentHour <= 4) {
        await this.performNightlyAggregation();
      }

      console.log(`✅ Updated ${updatedCount} tweets with engagement data`);
      console.log(`📈 Total impressions: ${impressionsTotal}, New followers: ${newFollowersTotal}`);
      
      // Note: Using static method since that's how AwarenessLogger is structured
      console.log('📊 Engagement feedback completed');

    } catch (error) {
      console.error('❌ Engagement feedback agent failed:', error);
    }
  }

  private async getTweetsNeedingUpdate(): Promise<any[]> {
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const { data, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('tweet_id, created_at, impressions')
        .gte('created_at', twoDaysAgo.toISOString())
        .is('impressions', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching tweets needing update:', error);
      return [];
    }
  }

  private async fetchTweetEngagement(tweetId: string): Promise<any | null> {
    try {
      // Use Twitter API to get tweet metrics
      const response = await quotaGuard.safeRead(async () => {
        return await xClient.getTweetById(tweetId);
      });

      if (!response) {
        console.log(`⚠️ No engagement data for tweet ${tweetId}`);
        return null;
      }

      const metrics = response.public_metrics;
      
      // Estimate new followers based on engagement quality
      // This is a heuristic since we can't get direct follower attribution
      const engagementScore = (metrics.like_count * 1) + (metrics.retweet_count * 3) + (metrics.reply_count * 2);
      const estimatedNewFollowers = Math.floor(engagementScore * 0.02); // 2% conversion estimate

      return {
        impressions: metrics.impression_count || 0,
        likes: metrics.like_count || 0,
        retweets: metrics.retweet_count || 0,
        replies: metrics.reply_count || 0,
        new_followers: estimatedNewFollowers
      };
    } catch (error) {
      console.error(`Error fetching engagement for tweet ${tweetId}:`, error);
      return null;
    }
  }

  private async updateTweetEngagement(tweetId: string, engagement: any): Promise<void> {
    try {
      const { error } = await supabaseClient.supabase
        ?.from('tweets')
        .update({
          impressions: engagement.impressions,
          likes: engagement.likes,
          retweets: engagement.retweets,
          replies: engagement.replies,
          new_followers: engagement.new_followers,
          engagement_score: engagement.likes + (engagement.retweets * 2) + (engagement.replies * 3)
        })
        .eq('tweet_id', tweetId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating tweet engagement:', error);
    }
  }

  private async performNightlyAggregation(): Promise<void> {
    console.log('🌙 Performing nightly growth metrics aggregation...');
    
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Aggregate yesterday's data
      const { data, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('impressions, new_followers')
        .gte('created_at', `${yesterdayStr} 00:00:00`)
        .lt('created_at', `${yesterdayStr} 23:59:59`);

      if (error) throw error;

      let totalImpressions = 0;
      let totalNewFollowers = 0;

      for (const tweet of data || []) {
        totalImpressions += tweet.impressions || 0;
        totalNewFollowers += tweet.new_followers || 0;
      }

      // Update growth_metrics table
      await supabaseClient.supabase?.rpc('incr_metric', {
        metric_day: yesterdayStr,
        imp: totalImpressions,
        foll: totalNewFollowers
      });

      console.log(`📊 Aggregated: ${totalImpressions} impressions, ${totalNewFollowers} new followers for ${yesterdayStr}`);
      
    } catch (error) {
      console.error('Error in nightly aggregation:', error);
    }
  }

  async getGrowthMetrics(days: number = 7): Promise<any[]> {
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('growth_metrics')
        .select('*')
        .order('day', { ascending: false })
        .limit(days);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching growth metrics:', error);
      return [];
    }
  }
} 
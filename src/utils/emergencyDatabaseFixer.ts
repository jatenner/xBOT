/**
 * 🚨 EMERGENCY DATABASE FIXER
 * Resolves foreign key constraint violations and ensures proper data storage order
 */

import { supabaseClient } from './supabaseClient';

export class EmergencyDatabaseFixer {
  
  /**
   * 🔧 ENSURE TWEET EXISTS BEFORE ANALYTICS
   */
  static async ensureTweetExists(tweetId: string, content: string): Promise<boolean> {
    try {
      // Check if tweet already exists
      const { data: existingTweet } = await supabaseClient.supabase
        .from('tweets')
        .select('tweet_id')
        .eq('tweet_id', tweetId)
        .limit(1);

      if (existingTweet && existingTweet.length > 0) {
        console.log(`✅ Tweet ${tweetId} already exists in database`);
        return true;
      }

      // Create the tweet record
      console.log(`📝 Creating tweet record for: ${tweetId}`);
      const { error: insertError } = await supabaseClient.supabase
        .from('tweets')
        .insert({
          tweet_id: tweetId,
          content: content,
          tweet_type: 'original',
          content_type: 'general',
          content_category: 'health_tech',
          source_attribution: 'AI Generated',
          engagement_score: 0,
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0,
          has_snap2health_cta: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Failed to create tweet record:', insertError);
        return false;
      }

      console.log(`✅ Tweet record created successfully: ${tweetId}`);
      return true;

    } catch (error) {
      console.error('❌ Error ensuring tweet exists:', error);
      return false;
    }
  }

  /**
   * 🩺 SAFE ANALYTICS STORAGE
   */
  static async storeAnalyticsSafely(tweetId: string, analyticsData: any): Promise<boolean> {
    try {
      // Ensure tweet exists first
      const tweetExists = await this.ensureTweetExists(tweetId, analyticsData.content || 'Unknown content');
      
      if (!tweetExists) {
        console.warn(`⚠️ Cannot store analytics - tweet ${tweetId} doesn't exist and couldn't be created`);
        return false;
      }

      // Store analytics data
      const { error } = await supabaseClient.supabase
        .from('tweet_analytics')
        .insert({
          tweet_id: tweetId,
          ...analyticsData,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Failed to store analytics:', error);
        return false;
      }

      console.log(`✅ Analytics stored successfully for tweet: ${tweetId}`);
      return true;

    } catch (error) {
      console.error('❌ Error storing analytics safely:', error);
      return false;
    }
  }

  /**
   * 🧹 CLEAN ORPHANED ANALYTICS
   */
  static async cleanOrphanedAnalytics(): Promise<void> {
    try {
      console.log('🧹 Cleaning orphaned analytics data...');

      // Delete analytics records that don't have corresponding tweets
      const { error } = await supabaseClient.supabase
        .from('tweet_analytics')
        .delete()
        .not('tweet_id', 'in', `(
          SELECT tweet_id FROM tweets
        )`);

      if (error) {
        console.error('❌ Failed to clean orphaned analytics:', error);
      } else {
        console.log('✅ Orphaned analytics cleaned successfully');
      }

    } catch (error) {
      console.error('❌ Error cleaning orphaned analytics:', error);
    }
  }

  /**
   * 🔧 FIX MISSING TWEET RECORDS
   */
  static async fixMissingTweetRecords(tweetIds: string[]): Promise<void> {
    try {
      console.log(`🔧 Fixing missing tweet records for ${tweetIds.length} tweets...`);

      for (const tweetId of tweetIds) {
        await this.ensureTweetExists(tweetId, `Recovered tweet ${tweetId}`);
      }

      console.log('✅ Missing tweet records fixed');

    } catch (error) {
      console.error('❌ Error fixing missing tweet records:', error);
    }
  }
}
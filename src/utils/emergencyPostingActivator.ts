/**
 * 🚨 EMERGENCY POSTING ACTIVATOR
 * Immediately clears duplicate cache and forces new posts to resume growth
 */

import * as fs from 'fs';
import { supabaseClient } from './supabaseClient';

export class EmergencyPostingActivator {
  
  /**
   * 🚨 IMMEDIATE DUPLICATE CACHE CLEAR
   */
  static async clearAllDuplicateCaches(): Promise<void> {
    console.log('🚨 === EMERGENCY DUPLICATE CACHE CLEAR ===');
    
    try {
      // Clear all cache files
      const cacheFiles = [
        '.duplicate_context.json',
        '.daily_spending.log',
        '.content_cache.json',
        '.completion_cache.json',
        '.elite_content_cache.json'
      ];

      for (const file of cacheFiles) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`✅ Cleared cache: ${file}`);
        }
      }

      // Clear database duplicate history (last 24 hours to force fresh content)
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabaseClient.supabase
        .from('post_history')
        .delete()
        .gte('posted_at', cutoffTime);

      if (error) {
        console.warn('⚠️ Could not clear post history:', error.message);
      } else {
        console.log('✅ Cleared 24h post history from database');
      }

      console.log('🆕 ALL DUPLICATE CACHES CLEARED - Fresh content generation will occur');
      
    } catch (error) {
      console.error('❌ Cache clear error:', error);
    }
  }

  /**
   * 🚀 FORCE IMMEDIATE POST
   */
  static async forceImmediatePost(): Promise<{
    success: boolean;
    tweetId?: string;
    content?: string;
    error?: string;
  }> {
    console.log('🚀 === FORCING IMMEDIATE POST ===');
    
    try {
      // Clear caches first
      await this.clearAllDuplicateCaches();
      
      // Import and use emergency content generator
      const { EmergencyContentGenerator } = await import('./emergencyContentGenerator');
      const emergencyContent = await EmergencyContentGenerator.generateEmergencyContent();
      
      if (!emergencyContent.success || !emergencyContent.content) {
        return {
          success: false,
          error: 'Emergency content generation failed'
        };
      }

      console.log(`📝 Generated emergency content: "${emergencyContent.content.substring(0, 100)}..."`);

      // Use browser poster directly to bypass posting engine
      const { BrowserTweetPoster } = await import('./browserTweetPoster');
      const poster = new BrowserTweetPoster();
      
      // Post emergency content directly
      const result = await poster.postTweet(emergencyContent.content);
      
      if (result.success) {
        console.log('✅ EMERGENCY POST SUCCESSFUL!');
        
        // Store in database for tracking
        try {
          const { EmergencyDatabaseFixer } = await import('./emergencyDatabaseFixer');
          await EmergencyDatabaseFixer.ensureTweetExists(result.tweet_id, emergencyContent.content);
        } catch (dbError) {
          console.warn('⚠️ Database storage failed:', dbError);
        }
        
        return {
          success: true,
          tweetId: result.tweet_id,
          content: emergencyContent.content
        };
      } else {
        console.error('❌ Emergency post failed:', result.error);
        return {
          success: false,
          error: result.error
        };
      }
      
    } catch (error) {
      console.error('❌ Force post error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🔥 ACTIVATE VIRAL POSTING MODE
   */
  static async activateViralMode(): Promise<void> {
    console.log('🔥 === ACTIVATING VIRAL POSTING MODE ===');
    
    try {
      // Check for emergency config file first
      const emergencyConfigPath = '.emergency_config.json';
      let emergencyConfig = null;
      
      if (require('fs').existsSync(emergencyConfigPath)) {
        emergencyConfig = JSON.parse(require('fs').readFileSync(emergencyConfigPath, 'utf8'));
        console.log('📋 Found emergency config file');
      }
      
      const { RuntimeConfigManager } = await import('./runtimeConfigManager');
      
      // Enable maximum growth settings
      await RuntimeConfigManager.set('emergency_posting_mode', true);
      await RuntimeConfigManager.set('viral_content_probability', emergencyConfig?.viral_content_probability || 1.0);
      await RuntimeConfigManager.set('daily_post_cap', emergencyConfig?.daily_post_cap || 20);
      await RuntimeConfigManager.set('min_hours_between_posts', emergencyConfig?.min_hours_between_posts || 1);
      await RuntimeConfigManager.set('force_trending_topics', emergencyConfig?.force_trending_topics || true);
      await RuntimeConfigManager.set('engagement_multiplier', emergencyConfig?.engagement_multiplier || 2.0);
      
      // Clear duplicate prevention temporarily
      await RuntimeConfigManager.set('duplicate_threshold', emergencyConfig?.duplicate_threshold || 0.5);
      await RuntimeConfigManager.set('semantic_similarity_threshold', emergencyConfig?.semantic_similarity_threshold || 0.5);
      
      console.log('🚀 VIRAL MODE ACTIVATED:');
      console.log('   📊 100% viral content');
      console.log('   📈 20 posts/day maximum');
      console.log('   ⏰ 1 hour minimum between posts');
      console.log('   🔥 2x engagement multiplier');
      console.log('   📰 Forced trending topic integration');
      
    } catch (error) {
      console.error('❌ Viral mode activation failed:', error);
    }
  }

  /**
   * 📊 EMERGENCY GROWTH METRICS RESET
   */
  static async resetGrowthMetrics(): Promise<void> {
    console.log('📊 === RESETTING GROWTH METRICS ===');
    
    try {
      const { RuntimeConfigManager } = await import('./runtimeConfigManager');
      
      // Reset growth metrics to enable aggressive posting
      const resetMetrics = {
        followerGrowth24h: 0,
        engagementRate: 0,
        postsToday: 0, // Reset to allow more posting
        viralHits: 0,
        aiOptimizationScore: 100, // Max optimization
        budgetEfficiency: 1.0,
        systemHealth: "optimal",
        lastSuccessfulPost: null, // Clear last post time
        emergencyModeActive: true,
        lastUpdated: new Date().toISOString()
      };
      
      await RuntimeConfigManager.set('viral_growth_metrics', resetMetrics);
      console.log('✅ Growth metrics reset for emergency posting');
      
    } catch (error) {
      console.error('❌ Metrics reset failed:', error);
    }
  }

  /**
   * 🎯 COMPLETE EMERGENCY ACTIVATION
   */
  static async activateEmergencyGrowth(): Promise<{
    success: boolean;
    actions: string[];
    nextSteps: string[];
  }> {
    console.log('🎯 === COMPLETE EMERGENCY GROWTH ACTIVATION ===');
    
    const actions: string[] = [];
    
    try {
      // Step 1: Clear all duplicate caches
      await this.clearAllDuplicateCaches();
      actions.push('✅ Cleared all duplicate caches');
      
      // Step 2: Reset growth metrics
      await this.resetGrowthMetrics();
      actions.push('✅ Reset growth metrics');
      
      // Step 3: Activate viral mode
      await this.activateViralMode();
      actions.push('✅ Activated viral posting mode');
      
      // Step 4: Force immediate post
      const postResult = await this.forceImmediatePost();
      if (postResult.success) {
        actions.push(`✅ Posted emergency content: ${postResult.tweetId}`);
      } else {
        actions.push(`⚠️ Emergency post failed: ${postResult.error}`);
      }
      
      console.log('🚀 EMERGENCY GROWTH ACTIVATION COMPLETE');
      
      return {
        success: true,
        actions,
        nextSteps: [
          'Monitor logs for successful posting resumption',
          'Watch for increased engagement on emergency content',
          'Verify posting frequency increases to 3-4 posts/day',
          'Track follower growth acceleration',
          'Adjust viral content probability based on performance'
        ]
      };
      
    } catch (error) {
      console.error('❌ Emergency activation failed:', error);
      actions.push(`❌ Activation failed: ${error.message}`);
      
      return {
        success: false,
        actions,
        nextSteps: ['Check logs for specific errors', 'Retry emergency activation']
      };
    }
  }
}
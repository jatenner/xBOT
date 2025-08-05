
import { openaiClient } from '../utils/openaiClient';
import { xClient } from '../utils/xClient';
import { DiverseContentAgent } from './diverseContentAgent';
import { ViralContentAnalyzer } from './viralContentAnalyzer';
import { secureSupabaseClient } from '../utils/secureSupabaseClient';

export class PostTweetAgent {
  private diverseContentAgent: DiverseContentAgent;
  private viralAnalyzer: ViralContentAnalyzer;

  constructor() {
    this.diverseContentAgent = new DiverseContentAgent();
    this.viralAnalyzer = new ViralContentAnalyzer();
  }

  async run(): Promise<void> {
    try {
      console.log('🐦 PostTweetAgent starting...');
      
      // PHASE 0: Check daily limits and process lock
      const { RobustTweetStorage } = await import('../utils/robustTweetStorage');
      const ProcessLock = (await import('../utils/processLock')).default;
      
      // Check if another instance is running
      const lockStatus = ProcessLock.checkStatus();
      if (lockStatus.lockExists && !lockStatus.hasLock) {
        console.log('🚫 Another bot instance is already running. Exiting to prevent conflicts.');
        return;
      }
      
      // Check daily tweet limit
      const status = await RobustTweetStorage.getStatus();
      if (status.limitReached) {
        console.log(`🚫 Daily tweet limit reached! (${status.tweetsToday}/17) No more posts until tomorrow.`);
        return;
      }
      
      console.log(`📊 Daily Status: ${status.tweetsToday}/17 tweets posted, ${status.remaining} remaining`);
      
      let finalContent = '';
      let contentType = '';
      let viralScore = 0;
      let followerGrowthPotential = 0;
      
      // PHASE 1: Generate initial content
      console.log('🎨 Generating diverse, non-repetitive health content...');
      const diverseResult = await this.diverseContentAgent.generateDiverseContent();
      
      if (diverseResult.success && diverseResult.content) {
        console.log('🎯 Diverse content generated successfully');
        
        // PHASE 2: AI VIRAL ANALYSIS & OPTIMIZATION
        console.log('🧠 AI analyzing viral potential and optimizing content...');
        
        const viralAnalysis = await this.viralAnalyzer.predictViralPotential(diverseResult.content);
        viralScore = viralAnalysis.viralScore;
        followerGrowthPotential = viralAnalysis.followerGrowthPotential;
        
        if (viralAnalysis.shouldPost && viralAnalysis.viralScore >= 6) {
          // Content is good enough to post as-is
          finalContent = diverseResult.content;
          contentType = diverseResult.type;
          console.log(`✅ Content approved for posting: ${viralScore}/10 viral score`);
        } else {
          // Optimize content for better performance
          console.log('🚀 Optimizing content for better viral potential...');
          const optimization = await this.viralAnalyzer.optimizeContentForGrowth(diverseResult.content);
          
          // Re-analyze optimized content
          const optimizedAnalysis = await this.viralAnalyzer.predictViralPotential(optimization.optimizedContent);
          
          if (optimizedAnalysis.viralScore > viralAnalysis.viralScore) {
            finalContent = optimization.optimizedContent;
            viralScore = optimizedAnalysis.viralScore;
            followerGrowthPotential = optimizedAnalysis.followerGrowthPotential;
            console.log(`🎯 Content optimized: ${viralScore}/10 viral score (${optimization.improvementReason})`);
          } else {
            finalContent = diverseResult.content;
            console.log('📊 Using original content (optimization didn\'t improve scores)');
          }
          
          contentType = `${diverseResult.type}_optimized`;
        }
      } else {
        // Fallback to simpler generation
        console.log('🔄 Trying fallback content generation...');
        const fallbackResult = await this.generateSimpleDiverseContent();
        
        if (fallbackResult.success) {
          console.log('✅ Fallback content generated successfully');
          
          // Still analyze viral potential even for fallback
          const viralAnalysis = await this.viralAnalyzer.predictViralPotential(fallbackResult.content);
          viralScore = viralAnalysis.viralScore;
          followerGrowthPotential = viralAnalysis.followerGrowthPotential;
          
          finalContent = fallbackResult.content;
          contentType = fallbackResult.type;
        } else {
          // Final fallback
          console.log('🔄 Using simple health generator as final fallback...');
          finalContent = await this.generateFinalFallbackContent();
          contentType = 'simple_fallback';
          viralScore = 5; // Default score for fallback
          followerGrowthPotential = 5;
        }
      }

      if (!finalContent) {
        throw new Error('Failed to generate any content');
      }

      // PHASE 3: Post with enhanced logging
      console.log('📝 Final content preview:', finalContent.substring(0, 100) + '...');
      console.log(`🎯 Viral Score: ${viralScore}/10, Growth Potential: ${followerGrowthPotential}/10`);
      
      // 🧵 CRITICAL FIX: Check if content should be a thread before posting
      const { IntelligentPostTypeDetector } = await import('../utils/intelligentPostTypeDetector');
      const typeDecision = IntelligentPostTypeDetector.analyzeContent(finalContent);
      
      if (typeDecision.shouldBeThread) {
        console.log('🧵 THREADING DETECTED: Content should be posted as thread');
        
        // Parse content into thread
        const { parseNumberedThread } = await import('../utils/threadUtils');
        const threadResult = parseNumberedThread(finalContent);
        
        if (threadResult.isThread && threadResult.tweets.length > 1) {
          console.log(`🧵 POSTING THREAD: ${threadResult.tweets.length} tweets`);
          
          // Use ThreadPostingAgent for proper threading
          const { ThreadPostingAgent } = await import('./threadPostingAgent');
          const threadPoster = new ThreadPostingAgent();
          
          const threadPostResult = await threadPoster.postContent({
            content: threadResult.tweets,
            format: 'THREAD' as any,
            style: 'HEALTH_EDUCATION' as any,
            topic: 'HEALTH_EDUCATION' as any,
            metadata: { 
              estimated_engagement: 0,
              confidence_score: 0.8,
              generation_timestamp: Date.now().toString(),
              model_used: 'gpt-4o-mini'
            }
          });
          
          if (threadPostResult.success) {
            console.log(`✅ THREAD POSTED: ${threadPostResult.tweetIds.length} tweets`);
            
            // Store with AI metrics for first tweet
            await this.storeTweetWithAIMetrics(threadPostResult.tweetIds[0], finalContent, contentType, viralScore, followerGrowthPotential);
            
                        // Thread posted successfully, continue with normal flow
          } else {
            console.error('❌ Thread posting failed, falling back to single tweet');
            // Fall through to single tweet posting
          }
        }
      }

      // Post as single tweet (original logic)
      console.log('📝 Posting as single tweet');
      const result = await xClient.postTweet(finalContent);
      
      if (result.success && result.tweetId) {
        console.log(`✅ Tweet posted successfully: ${result.tweetId}`);
        
        // PHASE 4: Enhanced database storage with AI metrics
        await this.storeTweetWithAIMetrics(result.tweetId, finalContent, contentType, viralScore, followerGrowthPotential);
        
        console.log('✅ Simple health tip posted successfully!');
        console.log(`📝 Content: "${finalContent}"`);
        console.log(`🎯 AI Metrics: Viral=${viralScore}/10, Growth=${followerGrowthPotential}/10`);
      } else {
        throw new Error(`Failed to post tweet: ${result.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('❌ PostTweetAgent error:', error);
      throw error;
    }
  }

  private async generateSimpleDiverseContent(): Promise<{ success: boolean; content: string; type: string }> {
    try {
      const templates = [
        "Sleep in {temp}°F room with {supplement}. Core temperature drop triggers {benefit1} and improves {benefit2} by {percent}%.",
        "Exercise between {time1}-{time2} when {hormone} peaks. {metric} improves {percent}% vs other times.",
        "Drink {amount} water upon waking. Metabolism increases {percent}% from rehydration after {hours}-hour fast.",
        "Fast for {hours} hours, break with {food}. Maintains {benefit1} while boosting {benefit2}.",
        "Breathe {pattern} for {minutes} minutes. {benefit} improves {percent}% and {hormone} drops.",
        "Cold exposure for {minutes} minutes daily. {hormone} increases {percent}% and fat burning improves.",
        "{activity} at {time} daily. {hormone} increases {percent}% naturally without supplements.",
        "Take {supplement} {timing}. Focus improves {percent}% and {side_effect} reduces."
      ];

      const variables = {
        temp: ['68', '65', '70', '67'],
        supplement: ['magnesium', '200mg L-theanine', 'melatonin', 'glycine'],
        benefit1: ['deep sleep', 'REM sleep', 'recovery', 'growth hormone'],
        benefit2: ['memory consolidation', 'muscle repair', 'fat burning', 'brain detox'],
        percent: ['23', '34', '45', '28', '31', '19', '42', '37'],
        time1: ['2 PM', '3 PM', '4 PM'],
        time2: ['6 PM', '7 PM', '5 PM'],
        time: ['6 AM', '7 AM', '5:30 AM', '6:30 AM'],
        hormone: ['cortisol', 'testosterone', 'growth hormone', 'insulin sensitivity'],
        metric: ['VO2 max', 'power output', 'endurance', 'strength'],
        amount: ['16 oz', '20 oz', '24 oz', '500ml'],
        hours: ['14', '16', '12', '18'],
        food: ['protein + fat', 'lean protein', 'MCT oil + protein', 'eggs + avocado'],
        pattern: ['4-7-8', 'box breathing', '4-4-4-4', '6-2-6-2'],
        minutes: ['30', '45', '20', '60', '15'],
        benefit: ['focus', 'stress relief', 'recovery', 'energy'],
        activity: ['Exercise', 'Meditate', 'Cold shower', 'Walk'],
        timing: ['morning', 'before bed', 'with food', 'on empty stomach'],
        side_effect: ['brain fog', 'anxiety', 'fatigue', 'stress']
      };

      // Select random template and replace variables
      const template = templates[Math.floor(Math.random() * templates.length)];
      let content = template;

      for (const [key, values] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        if (content.includes(placeholder)) {
          const value = values[Math.floor(Math.random() * values.length)];
          content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
      }

      // Clean up any remaining placeholders
      content = content.replace(/\{[^}]+\}/g, '');

      return {
        success: true,
        content: content,
        type: 'simple_diverse'
      };

    } catch (error) {
      console.warn('⚠️ Simple diverse content generation failed:', error);
      return {
        success: false,
        content: '',
        type: 'failed'
      };
    }
  }

  private async generateFinalFallbackContent(): Promise<string> {
    const fallbackTips = [
      "Drink water upon waking. Metabolism increases 31% from rehydration after 14-hour fast.",
      "Exercise at 3 PM when testosterone peaks. Performance improves 23% vs morning workouts.",
      "Sleep in 67°F room. Core temperature drop triggers deep sleep and improves recovery by 34%.",
      "Fast for 16 hours, break with protein. Maintains muscle while boosting fat burning by 28%.",
      "Breathe 4-7-8 pattern for 10 minutes. Stress reduces 42% and focus improves.",
      "Cold shower for 3 minutes daily. Metabolism increases 19% and mood improves."
    ];

    return fallbackTips[Math.floor(Math.random() * fallbackTips.length)];
  }

  private async storeTweetWithAIMetrics(tweetId: string, content: string, contentType: string, viralScore: number, followerGrowthPotential: number): Promise<void> {
    try {
      console.log('🏗️ Using ULTIMATE STORAGE ARCHITECTURE for bulletproof storage...');
      
      // Import Ultimate Storage Architecture
      const { MasterTweetStorageIntegrator } = await import('../utils/masterTweetStorageIntegrator');
      
      // Use Ultimate Storage Architecture with 7-phase validation
      const storeResult = await MasterTweetStorageIntegrator.storeTweet({
        tweet_id: tweetId,
        content: content,
        content_type: contentType,
        viral_score: viralScore,
        ai_growth_prediction: followerGrowthPotential,
        ai_optimized: true,
        generation_method: 'ai_enhanced'
      });

      if (!storeResult.success) {
        console.error('❌ ULTIMATE STORAGE FAILED:', storeResult.error);
        
        if (storeResult.error?.includes('limit') || storeResult.error?.includes('quota')) {
          console.log('🚫 Daily tweet limit reached! Bot will stop posting until tomorrow.');
          // Could add logic here to gracefully stop the bot
        }
      } else {
        console.log(`✅ ULTIMATE STORAGE SUCCESS! Database ID: ${storeResult.database_id}`);
        
        if (storeResult.performance_metrics) {
          console.log(`⚡ Storage Performance: ${storeResult.performance_metrics.storage_time_ms}ms`);
          console.log(`📊 Data Size: ${storeResult.performance_metrics.data_size_bytes} bytes`);
          console.log(`🔄 Retry Count: ${storeResult.performance_metrics.retry_count}`);
        }
      }

    } catch (error) {
      console.error('❌ ULTIMATE STORAGE CRITICAL ERROR:', error);
      
      // EMERGENCY SAVING: Absolutely bulletproof fallback
      console.log('🚨 Activating EMERGENCY DATABASE SAVING...');
      
      try {
        const { EmergencyDatabaseSaving } = await import('../utils/emergencyDatabaseSaving');
        
        const emergencyResult = await EmergencyDatabaseSaving.emergencySave({
          tweet_id: tweetId,
          content: content,
          content_type: contentType,
          viral_score: viralScore,
          success: true,
          posted_to_twitter: true,
          emergency_save: true
        });
        
        if (emergencyResult.success) {
          console.log(`🚨 EMERGENCY SAVE SUCCESS via ${emergencyResult.method}!`);
          if (emergencyResult.database_id) {
            console.log(`💾 Database ID: ${emergencyResult.database_id}`);
          }
        } else {
          console.error('🔥 EMERGENCY SAVE FAILED:', emergencyResult.error);
          console.error('💥 CRITICAL: Tweet posted to Twitter but NO database record!');
          console.error(`📝 Lost tweet: ${tweetId} - "${content.substring(0, 100)}..."`);
        }
        
      } catch (emergencyError) {
        console.error('💥 EMERGENCY SYSTEM CRASHED:', emergencyError);
        console.error('🚨 TOTAL SYSTEM FAILURE: Tweet posted but not saved anywhere!');
        console.error(`📝 Lost tweet: ${tweetId} - "${content.substring(0, 100)}..."`);
      }
    }
  }

  private generateContentHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content.toLowerCase().trim()).digest('hex');
  }

  private extractKeywords(content: string): string[] {
    // Extract meaningful health keywords
    const words = content.toLowerCase().match(/\b[a-zA-Z]{4,}\b/g) || [];
    const healthKeywords = words.filter(word => 
      ['metabolism', 'cortisol', 'hormone', 'protein', 'vitamin', 'mineral', 
       'supplement', 'exercise', 'sleep', 'stress', 'nutrition', 'health',
       'mechanism', 'research', 'study', 'blood', 'muscle', 'brain'].includes(word)
    );
    return healthKeywords.slice(0, 10); // Limit to 10 keywords
  }
}

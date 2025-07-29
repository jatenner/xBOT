/**
 * 🧠 SMART LEARNING POSTING ENGINE
 * Posts real content with quality gates to enable learning from actual Twitter data
 */

import { EliteTwitterContentStrategist } from '../agents/eliteTwitterContentStrategist';
import { BrowserTweetPoster } from './browserTweetPoster';
import { isNuclearBlockedContent } from '../config/nuclearContentValidation';
import { analyzeContentQuality } from './contentQualityAnalyzer';
import { supabaseClient } from './supabaseClient';

export interface SmartPostingResult {
  success: boolean;
  content?: string;
  tweetId?: string;
  qualityScore?: number;
  learningData?: any;
  error?: string;
}

export class SmartLearningPostingEngine {
  private static instance: SmartLearningPostingEngine;
  
  static getInstance(): SmartLearningPostingEngine {
    if (!this.instance) {
      this.instance = new SmartLearningPostingEngine();
    }
    return this.instance;
  }

  /**
   * 🎯 POST WITH LEARNING - Real posting with quality gates
   */
  async postWithLearning(): Promise<SmartPostingResult> {
    try {
      console.log('🧠 === SMART LEARNING POST CYCLE ===');
      
      // Step 1: Generate high-quality content
      const strategist = EliteTwitterContentStrategist.getInstance();
      const contentResult = await strategist.generateViralContent({
        topic: 'gut_health'
      });

      if (!contentResult || !contentResult.content) {
        return {
          success: false,
          error: 'Content generation failed'
        };
      }

      const content = Array.isArray(contentResult.content) ? contentResult.content[0] : contentResult.content;
      console.log(`📝 Generated: "${content.substring(0, 60)}..."`);

      // Step 2: Nuclear content validation (safety first)
      if (isNuclearBlockedContent(content)) {
        console.log('🚫 NUCLEAR BLOCK: Content failed safety validation');
        return {
          success: false,
          error: 'Content blocked by nuclear validation'
        };
      }

      // Step 3: Quality analysis for learning
      const qualityAnalysis = analyzeContentQuality(content);
      console.log(`📊 Quality Score: ${qualityAnalysis.viral_score}/100`);
      
      if (qualityAnalysis.viral_score < 50) {
        console.log('📈 Quality too low for posting - storing for learning');
        await this.storeLearningData(content, qualityAnalysis, false, 'quality_too_low');
        return {
          success: false,
          error: `Quality score too low: ${qualityAnalysis.viral_score}/100`
        };
      }

      // Step 4: Real posting for learning data
      console.log('🚀 POSTING FOR LEARNING DATA COLLECTION...');
      const poster = new BrowserTweetPoster();
      const postResult = await poster.postTweet(content);

      if (postResult.success) {
        console.log(`✅ LEARNING POST SUCCESS: ${postResult.tweet_id}`);
        
        // Store learning data for future analysis
        await this.storeLearningData(content, qualityAnalysis, true, 'posted_for_learning', postResult.tweet_id);
        
        return {
          success: true,
          content: content,
          tweetId: postResult.tweet_id,
          qualityScore: qualityAnalysis.viral_score,
          learningData: {
            posted_at: new Date().toISOString(),
            quality_analysis: qualityAnalysis,
            purpose: 'learning_data_collection'
          }
        };
      } else {
        console.log(`❌ Posting failed: ${postResult.error}`);
        await this.storeLearningData(content, qualityAnalysis, false, 'posting_failed');
        
        return {
          success: false,
          error: 'Posting failed: ' + postResult.error
        };
      }

    } catch (error) {
      console.error('❌ Smart posting error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 💾 Store learning data for future analysis
   */
  private async storeLearningData(content: string, qualityAnalysis: any, wasPosted: boolean, reason: string, tweetId?: string): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      const learningData = {
        content: content,
        quality_score: qualityAnalysis.viral_score,
        quality_issues: qualityAnalysis.quality_issues,
        audience_growth_potential: qualityAnalysis.audience_growth_potential,
        was_posted: wasPosted,
        post_reason: reason,
        tweet_id: tweetId || null,
        created_at: new Date().toISOString(),
        content_length: content.length,
        has_hook: content.toLowerCase().includes('here') || content.toLowerCase().includes('this'),
        has_stats: /\d+%|\d+ /.test(content),
        has_question: content.includes('?'),
        learning_metadata: {
          hour_generated: new Date().getHours(),
          day_of_week: new Date().getDay(),
          analysis: qualityAnalysis
        }
      };

      await supabaseClient.supabase
        .from('learning_posts')
        .insert(learningData);

      console.log('💾 Learning data stored for future analysis');
    } catch (error) {
      console.error('❌ Error storing learning data:', error);
    }
  }

  /**
   * 📊 Get learning insights from collected data
   */
  async getLearningInsights(): Promise<any> {
    try {
      if (!supabaseClient.supabase) return null;

      const { data: posts } = await supabaseClient.supabase
        .from('learning_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!posts || posts.length === 0) return null;

      const insights = {
        total_attempts: posts.length,
        successful_posts: posts.filter(p => p.was_posted).length,
        average_quality: posts.reduce((acc, p) => acc + p.quality_score, 0) / posts.length,
        optimal_length: this.findOptimalLength(posts),
        best_hooks: this.findBestHooks(posts),
        timing_patterns: this.analyzeTimingPatterns(posts)
      };

      console.log('📊 Learning Insights Generated:', insights);
      return insights;
    } catch (error) {
      console.error('❌ Error getting learning insights:', error);
      return null;
    }
  }

  private findOptimalLength(posts: any[]): any {
    const successfulPosts = posts.filter(p => p.was_posted);
    if (successfulPosts.length === 0) return { optimal: 150, confidence: 0 };
    
    const avgLength = successfulPosts.reduce((acc, p) => acc + p.content_length, 0) / successfulPosts.length;
    return { optimal: Math.round(avgLength), confidence: successfulPosts.length / posts.length };
  }

  private findBestHooks(posts: any[]): string[] {
    const successfulPosts = posts.filter(p => p.was_posted && p.has_hook);
    return successfulPosts.slice(0, 3).map(p => p.content.substring(0, 30) + '...');
  }

  private analyzeTimingPatterns(posts: any[]): any {
    const successfulPosts = posts.filter(p => p.was_posted);
    const hourCounts = {};
    
    successfulPosts.forEach(p => {
      const hour = p.learning_metadata?.hour_generated || 12;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const bestHour = Object.keys(hourCounts).reduce((a, b) => hourCounts[a] > hourCounts[b] ? a : b);
    return { best_hour: parseInt(bestHour), distribution: hourCounts };
  }
}
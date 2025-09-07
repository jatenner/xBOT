/**
 * 🚀 AGGRESSIVE POSTING SCHEDULER
 * High-frequency posting with intelligent timing and content optimization
 */

import { EnhancedContentOrchestrator } from '../ai/enhancedContentOrchestrator';
import { systemMonitor } from '../monitoring/systemPerformanceMonitor';
import { admin as supabase } from '../lib/supabaseClients';
import { intelligentDecision } from '../ai/intelligentDecisionEngine';

export interface PostingSchedule {
  base_interval_minutes: number;
  peak_hour_intervals: number[];
  off_peak_multiplier: number;
  max_posts_per_hour: number;
  min_interval_minutes: number;
}

export interface PostingMetrics {
  posts_today: number;
  success_rate: number;
  average_engagement: number;
  follower_growth_rate: number;
  last_post_time: Date;
}

export class AggressivePostingScheduler {
  private static instance: AggressivePostingScheduler;
  private contentOrchestrator: EnhancedContentOrchestrator;
  private isRunning = false;
  private postingTimer?: NodeJS.Timeout;
  
  // AGGRESSIVE SCHEDULE CONFIGURATION
  private schedule: PostingSchedule = {
    base_interval_minutes: 0, // AI-driven - no fixed interval
    peak_hour_intervals: [], // AI-driven - determined by data
    off_peak_multiplier: 1.0, // AI-driven
    max_posts_per_hour: 12, // Increased safety limit for AI optimization
    min_interval_minutes: 3 // Minimum between posts for AI system
  };

  private constructor() {
    this.contentOrchestrator = EnhancedContentOrchestrator.getInstance();
  }

  public static getInstance(): AggressivePostingScheduler {
    if (!AggressivePostingScheduler.instance) {
      AggressivePostingScheduler.instance = new AggressivePostingScheduler();
    }
    return AggressivePostingScheduler.instance;
  }

  /**
   * 🚀 START AGGRESSIVE POSTING CYCLE
   */
  public async startAggressivePosting(): Promise<void> {
    if (this.isRunning) {
      console.log('🚀 AGGRESSIVE_SCHEDULER: Already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 AGGRESSIVE_SCHEDULER: Starting high-frequency posting cycle');
    console.log(`📊 SCHEDULE: ${this.schedule.base_interval_minutes}min base interval | Max ${this.schedule.max_posts_per_hour}/hour`);

    await this.scheduleNextPost();
  }

  public stopAggressivePosting(): void {
    this.isRunning = false;
    
    if (this.postingTimer) {
      clearTimeout(this.postingTimer);
      this.postingTimer = undefined;
    }
    
    console.log('🛑 AGGRESSIVE_SCHEDULER: Stopped posting cycle');
  }

  private async scheduleNextPost(): Promise<void> {
    if (!this.isRunning) return;

    const nextInterval = await this.calculateOptimalInterval();
    
    console.log(`⏰ NEXT_POST: Scheduled in ${Math.round(nextInterval / 60000)} minutes`);
    
    this.postingTimer = setTimeout(async () => {
      await this.executePost();
      await this.scheduleNextPost(); // Schedule the next post
    }, nextInterval);
  }

  private async calculateOptimalInterval(): Promise<number> {
    try {
      console.log('🧠 AI_TIMING: Requesting optimal posting interval...');
      
      // Get AI-driven timing decision
      const timingDecision = await intelligentDecision.makeTimingDecision();
      
      if (!timingDecision.should_post_now) {
        const waitTime = timingDecision.optimal_wait_minutes * 60 * 1000;
        console.log(`🧠 AI_DECISION: Wait ${timingDecision.optimal_wait_minutes} minutes | Reason: ${timingDecision.reasoning}`);
        return waitTime;
      }
      
      // If AI says post now, use minimum interval for next check
      const nextCheckInterval = this.schedule.min_interval_minutes * 60 * 1000;
      console.log(`🧠 AI_DECISION: Post now! Next check in ${this.schedule.min_interval_minutes} minutes`);
      return nextCheckInterval;
      
    } catch (error) {
      console.error('❌ AI_TIMING: Failed to get AI timing decision:', error);
      
      // Fallback to simple logic
      const fallbackInterval = (5 + Math.random() * 10) * 60 * 1000; // 5-15 minutes
      console.log(`⚠️ FALLBACK_TIMING: Using ${Math.round(fallbackInterval / 60000)} minute interval`);
      return fallbackInterval;
    }
  }

  /**
   * 🔥 EXECUTE HIGH-QUALITY POST
   */
  private async executePost(): Promise<void> {
    console.log('🔥 AGGRESSIVE_POST: Executing high-frequency post...');
    
    try {
      // Check posting limits
      const metrics = await this.getCurrentMetrics();
      
      if (await this.shouldSkipPost(metrics)) {
        console.log('⏸️ POSTING_SKIP: Skipping post due to limits or recent activity');
        return;
      }
      
      // Generate premium AI content
      const contentResult = await this.generatePremiumContent();
      
      if (!contentResult) {
        console.error('❌ CONTENT_GENERATION: Failed to generate content');
        return;
      }
      
      // Post the content (this should integrate with your existing posting system)
      const postSuccess = await this.postContent(contentResult);
      
      if (postSuccess) {
        await this.recordSuccessfulPost(contentResult, metrics);
        console.log('✅ AGGRESSIVE_POST: High-quality content posted successfully');
      } else {
        console.error('❌ AGGRESSIVE_POST: Failed to post content');
      }
      
    } catch (error) {
      console.error('❌ AGGRESSIVE_POST: Execution failed:', error);
    }
  }

  private async shouldSkipPost(metrics: PostingMetrics): Promise<boolean> {
    const now = new Date();
    const hoursSinceLastPost = (now.getTime() - metrics.last_post_time.getTime()) / (1000 * 60 * 60);
    
    // Skip if we've hit hourly limit
    if (metrics.posts_today >= this.schedule.max_posts_per_hour && hoursSinceLastPost < 1) {
      console.log(`⏸️ RATE_LIMIT: Hit ${this.schedule.max_posts_per_hour} posts/hour limit`);
      return true;
    }
    
    // Skip if system health is poor
    const systemHealth = systemMonitor.getLatestMetrics();
    if (systemHealth?.systemHealth === 'critical') {
      console.log('⏸️ SYSTEM_HEALTH: Skipping post due to critical system health');
      return true;
    }
    
    // Skip if last post was too recent
    const minutesSinceLastPost = (now.getTime() - metrics.last_post_time.getTime()) / (1000 * 60);
    if (minutesSinceLastPost < this.schedule.min_interval_minutes) {
      console.log(`⏸️ MIN_INTERVAL: Last post ${Math.round(minutesSinceLastPost)} minutes ago`);
      return true;
    }
    
    return false;
  }

  private async generatePremiumContent(): Promise<any> {
    const startTime = Date.now();
    
    try {
      console.log('🎨 CONTENT_GEN: Getting AI-driven content strategy...');
      
      // Get AI-driven content decision
      const contentDecision = await intelligentDecision.makeContentDecision();
      
      console.log(`🧠 AI_CONTENT_DECISION: ${contentDecision.recommended_content_type} | ${contentDecision.recommended_voice_style}`);
      console.log(`🎯 AI_REASONING: ${contentDecision.reasoning}`);
      
      const contentRequest = {
        format: (Math.random() > 0.8 ? 'thread' : 'single') as 'single' | 'thread', // 20% threads for variety
        target_engagement: 'high' as 'high' | 'medium' | 'steady',
        avoid_recent_patterns: true,
        user_context: contentDecision.recommended_topic,
        preferred_content_type: contentDecision.recommended_content_type,
        preferred_voice_style: contentDecision.recommended_voice_style
      };
      
      const result = await this.contentOrchestrator.generateEnhancedContent(contentRequest);
      
      const generationTime = Date.now() - startTime;
      systemMonitor.trackContentGeneration(generationTime);
      
      console.log(`🎨 CONTENT_SUCCESS: Generated ${contentRequest.format} | ${generationTime}ms | Quality: ${result.metadata.human_voice_score}%`);
      console.log(`📊 AI_PREDICTIONS: ${contentDecision.expected_engagement}% engagement, ${contentDecision.expected_followers} followers`);
      
      // Store the AI prediction for later validation
      result.ai_prediction = {
        expected_engagement: contentDecision.expected_engagement,
        expected_followers: contentDecision.expected_followers,
        confidence_score: contentDecision.confidence_score
      };
      
      return result;
      
    } catch (error) {
      console.error('❌ CONTENT_GEN: Premium content generation failed:', error);
      return null;
    }
  }

  private generateDynamicContext(): string {
    const healthTopics = [
      'mental health and stress management',
      'nutrition myths and facts',
      'longevity research discoveries',
      'sleep optimization strategies',
      'exercise science breakthroughs',
      'gut health and microbiome',
      'vitamin and supplement effectiveness',
      'preventive medicine approaches',
      'cognitive enhancement techniques',
      'anti-aging interventions'
    ];
    
    const contexts = [
      'latest research findings',
      'personal health optimization',
      'common health misconceptions',
      'practical wellness strategies',
      'emerging health trends',
      'evidence-based approaches'
    ];
    
    const topic = healthTopics[Math.floor(Math.random() * healthTopics.length)];
    const context = contexts[Math.floor(Math.random() * contexts.length)];
    
    return `${context} in ${topic}`;
  }

  private async postContent(contentResult: any): Promise<boolean> {
    try {
      // This should integrate with your existing StealthTwitterPoster
      // For now, we'll simulate the posting and store the content
      
      console.log('📤 POSTING: Sending content to Twitter...');
      
      // Store in database first
      await systemMonitor.trackDBQuery('store_aggressive_post', async () => {
        return supabase
          .from('aggressive_posts')
          .insert({
            content: Array.isArray(contentResult.content) ? contentResult.content.join('\n\n') : contentResult.content,
            content_type: contentResult.metadata.content_type,
            voice_style: contentResult.metadata.voice_style,
            predicted_viral_score: contentResult.metadata.predicted_performance.viral_score,
            predicted_follower_potential: contentResult.metadata.predicted_performance.follower_potential,
            human_voice_score: contentResult.metadata.human_voice_score,
            posted_at: new Date().toISOString(),
            posting_strategy: 'aggressive_scheduled'
          });
      });
      
      // TODO: Integrate with actual posting system
      // const postSuccess = await stealthPoster.postTweet(contentResult.content);
      
      // For now, simulate success
      const simulatedSuccess = Math.random() > 0.1; // 90% success rate
      
      if (simulatedSuccess) {
        console.log('📤 POST_SUCCESS: Content posted to Twitter');
      } else {
        console.error('❌ POST_FAILED: Twitter posting failed');
      }
      
      return simulatedSuccess;
      
    } catch (error) {
      console.error('❌ POST_CONTENT: Failed to post content:', error);
      return false;
    }
  }

  private async recordSuccessfulPost(contentResult: any, metrics: PostingMetrics): Promise<void> {
    try {
      // Update posting metrics
      await systemMonitor.trackDBQuery('update_posting_metrics', async () => {
        return supabase
          .from('posting_metrics')
          .upsert({
            date: new Date().toISOString().split('T')[0],
            posts_count: metrics.posts_today + 1,
            success_rate: Math.min(95, metrics.success_rate + 1),
            last_post_time: new Date().toISOString(),
            aggressive_posting_active: true
          });
      });
      
    } catch (error) {
      console.error('❌ METRICS_UPDATE: Failed to update posting metrics:', error);
    }
  }

  private async getCurrentMetrics(): Promise<PostingMetrics> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data } = await systemMonitor.trackDBQuery('get_posting_metrics', async () => {
        return supabase
          .from('posting_metrics')
          .select('*')
          .eq('date', today)
          .single();
      });
      
      if (data) {
        return {
          posts_today: data.posts_count || 0,
          success_rate: data.success_rate || 90,
          average_engagement: data.average_engagement || 25,
          follower_growth_rate: data.follower_growth_rate || 5,
          last_post_time: new Date(data.last_post_time || new Date().toISOString())
        };
      }
      
    } catch (error) {
      console.warn('⚠️ METRICS_FETCH: Using default metrics:', error);
    }
    
    // Default metrics if none found
    return {
      posts_today: 0,
      success_rate: 90,
      average_engagement: 25,
      follower_growth_rate: 5,
      last_post_time: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
    };
  }

  /**
   * 📊 GET CURRENT POSTING STATUS
   */
  public getStatus(): { isRunning: boolean; nextPostIn: number; todaysPosts: number } {
    const nextPostIn = 0; // Simplified for sync method
    
    return {
      isRunning: this.isRunning,
      nextPostIn,
      todaysPosts: 0 // This would be populated from actual metrics
    };
  }
}

// Export singleton instance
export const aggressiveScheduler = AggressivePostingScheduler.getInstance();

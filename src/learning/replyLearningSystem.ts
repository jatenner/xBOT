/**
 * 🧠 REPLY LEARNING SYSTEM
 * Continuously learns what works and adapts strategy
 * 
 * Learns:
 * - Which generators work best for which targets
 * - Optimal timing for replies
 * - Which topics drive follows
 * - Which accounts have receptive audiences
 * - Pattern recognition across all replies
 */

import { getSupabaseClient } from '../db';

export interface ReplyPerformance {
  reply_id: string;
  target_username: string;
  generator_used: string;
  impressions: number;
  likes: number;
  profile_clicks: number;
  follows_gained: number;
  engagement_rate: number;
  follow_rate: number;
  posted_at: string;
}

export interface LearningInsight {
  insight_type: 'generator' | 'timing' | 'target' | 'topic';
  key: string;
  value: string;
  confidence: number;
  sample_size: number;
  discovered_at: string;
}

export class ReplyLearningSystem {
  private static instance: ReplyLearningSystem;
  
  private constructor() {}
  
  static getInstance(): ReplyLearningSystem {
    if (!ReplyLearningSystem.instance) {
      ReplyLearningSystem.instance = new ReplyLearningSystem();
    }
    return ReplyLearningSystem.instance;
  }

  /**
   * MAIN LEARNING LOOP - Analyze performance and extract insights
   */
  async runLearningLoop(): Promise<void> {
    console.log('[REPLY_LEARNING] 🧠 Starting learning analysis...');
    
    try {
      // Step 1: Collect recent reply performance data
      const replyData = await this.collectReplyPerformance();
      
      if (replyData.length < 10) {
        console.log('[REPLY_LEARNING] ℹ️ Need more data (minimum 10 replies), skipping analysis');
        return;
      }
      
      console.log(`[REPLY_LEARNING] 📊 Analyzing ${replyData.length} replies...`);
      
      // Step 2: Learn which generators work best
      const generatorInsights = await this.learnGeneratorPerformance(replyData);
      
      // Step 3: Learn optimal timing
      const timingInsights = await this.learnOptimalTiming(replyData);
      
      // Step 4: Learn which targets work best
      const targetInsights = await this.learnTargetPerformance(replyData);
      
      // Step 5: Learn which topics drive follows
      const topicInsights = await this.learnTopicPerformance(replyData);
      
      // Step 6: Store insights
      const allInsights = [
        ...generatorInsights,
        ...timingInsights,
        ...targetInsights,
        ...topicInsights
      ];
      
      await this.storeInsights(allInsights);
      
      console.log(`[REPLY_LEARNING] ✅ Extracted ${allInsights.length} insights`);
      
      // Step 7: Generate recommendations
      await this.generateRecommendations(allInsights);
      
    } catch (error: any) {
      console.error('[REPLY_LEARNING] ❌ Learning failed:', error.message);
    }
  }

  /**
   * Collect reply performance data
   */
  private async collectReplyPerformance(): Promise<ReplyPerformance[]> {
    const supabase = getSupabaseClient();
    
    // 🔥 METADATA GOATNESS: Collect ALL reply performance data
    // Query: Reply performance + parent tweet context + timing
    const { data, error } = await supabase
      .from('reply_performance')
      .select(`
        *,
        content_metadata!inner(
          decision_id,
          content,
          posted_at,
          features
        )
      `)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[REPLY_LEARNING] ❌ Failed to collect performance data:', error.message);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log('[REPLY_LEARNING] ℹ️ No reply performance data yet');
      return [];
    }
    
    // Transform to ReplyPerformance format
    const replyPerformance: ReplyPerformance[] = data.map((row: any) => {
      const metadata = row.content_metadata || {};
      const features = (metadata.features || {}) as any;
      
      // Calculate engagement rate
      const totalEngagement = (row.likes || 0) + (row.replies || 0);
      const engagementRate = row.impressions > 0 ? totalEngagement / row.impressions : 0;
      
      return {
        reply_id: row.reply_tweet_id,
        target_account: row.parent_username,
        generator_used: features.generator || 'unknown',
        follows_gained: row.followers_gained || 0,
        engagement_rate: engagementRate,
        profile_clicks: features.profile_clicks || 0,
        likes: row.likes || 0,
        posted_at: metadata.posted_at || row.created_at,
        
        // 🔥 EXTRA METADATA for deep learning:
        parent_tweet_id: row.parent_tweet_id,
        parent_likes: features.parent_likes || 0,
        parent_replies: features.parent_replies || 0,
        reply_position: features.reply_position || 0, // Position in thread
        time_of_day: new Date(metadata.posted_at || row.created_at).getHours(),
        day_of_week: new Date(metadata.posted_at || row.created_at).getDay(),
        reply_content: metadata.content || '',
        impressions: row.impressions || 0,
        conversation_continued: row.conversation_continuation || false
      } as any;
    });
    
    console.log(`[REPLY_LEARNING] 📊 Collected ${replyPerformance.length} reply performance records`);
    return replyPerformance;
  }

  /**
   * Learn which generators perform best
   */
  private async learnGeneratorPerformance(data: ReplyPerformance[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Group by generator
    const byGenerator = new Map<string, ReplyPerformance[]>();
    for (const reply of data) {
      const generator = reply.generator_used;
      if (!byGenerator.has(generator)) {
        byGenerator.set(generator, []);
      }
      byGenerator.get(generator)!.push(reply);
    }
    
    // Calculate average performance for each generator
    const generatorStats = Array.from(byGenerator.entries()).map(([generator, replies]) => {
      const avgFollows = replies.reduce((sum, r) => sum + r.follows_gained, 0) / replies.length;
      const avgEngagement = replies.reduce((sum, r) => sum + r.engagement_rate, 0) / replies.length;
      const avgClicks = replies.reduce((sum, r) => sum + r.profile_clicks, 0) / replies.length;
      
      return {
        generator,
        avg_follows: avgFollows,
        avg_engagement: avgEngagement,
        avg_clicks: avgClicks,
        sample_size: replies.length
      };
    });
    
    // Sort by follows gained (primary metric)
    generatorStats.sort((a, b) => b.avg_follows - a.avg_follows);
    
    // Create insights for top performers
    if (generatorStats.length > 0) {
      const best = generatorStats[0];
      insights.push({
        insight_type: 'generator',
        key: 'best_performer',
        value: `${best.generator} drives ${best.avg_follows.toFixed(2)} follows/reply (${best.sample_size} samples)`,
        confidence: this.calculateConfidence(best.sample_size),
        sample_size: best.sample_size,
        discovered_at: new Date().toISOString()
      });
    }
    
    if (generatorStats.length > 1) {
      const worst = generatorStats[generatorStats.length - 1];
      insights.push({
        insight_type: 'generator',
        key: 'worst_performer',
        value: `${worst.generator} only drives ${worst.avg_follows.toFixed(2)} follows/reply - consider reducing`,
        confidence: this.calculateConfidence(worst.sample_size),
        sample_size: worst.sample_size,
        discovered_at: new Date().toISOString()
      });
    }
    
    console.log(`[REPLY_LEARNING] 🎭 Generator insights: ${insights.length}`);
    return insights;
  }

  /**
   * Learn optimal timing for replies
   */
  private async learnOptimalTiming(data: ReplyPerformance[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Group by hour of day
    const byHour = new Map<number, ReplyPerformance[]>();
    for (const reply of data) {
      const hour = new Date(reply.posted_at).getHours();
      if (!byHour.has(hour)) {
        byHour.set(hour, []);
      }
      byHour.get(hour)!.push(reply);
    }
    
    // Find best hours
    const hourStats = Array.from(byHour.entries())
      .map(([hour, replies]) => ({
        hour,
        avg_engagement: replies.reduce((sum, r) => sum + r.engagement_rate, 0) / replies.length,
        sample_size: replies.length
      }))
      .filter(stat => stat.sample_size >= 3); // Need at least 3 samples
    
    hourStats.sort((a, b) => b.avg_engagement - a.avg_engagement);
    
    if (hourStats.length > 0) {
      const bestHour = hourStats[0];
      insights.push({
        insight_type: 'timing',
        key: 'best_hour',
        value: `Hour ${bestHour.hour} (${this.formatHour(bestHour.hour)}) has ${(bestHour.avg_engagement * 100).toFixed(1)}% engagement rate`,
        confidence: this.calculateConfidence(bestHour.sample_size),
        sample_size: bestHour.sample_size,
        discovered_at: new Date().toISOString()
      });
    }
    
    console.log(`[REPLY_LEARNING] ⏰ Timing insights: ${insights.length}`);
    return insights;
  }

  /**
   * Learn which target accounts work best
   */
  private async learnTargetPerformance(data: ReplyPerformance[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Group by target
    const byTarget = new Map<string, ReplyPerformance[]>();
    for (const reply of data) {
      const target = reply.target_username;
      if (!byTarget.has(target)) {
        byTarget.set(target, []);
      }
      byTarget.get(target)!.push(reply);
    }
    
    // Find best targets
    const targetStats = Array.from(byTarget.entries())
      .map(([target, replies]) => ({
        target,
        avg_follows: replies.reduce((sum, r) => sum + r.follows_gained, 0) / replies.length,
        total_follows: replies.reduce((sum, r) => sum + r.follows_gained, 0),
        sample_size: replies.length
      }))
      .filter(stat => stat.sample_size >= 2); // Need at least 2 samples
    
    targetStats.sort((a, b) => b.avg_follows - a.avg_follows);
    
    // Top 3 targets
    for (let i = 0; i < Math.min(3, targetStats.length); i++) {
      const target = targetStats[i];
      insights.push({
        insight_type: 'target',
        key: `top_target_${i + 1}`,
        value: `@${target.target} drives ${target.avg_follows.toFixed(2)} follows/reply (${target.total_follows} total)`,
        confidence: this.calculateConfidence(target.sample_size),
        sample_size: target.sample_size,
        discovered_at: new Date().toISOString()
      });
    }
    
    console.log(`[REPLY_LEARNING] 🎯 Target insights: ${insights.length}`);
    return insights;
  }

  /**
   * Learn which topics drive follows
   */
  private async learnTopicPerformance(data: ReplyPerformance[]): Promise<LearningInsight[]> {
    // PLACEHOLDER: Would need topic classification on replies
    // For now, return empty
    console.log(`[REPLY_LEARNING] 📝 Topic insights: 0 (needs implementation)`);
    return [];
  }

  /**
   * Calculate confidence score based on sample size
   */
  private calculateConfidence(sampleSize: number): number {
    if (sampleSize >= 50) return 0.95;
    if (sampleSize >= 30) return 0.90;
    if (sampleSize >= 20) return 0.85;
    if (sampleSize >= 10) return 0.75;
    if (sampleSize >= 5) return 0.60;
    return 0.40;
  }

  /**
   * Format hour for display
   */
  private formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}${period}`;
  }

  /**
   * Store insights in database
   */
  private async storeInsights(insights: LearningInsight[]): Promise<void> {
    if (insights.length === 0) return;
    
    const supabase = getSupabaseClient();
    
    for (const insight of insights) {
      await supabase
        .from('reply_learning_insights')
        .upsert({
          insight_type: insight.insight_type,
          key: insight.key,
          value: insight.value,
          confidence: insight.confidence,
          sample_size: insight.sample_size,
          discovered_at: insight.discovered_at,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'insight_type,key'
        });
    }
    
    console.log(`[REPLY_LEARNING] 💾 Stored ${insights.length} insights`);
  }

  /**
   * Generate actionable recommendations
   */
  private async generateRecommendations(insights: LearningInsight[]): Promise<void> {
    console.log('[REPLY_LEARNING] 💡 Generating recommendations...');
    
    const recommendations: string[] = [];
    
    // Extract recommendations from insights
    for (const insight of insights) {
      if (insight.confidence >= 0.75) {
        if (insight.insight_type === 'generator' && insight.key === 'best_performer') {
          recommendations.push(`Use ${insight.value.split(' ')[0]} generator more often`);
        }
        if (insight.insight_type === 'timing' && insight.key === 'best_hour') {
          const hour = insight.value.match(/Hour (\d+)/)?.[1];
          recommendations.push(`Prioritize replies during hour ${hour}`);
        }
        if (insight.insight_type === 'target') {
          const username = insight.value.match(/@(\w+)/)?.[1];
          recommendations.push(`Target @${username} more frequently`);
        }
      }
    }
    
    console.log(`[REPLY_LEARNING] 📋 Generated ${recommendations.length} recommendations`);
    recommendations.forEach(rec => console.log(`  • ${rec}`));
  }

  /**
   * Get best performing generator
   */
  async getBestGenerator(): Promise<string> {
    const supabase = getSupabaseClient();
    
    const { data: insight } = await supabase
      .from('reply_learning_insights')
      .select('value')
      .eq('insight_type', 'generator')
      .eq('key', 'best_performer')
      .gte('confidence', 0.70)
      .single();
    
    if (insight && insight.value) {
      const generator = String(insight.value).split(' ')[0];
      return generator;
    }
    
    return 'data_nerd'; // Default
  }

  /**
   * Get best posting hours
   */
  async getBestHours(): Promise<number[]> {
    const supabase = getSupabaseClient();
    
    const { data: insights } = await supabase
      .from('reply_learning_insights')
      .select('value')
      .eq('insight_type', 'timing')
      .gte('confidence', 0.70);
    
    const hours: number[] = [];
    
    if (insights) {
      for (const insight of insights) {
        const value = String(insight.value || '');
        const match = value.match(/Hour (\d+)/);
        if (match) {
          hours.push(parseInt(match[1]));
        }
      }
    }
    
    return hours.length > 0 ? hours : [7, 8, 18, 19]; // Default best hours
  }
}

// Singleton export
export const replyLearningSystem = ReplyLearningSystem.getInstance();


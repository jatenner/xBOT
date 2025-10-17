/**
 * 🎣 HOOK ANALYSIS SERVICE
 * 
 * Analyzes hook performance patterns to optimize future content
 * Pure addition - learns from existing outcomes data
 */

import { getSupabaseClient } from '../db';

export interface HookPerformance {
  hook_text: string;
  hook_type: string;
  followers_gained: number;
  engagement_score: number;
  impressions: number;
}

export class HookAnalysisService {
  private static instance: HookAnalysisService;
  
  private constructor() {}
  
  static getInstance(): HookAnalysisService {
    if (!HookAnalysisService.instance) {
      HookAnalysisService.instance = new HookAnalysisService();
    }
    return HookAnalysisService.instance;
  }

  /**
   * Extract first 7 words (the hook)
   */
  extractHook(content: string): string {
    const text = Array.isArray(content) ? content[0] : content;
    const words = text.split(' ').slice(0, 7).join(' ');
    return words.trim();
  }

  /**
   * Classify hook type based on pattern
   */
  classifyHookType(hook: string): string {
    const lower = hook.toLowerCase();
    
    // Percentage first
    if (/^\d+%/.test(hook)) return 'percentage_first';
    
    // Number first
    if (/^\d+/.test(hook)) return 'number_first';
    
    // Question
    if (/^(why|what|how|when|where|who|which)/i.test(lower)) return 'question';
    
    // Direct address
    if (/^(you're|you are|your|you\s)/i.test(lower)) return 'direct_address';
    
    // Negative command
    if (/^(never|stop|don't|avoid|quit)/i.test(lower)) return 'negative_command';
    
    // Urgency
    if (/^(breaking|just in|new|urgent|alert)/i.test(lower)) return 'urgency';
    
    // Contrarian
    if (/wrong|lie|myth|fake|don't believe/i.test(lower)) return 'contrarian';
    
    return 'statement';
  }

  /**
   * Store hook performance after analytics
   */
  async storeHookPerformance(outcome: any): Promise<void> {
    if (!outcome.hook_text) return;
    
    try {
      const supabase = getSupabaseClient();
      
      await supabase
        .from('hook_performance')
        .insert({
          hook_text: outcome.hook_text,
          hook_type: outcome.hook_type,
          generator_used: outcome.generator_used,
          topic_cluster: outcome.topic_cluster,
          post_hour: outcome.post_hour,
          followers_gained: outcome.followers_gained || 0,
          engagement_score: (outcome.likes || 0) + (outcome.retweets || 0) * 2,
          impressions: outcome.impressions || 0,
          posted_at: outcome.created_at
        });
      
      console.log(`[HOOK_ANALYSIS] ✅ Stored hook performance: "${outcome.hook_text.substring(0, 30)}..."`);
      
    } catch (error: any) {
      console.warn('[HOOK_ANALYSIS] ⚠️ Failed to store hook performance:', error.message);
    }
  }

  /**
   * Get top performing hooks
   */
  async getTopPerformingHooks(limit: number = 10): Promise<HookPerformance[]> {
    const supabase = getSupabaseClient();
    
    const { data } = await supabase
      .from('outcomes')
      .select('hook_text, hook_type, followers_gained, likes, retweets, impressions')
      .not('hook_text', 'is', null)
      .gte('followers_gained', 1)
      .order('followers_gained', { ascending: false })
      .limit(limit);
    
    return (data || []).map(d => ({
      hook_text: d.hook_text,
      hook_type: d.hook_type || this.classifyHookType(d.hook_text),
      followers_gained: d.followers_gained || 0,
      engagement_score: (d.likes || 0) + (d.retweets || 0) * 2,
      impressions: d.impressions || 0
    }));
  }

  /**
   * Get hook type performance statistics
   */
  async getHookTypePerformance(): Promise<Record<string, {
    count: number;
    avgFollowers: number;
    avgEngagement: number;
    avgImpressions: number;
  }>> {
    const supabase = getSupabaseClient();
    
    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('hook_text, hook_type, followers_gained, likes, retweets, impressions')
      .not('hook_text', 'is', null);
    
    const performance: Record<string, {
      count: number;
      avgFollowers: number;
      avgEngagement: number;
      avgImpressions: number;
    }> = {};
    
    for (const outcome of outcomes || []) {
      const hookType = outcome.hook_type || this.classifyHookType(outcome.hook_text);
      
      if (!performance[hookType]) {
        performance[hookType] = { 
          count: 0, 
          avgFollowers: 0, 
          avgEngagement: 0,
          avgImpressions: 0
        };
      }
      
      performance[hookType].count++;
      performance[hookType].avgFollowers += outcome.followers_gained || 0;
      performance[hookType].avgEngagement += (outcome.likes || 0) + (outcome.retweets || 0) * 2;
      performance[hookType].avgImpressions += outcome.impressions || 0;
    }
    
    // Calculate averages
    for (const type in performance) {
      const p = performance[type];
      if (p.count > 0) {
        p.avgFollowers = p.avgFollowers / p.count;
        p.avgEngagement = p.avgEngagement / p.count;
        p.avgImpressions = Math.round(p.avgImpressions / p.count);
      }
    }
    
    return performance;
  }

  /**
   * Get best hook type for topic/generator combo
   */
  async getBestHookTypeFor(params: {
    topic?: string;
    generator?: string;
  }): Promise<string> {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('outcomes')
      .select('hook_type, followers_gained')
      .not('hook_type', 'is', null);
    
    if (params.topic) {
      query = query.eq('topic_cluster', params.topic);
    }
    
    if (params.generator) {
      query = query.eq('generator_used', params.generator);
    }
    
    const { data } = await query.gte('followers_gained', 0);
    
    if (!data || data.length === 0) {
      return 'question'; // Default
    }
    
    // Group by hook type and calculate average followers
    const typePerformance: Record<string, { count: number; totalFollowers: number }> = {};
    
    for (const outcome of data) {
      const type = outcome.hook_type;
      if (!typePerformance[type]) {
        typePerformance[type] = { count: 0, totalFollowers: 0 };
      }
      typePerformance[type].count++;
      typePerformance[type].totalFollowers += outcome.followers_gained || 0;
    }
    
    // Find best performing type
    let bestType = 'question';
    let bestAvg = 0;
    
    for (const [type, perf] of Object.entries(typePerformance)) {
      const avg = perf.totalFollowers / perf.count;
      if (avg > bestAvg && perf.count >= 3) { // Need at least 3 samples
        bestAvg = avg;
        bestType = type;
      }
    }
    
    return bestType;
  }
}

export const hookAnalysisService = HookAnalysisService.getInstance();


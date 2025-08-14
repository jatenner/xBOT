/**
 * SIMPLIFIED GROWTH ENGINE INTEGRATION
 * 
 * A simplified version that works with existing xBOT infrastructure
 * Uses mock data for testing and basic integration points
 */

import { HumanGradeGrowthEngine, GrowthEngineInput, GrowthEngineOutput } from './humanGradeGrowthEngine';
import { LongformDetector } from '../utils/longformDetector';

export interface MockEngagementMetrics {
  epm_current: number;
  epm_ewma: number;
  format_bandit: {
    single: number;
    thread: number;
    reply: number;
    quote: number;
    longform_single: number;
  };
  persona_hook_bandit: {
    "Scientist/myth_bust": number;
    "Coach/how_to": number;
    "Storyteller/story": number;
    "Curator/checklist": number;
    "Mythbuster/checklist": number;
  };
}

export class GrowthEngineIntegrationSimple {
  private static instance: GrowthEngineIntegrationSimple;
  private growthEngine: HumanGradeGrowthEngine;
  private longformDetector: LongformDetector;

  private constructor() {
    this.growthEngine = HumanGradeGrowthEngine.getInstance();
    this.longformDetector = LongformDetector.getInstance();
  }

  public static getInstance(): GrowthEngineIntegrationSimple {
    if (!GrowthEngineIntegrationSimple.instance) {
      GrowthEngineIntegrationSimple.instance = new GrowthEngineIntegrationSimple();
    }
    return GrowthEngineIntegrationSimple.instance;
  }

  /**
   * Execute growth engine with mock data for testing
   */
  public async testGrowthEngine(): Promise<GrowthEngineOutput> {
    try {
      console.log('🧪 Testing Human-Grade Growth Engine with mock data...');
      
      const mockInput = this.createMockInput();
      const output = await this.growthEngine.processGrowthDecision(mockInput);
      
      console.log('📊 Growth Engine Results:');
      console.log('- Post now:', output.post_now);
      console.log('- Reason:', output.reason);
      console.log('- Format:', output.decision.format);
      console.log('- Topic:', output.decision.topic);
      console.log('- Pillar:', output.decision.pillar);
      console.log('- Persona:', output.decision.persona);
      console.log('- Human vibe score:', output.qc.human_vibe_score);
      
      if (output.draft.tweets.length > 0) {
        console.log('- Content preview:', output.draft.tweets[0].text.substring(0, 100) + '...');
      }
      
      return output;
      
    } catch (error) {
      console.error('❌ Growth engine test failed:', error);
      throw error;
    }
  }

  /**
   * Create mock input data for testing
   */
  private createMockInput(): GrowthEngineInput {
    return {
      now_local: new Date().toISOString(),
      caps: { 
        max_day: 100, 
        max_hour: 8, 
        min_gap: 6, 
        min_gap_same: 20, 
        thread_cooldown: 15, 
        min_posts_per_2h: 1 
      },
      recent_counts: { 
        hour: 0, 
        day: 3, 
        last_post_min_ago: 137, 
        last_format: "single", 
        since_last_2h: 0 
      },
      followers: 17,
      metrics: {
        epm_current: 0.9,
        epm_ewma: 0.6,
        format_bandit: { 
          single: 0.25, 
          thread: 0.35, 
          reply: 0.15, 
          quote: 0.1, 
          longform_single: 0.15 
        },
        persona_hook_bandit: { 
          "Scientist/myth_bust": 0.22, 
          "Coach/how_to": 0.28, 
          "Storyteller/story": 0.18, 
          "Curator/checklist": 0.18, 
          "Mythbuster/checklist": 0.14 
        }
      },
      fatigue: { 
        format_streak: 1, 
        thread_cooldown_remaining: 0 
      },
      twitter_trends: [
        { phrase: "sleep debt", momentum: 0.72, tph: 180, category: "Sleep" },
        { phrase: "morning light exposure", momentum: 0.58, tph: 95, category: "Sleep" },
        { phrase: "vitamin D deficiency", momentum: 0.45, tph: 67, category: "Health" },
        { phrase: "stress eating", momentum: 0.38, tph: 43, category: "Other" },
        { phrase: "walking benefits", momentum: 0.33, tph: 28, category: "Fitness" }
      ],
      news_trends: [
        { phrase: "new sleep study", momentum: 0.6, source: "Harvard Health" },
        { phrase: "meditation apps", momentum: 0.4, source: "Health Tech News" }
      ],
      trend_policy: { 
        fit_min: 0.35, 
        prefer_twitter_over_news: true, 
        max_offtopic_ratio: 0.15, 
        blacklist: ["politics", "war", "nsfw", "celebrity_scandal"] 
      },
      recent_posts_text: [
        "Hydrate before caffeine for better energy",
        "Stress micro-breaks: 3 deep breaths every hour"
      ],
      limits: { 
        first_visible_chars: 240, 
        tweet_max_hard: 275, 
        longform_max_chars: 9000 
      },
      style: { 
        style_jitter: 0.25, 
        hedge_prob: 0.15, 
        question_prob: 0.25, 
        emoji_max: 1, 
        no_hashtags: true 
      },
      capabilities: { 
        longform_available: false, 
        replies_allowed: true, 
        quotes_allowed: true 
      },
      reply_context: { 
        gist: null, 
        author: null 
      }
    };
  }

  /**
   * Execute growth engine with custom input
   */
  public async executeWithInput(input: GrowthEngineInput): Promise<GrowthEngineOutput> {
    return await this.growthEngine.processGrowthDecision(input);
  }

  /**
   * Execute growth engine with simulated real data
   */
  public async executeGrowthCycle(): Promise<GrowthEngineOutput> {
    console.log('🚀 Starting simulated growth engine cycle...');
    
    // Create input with simulated real-time data
    const input = this.createSimulatedInput();
    const output = await this.growthEngine.processGrowthDecision(input);
    
    // Log the decision
    console.log(`📊 Growth Decision: ${output.post_now ? 'POST' : 'DEFER'} - ${output.reason}`);
    
    return output;
  }

  /**
   * Create simulated input with more realistic data
   */
  private createSimulatedInput(): GrowthEngineInput {
    const now = new Date();
    const hour = now.getHours();
    
    // Simulate different conditions based on time of day
    const isPeakTime = (hour >= 7 && hour <= 9) || (hour >= 12 && hour <= 13) || (hour >= 18 && hour <= 20);
    const baseEPM = isPeakTime ? 1.2 : 0.8;
    
    // Simulate recent activity
    const recentActivity = Math.random() * 5; // 0-5 posts recently
    const timeSinceLastPost = Math.floor(Math.random() * 180) + 30; // 30-210 minutes
    
    // Simulate trending topics based on health focus
    const healthTrends = [
      { phrase: "sleep optimization", momentum: 0.8, tph: 150, category: "Sleep" as const },
      { phrase: "gut health", momentum: 0.7, tph: 120, category: "Health" as const },
      { phrase: "intermittent fasting", momentum: 0.6, tph: 100, category: "Food" as const },
      { phrase: "cold therapy", momentum: 0.5, tph: 80, category: "Other" as const },
      { phrase: "mindfulness", momentum: 0.4, tph: 60, category: "Other" as const }
    ];

    return {
      now_local: now.toISOString(),
      caps: { 
        max_day: 25, 
        max_hour: 4, 
        min_gap: 30, 
        min_gap_same: 120, 
        thread_cooldown: 60, 
        min_posts_per_2h: 1 
      },
      recent_counts: { 
        hour: Math.floor(recentActivity), 
        day: Math.floor(recentActivity * 3), 
        last_post_min_ago: timeSinceLastPost, 
        last_format: Math.random() > 0.5 ? "single" : "thread", 
        since_last_2h: Math.floor(recentActivity / 2)
      },
      followers: 150 + Math.floor(Math.random() * 50), // 150-200 followers
      metrics: {
        epm_current: baseEPM + (Math.random() - 0.5) * 0.4,
        epm_ewma: baseEPM * 0.8,
        format_bandit: this.simulateBanditProbs(['single', 'thread', 'reply', 'quote', 'longform_single']),
        persona_hook_bandit: this.simulateBanditProbs([
          "Scientist/myth_bust", 
          "Coach/how_to", 
          "Storyteller/story", 
          "Curator/checklist", 
          "Mythbuster/checklist"
        ])
      },
      fatigue: { 
        format_streak: Math.floor(Math.random() * 3), 
        thread_cooldown_remaining: Math.random() > 0.8 ? Math.floor(Math.random() * 30) : 0
      },
      twitter_trends: healthTrends.slice(0, 3 + Math.floor(Math.random() * 3)),
      news_trends: [
        { phrase: "new health research", momentum: 0.5, source: "Medical Journal" },
        { phrase: "wellness trends", momentum: 0.3, source: "Health News" }
      ],
      trend_policy: { 
        fit_min: 0.35, 
        prefer_twitter_over_news: true, 
        max_offtopic_ratio: 0.15, 
        blacklist: ["politics", "war", "nsfw", "celebrity_scandal"] 
      },
      recent_posts_text: [
        "Morning sunlight exposure helps regulate circadian rhythms",
        "Protein timing matters more than total amount for muscle synthesis",
        "Deep breathing activates parasympathetic nervous system"
      ],
      limits: { 
        first_visible_chars: 240, 
        tweet_max_hard: 275, 
        longform_max_chars: 9000 
      },
      style: { 
        style_jitter: 0.25, 
        hedge_prob: 0.15, 
        question_prob: 0.25, 
        emoji_max: 1, 
        no_hashtags: true 
      },
      capabilities: { 
        longform_available: Math.random() > 0.7, // 30% chance of Twitter Blue
        replies_allowed: true, 
        quotes_allowed: true 
      },
      reply_context: { 
        gist: null, 
        author: null 
      }
    };
  }

  /**
   * Simulate bandit probabilities with some randomness
   */
  private simulateBanditProbs(arms: string[]): any {
    const result: any = {};
    let total = 0;
    
    // Generate random weights
    const weights = arms.map(() => Math.random() + 0.1);
    total = weights.reduce((sum, w) => sum + w, 0);
    
    // Normalize to probabilities
    arms.forEach((arm, i) => {
      result[arm] = weights[i] / total;
    });
    
    return result;
  }

  /**
   * Get current system status for monitoring
   */
  public getSystemStatus(): any {
    return {
      growthEngine: 'ready',
      longformDetector: 'ready',
      lastTest: new Date().toISOString(),
      version: '1.0.0'
    };
  }
}

/**
 * Convenience function for quick testing
 */
export async function testGrowthEngineSimple(): Promise<GrowthEngineOutput> {
  const integration = GrowthEngineIntegrationSimple.getInstance();
  return await integration.testGrowthEngine();
}

/**
 * Execute simulated growth cycle
 */
export async function executeSimulatedGrowthCycle(): Promise<GrowthEngineOutput> {
  const integration = GrowthEngineIntegrationSimple.getInstance();
  return await integration.executeGrowthCycle();
}
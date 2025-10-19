/**
 * 🎯 AI TARGET FINDER ENGINE
 * 
 * AI discovers optimal accounts to engage with (not hardcoded list!)
 * 
 * Budget-Conscious:
 * - Runs once per week (not constantly)
 * - Uses pattern analysis (not AI for every account)
 * - One AI call to analyze top performers
 * - Cost: ~$0.05/week
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db/index';

export interface AIDiscoveredTarget {
  username: string;
  handle: string;
  followers: number;
  estimated_engagement: number;
  topic_overlap: string[];
  why_target: string;
  reply_strategy: string;
  conversion_potential: number; // 0-1
  priority: 'high' | 'medium' | 'low';
  discovered_at: string;
}

export class TargetFinderEngine {
  private static instance: TargetFinderEngine;
  private supabase = getSupabaseClient();
  private cachedTargets: AIDiscoveredTarget[] | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_TTL_MS = 604800 * 1000; // 7 days

  private constructor() {}

  public static getInstance(): TargetFinderEngine {
    if (!TargetFinderEngine.instance) {
      TargetFinderEngine.instance = new TargetFinderEngine();
    }
    return TargetFinderEngine.instance;
  }

  /**
   * Discover new target accounts using AI
   * Runs weekly to save budget
   */
  async discoverTargets(forceRefresh: boolean = false): Promise<AIDiscoveredTarget[]> {
    console.log('[AI_TARGETS] 🎯 Starting target discovery...');

    // Check cache first
    if (!forceRefresh) {
      const cached = await this.getCachedTargets();
      if (cached && cached.length > 0) {
        console.log(`[AI_TARGETS] ✅ Using cached targets (${cached.length} accounts)`);
        return cached;
      }
    }

    try {
      // STEP 1: Analyze existing reply performance
      const replyPerformance = await this.analyzeReplyPerformance();

      // STEP 2: AI suggests new targets based on patterns
      const newTargets = await this.generateTargetsWithAI(replyPerformance);

      // STEP 3: Cache results
      await this.cacheTargets(newTargets);

      // STEP 4: Store in database
      await this.storeTargets(newTargets);

      console.log(`[AI_TARGETS] ✅ Discovered ${newTargets.length} new targets!`);

      return newTargets;

    } catch (error: any) {
      console.error('[AI_TARGETS] ❌ Error:', error.message);
      return this.getDefaultTargets();
    }
  }

  /**
   * Analyze which accounts convert best
   */
  private async analyzeReplyPerformance(): Promise<any> {
    const { data: replies } = await this.supabase
      .from('posted_decisions')
      .select('*')
      .eq('decision_type', 'reply')
      .order('posted_at', { ascending: false })
      .limit(100);

    if (!replies || replies.length === 0) {
      return { top_performers: [], patterns: [] };
    }

    // Group by target account
    const byAccount: Record<string, any> = {};
    
    replies.forEach((r: any) => {
      const target = r.generation_metadata?.target_account || 'unknown';
      if (!byAccount[target]) {
        byAccount[target] = {
          account: target,
          replies: 0,
          total_engagement: 0,
          total_followers: 0,
          conversion_rate: 0
        };
      }
      byAccount[target].replies++;
      byAccount[target].total_engagement += (r.actual_performance?.likes || 0);
      byAccount[target].total_followers += (r.actual_performance?.followers_gained || 0);
    });

    // Calculate conversion rates
    const performers = Object.values(byAccount)
      .map(a => ({
        ...a,
        conversion_rate: a.replies > 0 ? (a.total_followers / a.replies) : 0
      }))
      .sort((a, b) => b.conversion_rate - a.conversion_rate)
      .slice(0, 5);

    return {
      top_performers: performers,
      total_replies: replies.length
    };
  }

  /**
   * AI generates new target suggestions
   * BUDGET-CONSCIOUS: Single API call
   */
  private async generateTargetsWithAI(performance: any): Promise<AIDiscoveredTarget[]> {
    console.log('[AI_TARGETS] 💰 Making single AI call...');

    const prompt = `You are a Twitter growth expert specializing in health/wellness.

TASK: Suggest 10 health/wellness Twitter accounts to engage with for follower growth.

CURRENT PERFORMANCE:
${performance.top_performers.length > 0 
  ? performance.top_performers.map((p: any) => 
      `- @${p.account}: ${p.replies} replies, ${p.total_followers} followers gained (${p.conversion_rate.toFixed(1)} per reply)`
    ).join('\n')
  : 'No data yet - suggest diverse starting targets'}

CRITERIA:
1. Health, wellness, fitness, nutrition, biohacking, longevity niche
2. 10k-500k followers (accessible but high-reach)
3. Active (posts daily)
4. Gets 50-500 replies per post (engagement opportunity)
5. Audience overlap with health-conscious individuals
6. Various sub-niches (not all the same topic)

INCLUDE:
- Rising accounts (not just established ones)
- Accounts similar to top performers
- Diverse perspectives (research, personal, coaching, etc)

Return JSON:
{
  "targets": [
    {
      "username": "account name",
      "handle": "@handle",
      "estimated_followers": 50000,
      "topic_overlap": ["sleep", "nutrition"],
      "why_target": "Why engage with this account",
      "reply_strategy": "How to add value in replies",
      "conversion_potential": 0.8,
      "priority": "high"
    }
  ]
}`;

    const completion = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'target_discovery_analysis'
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No AI response');
    }

    const parsed = JSON.parse(content);

    const targets: AIDiscoveredTarget[] = (parsed.targets || []).map((t: any) => ({
      username: t.username || 'Unknown',
      handle: t.handle || '@unknown',
      followers: t.estimated_followers || 50000,
      estimated_engagement: Math.floor((t.estimated_followers || 50000) * 0.01),
      topic_overlap: t.topic_overlap || [],
      why_target: t.why_target || '',
      reply_strategy: t.reply_strategy || 'Add value with insights',
      conversion_potential: t.conversion_potential || 0.5,
      priority: t.priority || 'medium',
      discovered_at: new Date().toISOString()
    }));

    return targets;
  }

  /**
   * Cache targets in memory
   */
  private async cacheTargets(targets: AIDiscoveredTarget[]): Promise<void> {
    this.cachedTargets = targets;
    this.cacheTimestamp = Date.now();
    console.log('[AI_TARGETS] 💾 Cached targets for 7 days');
  }

  /**
   * Get cached targets
   */
  private async getCachedTargets(): Promise<AIDiscoveredTarget[] | null> {
    if (this.cachedTargets && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL_MS) {
      return this.cachedTargets;
    }
    return null;
  }

  /**
   * Store targets in database
   */
  private async storeTargets(targets: AIDiscoveredTarget[]): Promise<void> {
    try {
      for (const target of targets) {
        await this.supabase
          .from('ai_discovered_targets')
          .upsert({
            handle: target.handle,
            username: target.username,
            followers: target.followers,
            topic_overlap: target.topic_overlap,
            why_target: target.why_target,
            reply_strategy: target.reply_strategy,
            conversion_potential: target.conversion_potential,
            priority: target.priority,
            discovered_at: target.discovered_at
          }, {
            onConflict: 'handle'
          });
      }
    } catch (error) {
      // Non-critical
    }
  }

  /**
   * Default targets when no AI available
   */
  private getDefaultTargets(): AIDiscoveredTarget[] {
    return [
      {
        username: 'Andrew Huberman',
        handle: '@hubermanlab',
        followers: 500000,
        estimated_engagement: 5000,
        topic_overlap: ['sleep', 'neuroscience', 'optimization'],
        why_target: 'Massive reach, health-focused audience',
        reply_strategy: 'Add research-based insights',
        conversion_potential: 0.7,
        priority: 'high',
        discovered_at: new Date().toISOString()
      },
      {
        username: 'Peter Attia',
        handle: '@peterattiamd',
        followers: 400000,
        estimated_engagement: 4000,
        topic_overlap: ['longevity', 'health optimization'],
        why_target: 'High-quality audience interested in health',
        reply_strategy: 'Share data and studies',
        conversion_potential: 0.8,
        priority: 'high',
        discovered_at: new Date().toISOString()
      }
    ];
  }

  /**
   * Get top priority targets for today
   */
  async getTopTargets(count: number = 5): Promise<AIDiscoveredTarget[]> {
    const allTargets = await this.discoverTargets();
    return allTargets
      .filter(t => t.priority === 'high')
      .slice(0, count);
  }
}

export const getTargetFinderEngine = () => TargetFinderEngine.getInstance();


/**
 * Adaptive Content Planning System for @SignalAndSynapse
 * Data-driven topic and format selection based on performance analytics
 */

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import OpenAI from 'openai';

interface ContentPlan {
  format: 'short' | 'medium' | 'thread';
  topic: string;
  hook_type: string;
  priority_score: number;
  reasoning: string;
  planned_time?: Date;
}

interface PlanningStrategy {
  proven_patterns: any[]; // 50% - What works for us
  peer_insights: any[]; // 30% - What works for others
  experiments: any[]; // 20% - New patterns to test
}

export class AdaptiveContentPlanner {
  private supabase: any;
  private redis: Redis;
  private openai: OpenAI;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
  }

  /**
   * Generate adaptive content plan for the next week
   */
  async generateWeeklyPlan(postsPerDay: number = 3): Promise<ContentPlan[]> {
    console.log('📅 Generating adaptive weekly content plan...');

    // Get current strategy insights
    const strategy = await this.buildPlanningStrategy();
    
    // Generate daily plans
    const weeklyPlan: ContentPlan[] = [];
    
    for (let day = 0; day < 7; day++) {
      const dailyPlans = await this.generateDailyPlan(postsPerDay, strategy, day);
      weeklyPlan.push(...dailyPlans);
    }

    // Store plan in database for tracking
    await this.storePlanningDecisions(weeklyPlan);

    console.log(`✅ Generated ${weeklyPlan.length} content plans for the week`);
    return weeklyPlan;
  }

  /**
   * Build data-driven planning strategy
   */
  private async buildPlanningStrategy(): Promise<PlanningStrategy> {
    // Get latest recommendations
    const { data: recommendations } = await this.supabase
      .from('recommendations')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1);

    const latestRec = recommendations?.[0];

    // Get top-performing patterns from our own content
    const { data: ownPatterns } = await this.supabase
      .from('posts')
      .select('format, topic, hook_type, engagement_rate, performance_tier')
      .eq('performance_tier', 'top')
      .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('engagement_rate', { ascending: false })
      .limit(20);

    // Get high-performing peer patterns
    const { data: peerPatterns } = await this.supabase
      .from('peer_posts')
      .select('format, topic, hook_type, normalized_engagement, account_handle')
      .gte('normalized_engagement', 2.0)
      .order('normalized_engagement', { ascending: false })
      .limit(15);

    // Get patterns to experiment with
    const { data: experimentPatterns } = await this.supabase
      .from('patterns')
      .select('*')
      .eq('status', 'testing')
      .gte('confidence_score', 0.6)
      .order('confidence_score', { ascending: false })
      .limit(10);

    return {
      proven_patterns: ownPatterns || [],
      peer_insights: peerPatterns || [],
      experiments: experimentPatterns || []
    };
  }

  /**
   * Generate plan for a single day
   */
  private async generateDailyPlan(
    postsCount: number, 
    strategy: PlanningStrategy, 
    dayOffset: number
  ): Promise<ContentPlan[]> {
    
    const plans: ContentPlan[] = [];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);

    // Calculate post distribution based on strategy
    const distribution = this.calculatePostDistribution(postsCount);

    let assignedPosts = 0;

    // 50% proven patterns (what works for us)
    for (let i = 0; i < distribution.proven && assignedPosts < postsCount; i++) {
      const plan = await this.createPlanFromProvenPattern(strategy.proven_patterns, targetDate, i);
      if (plan) {
        plans.push(plan);
        assignedPosts++;
      }
    }

    // 30% peer insights (what works for others)
    for (let i = 0; i < distribution.peer && assignedPosts < postsCount; i++) {
      const plan = await this.createPlanFromPeerInsight(strategy.peer_insights, targetDate, assignedPosts);
      if (plan) {
        plans.push(plan);
        assignedPosts++;
      }
    }

    // 20% experiments (new patterns to test)
    for (let i = 0; i < distribution.experiment && assignedPosts < postsCount; i++) {
      const plan = await this.createPlanFromExperiment(strategy.experiments, targetDate, assignedPosts);
      if (plan) {
        plans.push(plan);
        assignedPosts++;
      }
    }

    // Fill remaining slots with proven patterns
    while (assignedPosts < postsCount && strategy.proven_patterns.length > 0) {
      const plan = await this.createPlanFromProvenPattern(strategy.proven_patterns, targetDate, assignedPosts);
      if (plan) {
        plans.push(plan);
        assignedPosts++;
      } else {
        break;
      }
    }

    return plans;
  }

  /**
   * Calculate distribution of post types
   */
  private calculatePostDistribution(total: number): {
    proven: number;
    peer: number;
    experiment: number;
  } {
    const proven = Math.ceil(total * 0.5);
    const peer = Math.ceil(total * 0.3);
    const experiment = Math.max(1, total - proven - peer); // At least 1 experiment

    return { proven, peer, experiment };
  }

  /**
   * Create plan from proven pattern (our successful content)
   */
  private async createPlanFromProvenPattern(
    patterns: any[], 
    targetDate: Date, 
    slotIndex: number
  ): Promise<ContentPlan | null> {
    
    if (!patterns.length) return null;

    // Weight selection by engagement rate
    const weightedPattern = this.selectWeightedRandom(
      patterns, 
      (p: any) => p.engagement_rate || 0.01
    );

    if (!weightedPattern) return null;

    // Get posting time based on optimal windows
    const plannedTime = await this.getOptimalPostingTime(targetDate, slotIndex);

    return {
      format: weightedPattern.format,
      topic: weightedPattern.topic || 'general_health',
      hook_type: weightedPattern.hook_type || 'general',
      priority_score: 0.8 + (weightedPattern.engagement_rate || 0) * 0.2,
      reasoning: `Proven pattern: ${weightedPattern.format} about ${weightedPattern.topic} performed well (${(weightedPattern.engagement_rate * 100).toFixed(1)}% engagement)`,
      planned_time: plannedTime
    };
  }

  /**
   * Create plan from peer insight
   */
  private async createPlanFromPeerInsight(
    insights: any[], 
    targetDate: Date, 
    slotIndex: number
  ): Promise<ContentPlan | null> {
    
    if (!insights.length) return null;

    const weightedInsight = this.selectWeightedRandom(
      insights,
      (p: any) => p.normalized_engagement || 0.01
    );

    if (!weightedInsight) return null;

    const plannedTime = await this.getOptimalPostingTime(targetDate, slotIndex);

    return {
      format: weightedInsight.format,
      topic: weightedInsight.topic || 'general_health',
      hook_type: weightedInsight.hook_type || 'general',
      priority_score: 0.7 + (weightedInsight.normalized_engagement / 10) * 0.2,
      reasoning: `Peer insight: @${weightedInsight.account_handle}'s ${weightedInsight.format} about ${weightedInsight.topic} had ${weightedInsight.normalized_engagement.toFixed(1)} normalized engagement`,
      planned_time: plannedTime
    };
  }

  /**
   * Create experimental plan
   */
  private async createPlanFromExperiment(
    experiments: any[], 
    targetDate: Date, 
    slotIndex: number
  ): Promise<ContentPlan | null> {
    
    if (!experiments.length) {
      // Generate novel experiment using AI
      return await this.generateNovelExperiment(targetDate, slotIndex);
    }

    const experiment = experiments[Math.floor(Math.random() * experiments.length)];
    const plannedTime = await this.getOptimalPostingTime(targetDate, slotIndex);

    // Translate pattern to concrete plan
    const format = this.inferFormatFromPattern(experiment);
    const topic = await this.generateExperimentalTopic();
    const hookType = experiment.pattern_type === 'hook' ? experiment.pattern_name : 'experimental';

    return {
      format,
      topic,
      hook_type: hookType,
      priority_score: 0.5 + experiment.confidence_score * 0.3,
      reasoning: `Experiment: Testing ${experiment.pattern_name} - ${experiment.pattern_description}`,
      planned_time: plannedTime
    };
  }

  /**
   * Generate completely novel experiment using AI
   */
  private async generateNovelExperiment(targetDate: Date, slotIndex: number): Promise<ContentPlan | null> {
    try {
      const prompt = `Generate a novel content experiment for a health Twitter account.

Current successful patterns we should avoid repeating:
- Contrarian statistics
- Myth busting
- Question hooks

Suggest something creative but data-backed that could drive engagement:

Format: JSON
{
  "format": "short|medium|thread",
  "topic": "specific_health_topic",
  "hook_type": "creative_hook_name",
  "reasoning": "why this might work"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      });

      const experiment = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      if (experiment.format && experiment.topic) {
        const plannedTime = await this.getOptimalPostingTime(targetDate, slotIndex);
        
        return {
          format: experiment.format,
          topic: experiment.topic,
          hook_type: experiment.hook_type || 'experimental',
          priority_score: 0.6,
          reasoning: `AI Experiment: ${experiment.reasoning}`,
          planned_time: plannedTime
        };
      }
    } catch (error) {
      console.error('Failed to generate novel experiment:', error);
    }

    return null;
  }

  /**
   * Get optimal posting time based on historical data
   */
  private async getOptimalPostingTime(targetDate: Date, slotIndex: number): Promise<Date> {
    // Get historical best performing times
    const { data: optimalWindows } = await this.supabase
      .from('posts')
      .select('posted_at, engagement_rate')
      .eq('performance_tier', 'top')
      .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Default posting times if no data
    const defaultTimes = [9, 13, 18]; // 9am, 1pm, 6pm
    
    if (!optimalWindows?.length) {
      const hour = defaultTimes[slotIndex % defaultTimes.length];
      const postTime = new Date(targetDate);
      postTime.setHours(hour, 0, 0, 0);
      return postTime;
    }

    // Analyze hour distribution of top posts
    const hourPerformance: { [hour: number]: number[] } = {};
    
    for (const post of optimalWindows) {
      const hour = new Date(post.posted_at).getHours();
      if (!hourPerformance[hour]) hourPerformance[hour] = [];
      hourPerformance[hour].push(post.engagement_rate);
    }

    // Calculate average engagement by hour
    const hourAvgs = Object.entries(hourPerformance).map(([hour, rates]) => ({
      hour: parseInt(hour),
      avgEngagement: rates.reduce((sum, rate) => sum + rate, 0) / rates.length,
      count: rates.length
    }));

    // Sort by performance and pick diverse times
    hourAvgs.sort((a, b) => b.avgEngagement - a.avgEngagement);
    
    const selectedHour = hourAvgs[slotIndex % Math.min(3, hourAvgs.length)]?.hour || defaultTimes[slotIndex % defaultTimes.length];
    
    const postTime = new Date(targetDate);
    postTime.setHours(selectedHour, Math.floor(Math.random() * 30), 0, 0); // Add some randomness
    
    return postTime;
  }

  /**
   * Weighted random selection from array
   */
  private selectWeightedRandom<T>(items: T[], weightFn: (item: T) => number): T | null {
    if (!items.length) return null;

    const weights = items.map(weightFn);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    if (totalWeight === 0) return items[Math.floor(Math.random() * items.length)];

    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }

    return items[items.length - 1];
  }

  /**
   * Infer format from pattern type
   */
  private inferFormatFromPattern(pattern: any): 'short' | 'medium' | 'thread' {
    if (pattern.pattern_name?.includes('thread') || pattern.pattern_description?.includes('thread')) {
      return 'thread';
    }
    if (pattern.pattern_name?.includes('story') || pattern.pattern_description?.includes('detailed')) {
      return 'medium';
    }
    return 'short';
  }

  /**
   * Generate experimental topic using AI
   */
  private async generateExperimentalTopic(): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: 'Generate a specific, interesting health topic that would surprise people. Just 1-2 words:'
        }],
        temperature: 0.8,
        max_tokens: 10
      });

      return response.choices[0]?.message?.content?.trim() || 'experimental_health';
    } catch (error) {
      return 'experimental_health';
    }
  }

  /**
   * Store planning decisions for analysis
   */
  private async storePlanningDecisions(plans: ContentPlan[]): Promise<void> {
    try {
      const planningRecord = {
        generated_at: new Date().toISOString(),
        plan_count: plans.length,
        format_distribution: this.calculateFormatDistribution(plans),
        topic_distribution: this.calculateTopicDistribution(plans),
        strategy_breakdown: this.calculateStrategyBreakdown(plans),
        avg_priority_score: plans.reduce((sum, p) => sum + p.priority_score, 0) / plans.length
      };

      await this.supabase
        .from('planning_sessions')
        .insert(planningRecord);

      // Cache current plan in Redis
      await this.redis.setex('content:current_plan', 86400, JSON.stringify(plans));

    } catch (error) {
      console.error('Failed to store planning decisions:', error);
    }
  }

  /**
   * Calculate format distribution for analytics
   */
  private calculateFormatDistribution(plans: ContentPlan[]): any {
    const distribution: { [format: string]: number } = {};
    
    for (const plan of plans) {
      distribution[plan.format] = (distribution[plan.format] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Calculate topic distribution for analytics
   */
  private calculateTopicDistribution(plans: ContentPlan[]): any {
    const distribution: { [topic: string]: number } = {};
    
    for (const plan of plans) {
      distribution[plan.topic] = (distribution[plan.topic] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Calculate strategy breakdown for analytics
   */
  private calculateStrategyBreakdown(plans: ContentPlan[]): any {
    const breakdown = {
      proven: 0,
      peer_inspired: 0,
      experimental: 0
    };

    for (const plan of plans) {
      if (plan.reasoning.includes('Proven pattern')) {
        breakdown.proven++;
      } else if (plan.reasoning.includes('Peer insight')) {
        breakdown.peer_inspired++;
      } else {
        breakdown.experimental++;
      }
    }

    return breakdown;
  }

  /**
   * Get next planned content for posting
   */
  async getNextPlannedContent(): Promise<ContentPlan | null> {
    try {
      const cachedPlan = await this.redis.get('content:current_plan');
      
      if (cachedPlan) {
        const plans: ContentPlan[] = JSON.parse(cachedPlan);
        const now = new Date();
        
        // Find next scheduled content
        const upcoming = plans
          .filter(p => p.planned_time && new Date(p.planned_time) <= now)
          .sort((a, b) => new Date(a.planned_time!).getTime() - new Date(b.planned_time!).getTime());

        return upcoming[0] || null;
      }

      // Fallback: generate single plan
      const strategy = await this.buildPlanningStrategy();
      const dailyPlans = await this.generateDailyPlan(1, strategy, 0);
      
      return dailyPlans[0] || null;

    } catch (error) {
      console.error('Failed to get next planned content:', error);
      return null;
    }
  }

  /**
   * Mark plan as executed
   */
  async markPlanAsExecuted(plan: ContentPlan, tweetId: string): Promise<void> {
    try {
      // Log execution for analysis
      await this.supabase
        .from('plan_executions')
        .insert({
          format: plan.format,
          topic: plan.topic,
          hook_type: plan.hook_type,
          priority_score: plan.priority_score,
          reasoning: plan.reasoning,
          planned_time: plan.planned_time,
          executed_at: new Date().toISOString(),
          tweet_id: tweetId
        });

      // Update cached plan to remove executed item
      const cachedPlan = await this.redis.get('content:current_plan');
      if (cachedPlan) {
        const plans: ContentPlan[] = JSON.parse(cachedPlan);
        const updatedPlans = plans.filter(p => 
          !(p.format === plan.format && 
            p.topic === plan.topic && 
            p.planned_time === plan.planned_time)
        );
        
        await this.redis.setex('content:current_plan', 86400, JSON.stringify(updatedPlans));
      }

    } catch (error) {
      console.error('Failed to mark plan as executed:', error);
    }
  }
}

export default AdaptiveContentPlanner;

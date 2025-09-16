import { admin as supabase } from '../lib/supabaseClients';
import { kvGet, kvSet } from '../utils/kv';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';
// Note: Embedding functions would be imported when implemented
// import { getEmbedding, cosineDistance } from '../learning/embeddings';

export interface ReplyTarget {
  id: string;
  content: string;
  author_username: string;
  author_followers: number;
  tier: 'nano' | 'micro' | 'mid' | 'macro';
  topic_cluster: string;
  engagement_velocity: number;
  posted_at: Date;
  url: string;
  early_metrics?: {
    likes: number;
    reposts: number;
    replies: number;
    impressions?: number;
  };
}

export interface ReplyStrategy {
  target_id: string;
  opening_style: 'add_value' | 'polite_disagree_cite' | 'mini_checklist' | 'mini_case' | 'metric_insight';
  topic_cluster: string;
  tier: string;
  bandit_arm: string;
}

/**
 * 🎯 REPLY TARGETING V2
 * Discovers high-value reply targets with tiered clustering and velocity filtering
 */
export class TargetDiscovery {
  
  // Follower count thresholds for tiers
  private static tiers = {
    nano: { min: 0, max: 1000 },
    micro: { min: 1001, max: 10000 },
    mid: { min: 10001, max: 100000 },
    macro: { min: 100001, max: Infinity }
  };

  // Topic cluster mappings
  private static topicClusters = [
    'health_general', 'nutrition_science', 'fitness_training',
    'sleep_optimization', 'mental_health', 'disease_prevention',
    'wellness_lifestyle', 'medical_research', 'health_policy'
  ];

  // Reply opening styles
  private static openingStyles = [
    'add_value', 'polite_disagree_cite', 'mini_checklist', 
    'mini_case', 'metric_insight'
  ] as const;

  /**
   * Classify follower tier based on count
   */
  static classifyTier(followerCount: number): 'nano' | 'micro' | 'mid' | 'macro' {
    for (const [tier, range] of Object.entries(this.tiers)) {
      if (followerCount >= range.min && followerCount <= range.max) {
        return tier as any;
      }
    }
    return 'nano'; // Default fallback
  }

  /**
   * Assign topic cluster from tweet content using embeddings
   */
  static async assignTopicCluster(content: string): Promise<string> {
    try {
      // Get embedding for the content - simplified for now
      // const result = await getEmbedding(content);
      // const embedding = result.embedding;
      
      // For now, use simple keyword-based clustering
      // In production, would use pre-computed cluster centroids
      const contentLower = content.toLowerCase();
      
      if (contentLower.includes('nutrition') || contentLower.includes('diet') || contentLower.includes('food')) {
        return 'nutrition_science';
      } else if (contentLower.includes('fitness') || contentLower.includes('workout') || contentLower.includes('exercise')) {
        return 'fitness_training';
      } else if (contentLower.includes('sleep') || contentLower.includes('rest')) {
        return 'sleep_optimization';
      } else if (contentLower.includes('mental') || contentLower.includes('stress') || contentLower.includes('anxiety')) {
        return 'mental_health';
      } else if (contentLower.includes('disease') || contentLower.includes('prevent') || contentLower.includes('vaccine')) {
        return 'disease_prevention';
      } else {
        return 'health_general';
      }
      
    } catch (err: any) {
      warn(`TOPIC_CLUSTERING_ERROR: ${err.message}`);
      return 'health_general'; // Safe fallback
    }
  }

  /**
   * Calculate engagement velocity (engagement per minute since posting)
   */
  static calculateVelocity(target: ReplyTarget): number {
    if (!target.early_metrics || !target.posted_at) return 0;
    
    const minutesSincePosted = (Date.now() - target.posted_at.getTime()) / (1000 * 60);
    const totalEngagement = (target.early_metrics.likes || 0) + 
                           (target.early_metrics.reposts || 0) + 
                           (target.early_metrics.replies || 0);
    
    return totalEngagement / Math.max(1, minutesSincePosted);
  }

  /**
   * Check if target was already attempted (deduplication)
   */
  static async wasTargetAttempted(targetId: string): Promise<boolean> {
    try {
      const seenKey = `reply_target_seen:${targetId}`;
      const seen = await kvGet(seenKey);
      return seen !== null;
    } catch (err: any) {
      warn(`TARGET_DEDUP_ERROR: ${err.message}`);
      return false; // Err on side of allowing attempts
    }
  }

  /**
   * Mark target as attempted
   */
  static async markTargetAttempted(targetId: string): Promise<void> {
    try {
      const seenKey = `reply_target_seen:${targetId}`;
      await kvSet(seenKey, Date.now().toString(), 7 * 24 * 60 * 60); // 7-day TTL
    } catch (err: any) {
      warn(`TARGET_MARK_ERROR: ${err.message}`);
    }
  }

  /**
   * Discover reply targets from mock data (simulated discovery)
   */
  static async discoverTargets(maxTargets: number = 20): Promise<ReplyTarget[]> {
    try {
      log(`TARGET_DISCOVERY: Searching for up to ${maxTargets} targets`);
      
      // In production, this would call Twitter API or scrape feeds
      // For now, generate mock targets for testing
      const mockTargets: ReplyTarget[] = [];
      
      const sampleContent = [
        "Just read about intermittent fasting benefits. Anyone tried it?",
        "New study shows 8 hours of sleep improves cognitive function by 40%",
        "Why is everyone talking about Mediterranean diet lately?",
        "Struggling with stress management. What works for you?",
        "This workout routine changed my life completely",
        "Prevention is better than cure - especially for heart disease"
      ];
      
      const authors = [
        { username: 'healthfan123', followers: 850 },
        { username: 'fitnessguru', followers: 5200 },
        { username: 'wellness_coach', followers: 25000 },
        { username: 'dr_nutrition', followers: 150000 }
      ];
      
      for (let i = 0; i < Math.min(maxTargets, 6); i++) {
        const content = sampleContent[i % sampleContent.length];
        const author = authors[i % authors.length];
        
        const target: ReplyTarget = {
          id: `mock_target_${i}_${Date.now()}`,
          content,
          author_username: author.username,
          author_followers: author.followers,
          tier: this.classifyTier(author.followers),
          topic_cluster: await this.assignTopicCluster(content),
          engagement_velocity: Math.random() * 5, // Mock velocity
          posted_at: new Date(Date.now() - Math.random() * 60 * 60 * 1000), // Last hour
          url: `https://x.com/${author.username}/status/mock_${i}`,
          early_metrics: {
            likes: Math.floor(Math.random() * 20),
            reposts: Math.floor(Math.random() * 5),
            replies: Math.floor(Math.random() * 8)
          }
        };
        
        // Check if already attempted
        if (!(await this.wasTargetAttempted(target.id))) {
          mockTargets.push(target);
        }
      }
      
      // Filter for high velocity (early engagement)
      const highVelocityTargets = mockTargets.filter(target => {
        const velocity = this.calculateVelocity(target);
        return velocity > 0.5; // At least 0.5 engagements per minute
      });
      
      log(`TARGET_DISCOVERY_COMPLETE: Found ${highVelocityTargets.length}/${mockTargets.length} high-velocity targets`);
      return highVelocityTargets;
      
    } catch (err: any) {
      error(`TARGET_DISCOVERY_ERROR: ${err.message}`);
      return [];
    }
  }

  /**
   * Generate bandit arm ID for reply strategy
   */
  static generateArmId(tier: string, topicCluster: string, openingStyle: string): string {
    return `${tier}|${topicCluster}|${openingStyle}`;
  }

  /**
   * Select optimal reply strategy using bandit selection
   */
  static async selectReplyStrategy(target: ReplyTarget): Promise<ReplyStrategy> {
    try {
      // For now, use simple heuristics to select opening style
      // In production, would use bandit arm selection
      
      let openingStyle: typeof this.openingStyles[number] = 'add_value';
      
      // Simple heuristic based on content and tier
      if (target.content.includes('?')) {
        openingStyle = 'add_value'; // Questions need value-adding responses
      } else if (target.content.includes('study') || target.content.includes('research')) {
        openingStyle = 'metric_insight'; // Research posts get data responses
      } else if (target.tier === 'macro') {
        openingStyle = 'polite_disagree_cite'; // High-follower accounts get respectful disagreement
      } else {
        openingStyle = 'mini_checklist'; // General content gets actionable lists
      }
      
      const armId = this.generateArmId(target.tier, target.topic_cluster, openingStyle);
      
      return {
        target_id: target.id,
        opening_style: openingStyle,
        topic_cluster: target.topic_cluster,
        tier: target.tier,
        bandit_arm: armId
      };
      
    } catch (err: any) {
      error(`REPLY_STRATEGY_ERROR: ${err.message}`);
      return {
        target_id: target.id,
        opening_style: 'add_value',
        topic_cluster: 'health_general',
        tier: target.tier,
        bandit_arm: `${target.tier}|health_general|add_value`
      };
    }
  }

  /**
   * Process discovered targets and generate reply strategies
   */
  static async processTargets(maxTargets: number = 10): Promise<{
    targets: ReplyTarget[];
    strategies: ReplyStrategy[];
    stats: {
      discovered: number;
      high_velocity: number;
      tier_distribution: Record<string, number>;
      topic_distribution: Record<string, number>;
    };
  }> {
    try {
      const targets = await this.discoverTargets(maxTargets);
      const strategies: ReplyStrategy[] = [];
      
      // Generate strategies for each target
      for (const target of targets) {
        const strategy = await this.selectReplyStrategy(target);
        strategies.push(strategy);
        
        // Mark target as attempted
        await this.markTargetAttempted(target.id);
      }
      
      // Compute stats
      const tierDist: Record<string, number> = {};
      const topicDist: Record<string, number> = {};
      
      for (const target of targets) {
        tierDist[target.tier] = (tierDist[target.tier] || 0) + 1;
        topicDist[target.topic_cluster] = (topicDist[target.topic_cluster] || 0) + 1;
      }
      
      return {
        targets,
        strategies,
        stats: {
          discovered: targets.length,
          high_velocity: targets.filter(t => this.calculateVelocity(t) > 1.0).length,
          tier_distribution: tierDist,
          topic_distribution: topicDist
        }
      };
      
    } catch (err: any) {
      error(`TARGET_PROCESSING_ERROR: ${err.message}`);
      return {
        targets: [],
        strategies: [],
        stats: {
          discovered: 0,
          high_velocity: 0,
          tier_distribution: {},
          topic_distribution: {}
        }
      };
    }
  }

  /**
   * Get targeting status for monitoring
   */
  static async getStatus(): Promise<{
    tiers: typeof this.tiers;
    styles: typeof this.openingStyles;
    recent_targets: number;
    velocity_threshold: number;
  }> {
    // Count recent targets from KV store
    let recentTargets = 0;
    try {
      // This is a simplified count - in production would query KV pattern
      recentTargets = 5; // Mock value
    } catch (err: any) {
      warn(`TARGET_STATUS_ERROR: ${err.message}`);
    }
    
    return {
      tiers: this.tiers,
      styles: this.openingStyles,
      recent_targets: recentTargets,
      velocity_threshold: 0.5
    };
  }
}

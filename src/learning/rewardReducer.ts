import { admin as supabase } from '../lib/supabaseClients';
import { kvGet, kvSet } from '../utils/kv';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';

export interface RewardMetrics {
  er_weighted: number;
  follow_through: number;
  post_reward: number;
  reply_reward?: number;
  new_nonfollower_interactors?: number;
}

export interface PostMetrics {
  likes: number;
  reposts: number;
  replies: number;
  bookmarks: number;
  impressions: number;
  followers_delta_24h?: number;
  interactions_from_nonfollowers?: number;
}

/**
 * 🎯 REWARD REDUCER - Converts raw metrics to learning rewards
 * Computes ER_weighted and FollowThrough for posts and replies
 */
export class RewardReducer {
  
  /**
   * Compute weighted engagement rate from raw metrics
   */
  static computeERWeighted(metrics: PostMetrics): number {
    const { likes, reposts, replies, bookmarks, impressions } = metrics;
    const engagement = (0.4 * likes) + (0.3 * reposts) + (0.2 * replies) + (0.1 * bookmarks);
    return engagement / Math.max(1, impressions);
  }

  /**
   * Compute follow-through rate normalized by 90-day baseline
   */
  static async computeFollowThrough(followersDelta24h: number): Promise<number> {
    try {
      // Get 90-day rolling p95 baseline from KV cache
      const baselineKey = 'follower_growth:90d_p95';
      const cachedBaseline = await kvGet(baselineKey);
      
      let baseline = 1.0; // Default baseline
      
      if (cachedBaseline) {
        baseline = parseFloat(cachedBaseline);
      } else {
        // Compute baseline from recent data if not cached
        baseline = await this.computeFollowerGrowthBaseline();
        await kvSet(baselineKey, baseline.toString(), 24 * 60 * 60); // 24h cache
      }
      
      const followThrough = followersDelta24h / Math.max(1, baseline);
      return Math.max(0, Math.min(1, followThrough)); // Clip to [0,1]
      
    } catch (err: any) {
      warn(`FOLLOW_THROUGH_ERROR: ${err.message}`);
      return 0.1; // Conservative fallback
    }
  }

  /**
   * Compute 90-day P95 follower growth baseline
   */
  private static async computeFollowerGrowthBaseline(): Promise<number> {
    try {
      // Query recent follower deltas from metrics or posts
      const { data, error } = await supabase
        .from('unified_posts')
        .select('followers_count, created_at')
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })
        .limit(1000);

      if (error || !data || data.length < 2) {
        return 5.0; // Default baseline if no data
      }

      // Compute daily deltas
      const deltas: number[] = [];
      for (let i = 1; i < data.length; i++) {
        const delta = (data[i].followers_count || 0) - (data[i-1].followers_count || 0);
        if (delta >= 0) deltas.push(delta);
      }

      if (deltas.length === 0) return 5.0;

      // Compute P95
      deltas.sort((a, b) => a - b);
      const p95Index = Math.floor(deltas.length * 0.95);
      const baseline = deltas[p95Index] || 5.0;
      
      log(`BASELINE_COMPUTED: 90d_p95=${baseline} from ${deltas.length} samples`);
      return baseline;
      
    } catch (err: any) {
      error(`BASELINE_COMPUTATION_ERROR: ${err.message}`);
      return 5.0;
    }
  }

  /**
   * Compute complete reward metrics for a post
   */
  static async computePostReward(metrics: PostMetrics): Promise<RewardMetrics> {
    const erWeighted = this.computeERWeighted(metrics);
    const followThrough = await this.computeFollowThrough(metrics.followers_delta_24h || 0);
    
    const postReward = (0.6 * erWeighted) + (0.4 * followThrough);
    
    return {
      er_weighted: erWeighted,
      follow_through: followThrough,
      post_reward: postReward
    };
  }

  /**
   * Compute complete reward metrics for a reply
   */
  static async computeReplyReward(metrics: PostMetrics): Promise<RewardMetrics> {
    const erWeighted = this.computeERWeighted(metrics);
    const nonFollowerBonus = (metrics.interactions_from_nonfollowers || 0) * 0.1;
    
    const replyReward = erWeighted + nonFollowerBonus;
    
    return {
      er_weighted: erWeighted,
      follow_through: 0, // Not applicable for replies
      post_reward: 0,
      reply_reward: replyReward,
      new_nonfollower_interactors: metrics.interactions_from_nonfollowers || 0
    };
  }

  /**
   * Update bandit arm with reward using Beta conjugate update
   */
  static async updateBanditArm(armId: string, scope: string, reward: number): Promise<void> {
    try {
      // Convert reward to pseudo-counts for Beta update
      const success = reward; // Direct reward as success weight
      const trial = 1.0; // Each observation counts as one trial
      
      // Get current arm stats
      const { data: arm, error: getError } = await supabase
        .from('bandit_arms')
        .select('*')
        .eq('arm_id', armId)
        .eq('scope', scope)
        .single();

      if (getError && getError.code !== 'PGRST116') {
        throw getError;
      }

      if (arm) {
        // Update existing arm
        const newSuccesses = (arm.successes || 0) + success;
        const newTrials = (arm.trials || 0) + trial;
        
        const { error: updateError } = await supabase
          .from('bandit_arms')
          .update({
            successes: newSuccesses,
            trials: newTrials,
            last_updated: new Date().toISOString()
          })
          .eq('arm_id', armId)
          .eq('scope', scope);

        if (updateError) throw updateError;
        
        log(`BANDIT_UPDATE: ${scope}:${armId} successes=${newSuccesses.toFixed(3)} trials=${newTrials} reward=${reward.toFixed(3)}`);
        
      } else {
        // Create new arm
        const { error: insertError } = await supabase
          .from('bandit_arms')
          .insert({
            arm_id: armId,
            scope,
            successes: success,
            trials: trial,
            alpha: 1.0 + success, // Beta distribution parameter
            beta: 1.0 + (trial - success)
          });

        if (insertError) throw insertError;
        
        log(`BANDIT_CREATE: ${scope}:${armId} initial_reward=${reward.toFixed(3)}`);
      }
      
    } catch (err: any) {
      error(`BANDIT_ARM_UPDATE_ERROR: ${scope}:${armId}: ${err.message}`);
    }
  }

  /**
   * Process finalized post/reply and update learning systems
   */
  static async processFinalized(postId: string, type: 'post' | 'reply', metrics: PostMetrics, armId?: string, scope?: string): Promise<void> {
    try {
      log(`REWARD_PROCESS: ${type}:${postId} starting`);
      
      // Compute reward based on type
      const rewardMetrics = type === 'post' 
        ? await this.computePostReward(metrics)
        : await this.computeReplyReward(metrics);
      
      // Store in learning_posts
      const { error: learningError } = await supabase
        .from('learning_posts')
        .upsert({
          post_id: postId,
          reward: type === 'post' ? rewardMetrics.post_reward : rewardMetrics.reply_reward,
          er_weighted: rewardMetrics.er_weighted,
          follow_through: rewardMetrics.follow_through,
          metrics: JSON.stringify(metrics),
          processed_at: new Date().toISOString()
        });

      if (learningError) {
        warn(`LEARNING_POSTS_ERROR: ${postId}: ${learningError.message}`);
      }

      // Update bandit arm if provided
      if (armId && scope) {
        const reward = type === 'post' ? rewardMetrics.post_reward : rewardMetrics.reply_reward;
        await this.updateBanditArm(armId, scope, reward || 0);
      }
      
      log(`REWARD_PROCESS_COMPLETE: ${type}:${postId} reward=${(type === 'post' ? rewardMetrics.post_reward : rewardMetrics.reply_reward)?.toFixed(3)}`);
      
    } catch (err: any) {
      error(`REWARD_PROCESS_ERROR: ${postId}: ${err.message}`);
    }
  }
}

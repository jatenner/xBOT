import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

export interface BanditArm {
  hook_type: string;
  cta_type: string;
  thread_len: number;
  post_time_bucket: string;
  topic_cluster: string;
}

export interface PostMetrics {
  impressions: number;
  likes: number;
  replies: number;
  bookmarks: number;
  follows: number;
}

export class ThompsonBandit {
  private static instance: ThompsonBandit;
  private db: AdvancedDatabaseManager;

  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
  }

  public static getInstance(): ThompsonBandit {
    if (!ThompsonBandit.instance) {
      ThompsonBandit.instance = new ThompsonBandit();
    }
    return ThompsonBandit.instance;
  }

  public async sampleArm(availableArms: BanditArm[]): Promise<BanditArm> {
    // Thompson sampling implementation
    let bestArm = availableArms[0];
    let bestSample = 0;

    for (const arm of availableArms) {
      const posterior = await this.getPosterior(arm);
      const sample = this.sampleBeta(posterior.alpha, posterior.beta);
      
      if (sample > bestSample) {
        bestSample = sample;
        bestArm = arm;
      }
    }

    return bestArm;
  }

  public computeReward(metrics: PostMetrics): number {
    const { likes, replies, bookmarks, follows, impressions } = metrics;
    
    if (impressions <= 0) return 0;

    // ER = (likes + replies + bookmarks) / max(1, impressions)
    const engagementRate = (likes + replies + bookmarks) / Math.max(1, impressions);
    
    // FY = follows / max(1, impressions) * 1000  -- follows per 1k views
    const followRate = (follows / Math.max(1, impressions)) * 1000;
    
    // Bookmark rate
    const bookmarkRate = bookmarks / Math.max(1, impressions);
    
    // Q = 0.4*ER + 0.4*FY + 0.2*(bookmarks/max(1, impressions))
    const reward = 0.4 * engagementRate + 0.4 * followRate + 0.2 * bookmarkRate;
    return Math.max(0, Math.min(1, reward));
  }

  public async updatePosterior(arm: BanditArm, reward: number): Promise<void> {
    const isSuccess = reward > 0.1; // Threshold for "success"
    
    await this.db.executeQuery('update_bandit', async (client) => {
      const armKey = JSON.stringify(arm);
      
      const { data: existing } = await client
        .from('bandit_posteriors')
        .select('alpha, beta')
        .eq('arm', armKey)
        .single();

      const currentAlpha = existing?.alpha || 1;
      const currentBeta = existing?.beta || 1;
      
      const newAlpha = currentAlpha + (isSuccess ? 1 : 0);
      const newBeta = currentBeta + (isSuccess ? 0 : 1);

      const { error } = await client
        .from('bandit_posteriors')
        .upsert({
          arm: armKey,
          alpha: newAlpha,
          beta: newBeta,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      console.log(`BANDIT: updated posteriors for arm=${JSON.stringify(arm)} alpha=${newAlpha} beta=${newBeta}`);
      return { success: true };
    });
  }

  /**
   * Process 24h metrics for reward computation and bandit updates
   */
  public async processPost24hMetrics(postId: string): Promise<void> {
    const postData = await this.db.executeQuery('get_post_for_bandit', async (client) => {
      const { data: post, error: postError } = await client
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (postError) throw postError;

      // Get latest metrics (approximately 24h)
      const { data: metrics, error: metricsError } = await client
        .from('post_metrics')
        .select('*')
        .eq('post_id', postId)
        .order('snapshot_at', { ascending: false })
        .limit(1);

      if (metricsError) throw metricsError;

      return { post, metrics: metrics?.[0] };
    });

    if (!postData.post || !postData.metrics) {
      console.warn(`No data found for post ${postId}`);
      return;
    }

    const { post, metrics } = postData;
    
    // Extract arm from post
    const arm: BanditArm = {
      hook_type: post.hook_type,
      cta_type: post.cta_type || 'follow',
      thread_len: post.thread_len,
      post_time_bucket: this.getTimeBucket(new Date(post.posted_at)),
      topic_cluster: post.topic_cluster
    };

    // Compute reward
    const reward = this.computeReward({
      impressions: metrics.impressions,
      likes: metrics.likes,
      replies: metrics.replies,
      bookmarks: metrics.bookmarks,
      follows: metrics.follows
    });

    // Update bandit
    await this.updatePosterior(arm, reward);
    
    console.log(`BANDIT: processed 24h metrics for ${post.tweet_id}, reward=${reward.toFixed(3)}`);
  }

  private async getPosterior(arm: BanditArm): Promise<{alpha: number, beta: number}> {
    return this.db.executeQuery('get_posterior', async (client) => {
      const { data } = await client
        .from('bandit_posteriors')
        .select('alpha, beta')
        .eq('arm', JSON.stringify(arm))
        .single();

      return data || { alpha: 1, beta: 1 }; // Prior
    });
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Simplified beta sampling using mean + noise for small-scale learning
    if (alpha + beta < 10) {
      // For new arms, add exploration noise
      const mean = alpha / (alpha + beta);
      const uncertainty = 1 / Math.sqrt(alpha + beta);
      const noise = (Math.random() - 0.5) * uncertainty;
      return Math.max(0, Math.min(1, mean + noise));
    }
    
    // For arms with more data, use closer to mean
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    const std = Math.sqrt(variance);
    
    // Simple normal approximation
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    return Math.max(0, Math.min(1, mean + std * z));
  }

  private getTimeBucket(date: Date): string {
    const hour = date.getHours();
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }
}
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

    const engagementRate = (likes + replies + bookmarks) / Math.max(1, impressions);
    const followRate = (follows / Math.max(1, impressions)) * 1000;
    const bookmarkRate = bookmarks / Math.max(1, impressions);
    
    const reward = 0.4 * engagementRate + 0.4 * followRate + 0.2 * bookmarkRate;
    return Math.max(0, Math.min(1, reward));
  }

  public async updatePosterior(arm: BanditArm, reward: number): Promise<void> {
    const isSuccess = reward > 0.1;
    
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
      
      console.log(`BANDIT: updated posteriors for arm=${JSON.stringify(arm)}`);
      return { success: true };
    });
  }

  private async getPosterior(arm: BanditArm): Promise<{alpha: number, beta: number}> {
    return this.db.executeQuery('get_posterior', async (client) => {
      const { data } = await client
        .from('bandit_posteriors')
        .select('alpha, beta')
        .eq('arm', JSON.stringify(arm))
        .single();

      return data || { alpha: 1, beta: 1 };
    });
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Simple beta sampling approximation
    const mean = alpha / (alpha + beta);
    const noise = (Math.random() - 0.5) * 0.1;
    return Math.max(0, Math.min(1, mean + noise));
  }
}
import { BanditArm, ThompsonBandit } from '../learn/bandit';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

export interface PostingOpportunity {
  arm: BanditArm;
  predictedQ: number;
  momentum: number;
  freshness: number;
  overallScore: number;
  shouldPost: boolean;
}

export class PostingScheduler {
  private static instance: PostingScheduler;
  private bandit: ThompsonBandit;
  private db: AdvancedDatabaseManager;

  private constructor() {
    this.bandit = ThompsonBandit.getInstance();
    this.db = AdvancedDatabaseManager.getInstance();
  }

  public static getInstance(): PostingScheduler {
    if (!PostingScheduler.instance) {
      PostingScheduler.instance = new PostingScheduler();
    }
    return PostingScheduler.instance;
  }

  /**
   * Evaluate current posting opportunity
   */
  public async evaluatePostingOpportunity(): Promise<PostingOpportunity> {
    const now = new Date();
    const hour = now.getHours();
    
    // Define available arms based on current context
    const availableArms = this.generateAvailableArms();
    
    // Use bandit to select best arm (80% exploit)
    const shouldExplore = Math.random() < 0.2; // 20% exploration
    
    let selectedArm: BanditArm;
    if (shouldExplore) {
      // Random exploration
      selectedArm = availableArms[Math.floor(Math.random() * availableArms.length)];
    } else {
      // Bandit exploitation
      selectedArm = await this.bandit.sampleArm(availableArms);
    }

    // Get topic momentum
    const momentum = await this.getTopicMomentum(selectedArm.topic_cluster);
    
    // Calculate freshness (time since last post)
    const freshness = await this.getFreshness();
    
    // Predict Q value (simplified)
    const predictedQ = await this.predictQValue(selectedArm);
    
    // Overall scoring
    const overallScore = this.computeOverallScore(predictedQ, momentum, freshness, hour);
    
    // Posting threshold
    const shouldPost = overallScore > 60 && this.isOptimalWindow(hour);

    const opportunity: PostingOpportunity = {
      arm: selectedArm,
      predictedQ,
      momentum,
      freshness,
      overallScore,
      shouldPost
    };

    console.log(`SCHEDULE: opportunity score=${overallScore.toFixed(1)} ${shouldPost ? 'POST' : 'WAIT'} - arm=${JSON.stringify(selectedArm)}`);
    
    return opportunity;
  }

  private generateAvailableArms(): BanditArm[] {
    const hookTypes = ['stat', 'myth_bust', 'checklist', 'how_to', 'story'];
    const ctaTypes = ['follow', 'bookmark', 'reply'];
    const threadLens = [4, 5, 6, 7, 8];
    const topicClusters = ['sleep', 'nutrition', 'exercise', 'mental_health', 'supplements'];
    
    const now = new Date();
    const timeBucket = this.getTimeBucket(now);
    
    const arms: BanditArm[] = [];
    
    // Generate some representative arms (not all combinations)
    for (const hookType of hookTypes) {
      for (const ctaType of ctaTypes) {
        for (const threadLen of threadLens) {
          for (const topic of topicClusters) {
            arms.push({
              hook_type: hookType,
              cta_type: ctaType,
              thread_len: threadLen,
              post_time_bucket: timeBucket,
              topic_cluster: topic
            });
          }
        }
      }
    }
    
    // Return a sample to avoid too many combinations
    return arms.slice(0, 50);
  }

  private async getTopicMomentum(topic: string): Promise<number> {
    return this.db.executeQuery('get_momentum', async (client) => {
      const { data } = await client
        .from('topic_clusters')
        .select('momentum_score')
        .eq('label', topic)
        .single();

      return data?.momentum_score || 0;
    });
  }

  private async getFreshness(): Promise<number> {
    return this.db.executeQuery('get_freshness', async (client) => {
      const { data } = await client
        .from('posts')
        .select('posted_at')
        .order('posted_at', { ascending: false })
        .limit(1);

      if (!data || data.length === 0) return 100; // No previous posts

      const lastPost = new Date(data[0].posted_at);
      const hoursSince = (Date.now() - lastPost.getTime()) / (1000 * 60 * 60);
      
      // Fresh if > 4 hours, stale if < 1 hour
      return Math.min(100, Math.max(0, (hoursSince - 1) * 25));
    });
  }

  private async predictQValue(arm: BanditArm): Promise<number> {
    // Simple prediction based on historical performance
    return this.db.executeQuery('predict_q', async (client) => {
      const { data } = await client
        .from('bandit_posteriors')
        .select('alpha, beta')
        .eq('arm', JSON.stringify(arm))
        .single();

      if (!data) return 0.1; // Default for new arms

      const { alpha, beta } = data;
      return alpha / (alpha + beta); // Mean of beta distribution
    });
  }

  private computeOverallScore(predictedQ: number, momentum: number, freshness: number, hour: number): number {
    const timeBonus = this.getTimeBonus(hour);
    
    return Math.round(
      predictedQ * 40 +        // 40% predicted performance
      momentum * 0.3 +         // 30% topic momentum
      freshness * 0.2 +        // 20% freshness
      timeBonus * 0.1          // 10% time bonus
    );
  }

  private isOptimalWindow(hour: number): boolean {
    // Optimal posting windows: 7-9am, 12-1pm, 5-7pm, 8-9pm
    const optimalWindows = [
      [7, 9],   // Morning
      [12, 13], // Lunch
      [17, 19], // Evening
      [20, 21]  // Night
    ];

    return optimalWindows.some(([start, end]) => hour >= start && hour < end);
  }

  private getTimeBonus(hour: number): number {
    if (this.isOptimalWindow(hour)) return 100;
    if (hour >= 6 && hour <= 22) return 50; // Decent hours
    return 0; // Late night/early morning
  }

  private getTimeBucket(date: Date): string {
    const hour = date.getHours();
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Update topic momentum scores (daily refresh)
   */
  public async refreshTopicMomentum(): Promise<void> {
    console.log('SCHEDULE: refreshing topic momentum...');
    
    const topics = ['sleep', 'nutrition', 'exercise', 'mental_health', 'supplements'];
    
    for (const topic of topics) {
      // Simple heuristic: based on recent post performance
      const momentum = Math.random() * 100; // Placeholder
      
      await this.db.executeQuery('update_momentum', async (client) => {
        const { error } = await client
          .from('topic_clusters')
          .upsert({
            label: topic,
            keywords: [topic],
            momentum_score: momentum
          });

        if (error) console.warn(`Failed to update momentum for ${topic}:`, error.message);
        return { success: true };
      });
    }
    
    console.log('SCHEDULE: topic momentum refreshed');
  }
}
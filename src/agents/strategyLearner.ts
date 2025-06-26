import { supabaseClient } from '../utils/supabaseClient';

interface StyleReward {
  style_name: string;
  f_per_1k_reward: number;
  sample_count: number;
  confidence: number;
}

export class StrategyLearner {
  private epsilon: number = 0.1; // 10% exploration rate
  private contentStyles = [
    'educational',
    'breaking_news', 
    'viral_take',
    'data_story',
    'thought_leadership',
    'community_building',
    'trending_analysis',
    'research_insight'
  ];

  async run(): Promise<void> {
    console.log('🧠 === STRATEGY LEARNER STARTED (ε-greedy) ===');
    
    try {
      // Fetch 7-day average F/1K per style
      const stylePerformance = await this.getStylePerformance();
      console.log('📊 Current style performance:', stylePerformance);

      // ε-greedy style selection
      const selectedStyle = await this.epsilonGreedySelection(stylePerformance);
      console.log(`🎯 Selected style: ${selectedStyle} (ε=${this.epsilon})`);

      // Update bot config with selected style
      await this.updateNextStyle(selectedStyle);

      // Update rewards based on recent performance
      await this.updateStyleRewards();

      console.log('✅ Strategy learning cycle complete');

    } catch (error) {
      console.error('❌ Strategy learner failed:', error);
    }
  }

  private async getStylePerformance(): Promise<StyleReward[]> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get average F/1K per style from recent tweets
      const { data, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('content_type, impressions, new_followers')
        .gte('created_at', sevenDaysAgo.toISOString())
        .not('impressions', 'is', null);

      if (error) throw error;

      const styleStats: { [style: string]: { impressions: number; followers: number; count: number } } = {};

      // Aggregate by style
      for (const tweet of data || []) {
        const style = tweet.content_type || 'general';
        if (!styleStats[style]) {
          styleStats[style] = { impressions: 0, followers: 0, count: 0 };
        }
        styleStats[style].impressions += tweet.impressions || 0;
        styleStats[style].followers += tweet.new_followers || 0;
        styleStats[style].count += 1;
      }

      // Calculate F/1K for each style
      const rewards: StyleReward[] = Object.entries(styleStats).map(([style, stats]) => ({
        style_name: style,
        f_per_1k_reward: stats.impressions > 0 ? (stats.followers * 1000) / stats.impressions : 0,
        sample_count: stats.count,
        confidence: Math.min(stats.count / 10, 1) // Confidence increases with sample size
      }));

      return rewards;
    } catch (error) {
      console.error('Error getting style performance:', error);
      return [];
    }
  }

  private async epsilonGreedySelection(stylePerformance: StyleReward[]): Promise<string> {
    // ε-greedy: explore with probability ε, exploit with probability 1-ε
    if (Math.random() < this.epsilon || stylePerformance.length === 0) {
      // Exploration: random style
      const randomStyle = this.contentStyles[Math.floor(Math.random() * this.contentStyles.length)];
      console.log(`🔍 Exploring: ${randomStyle}`);
      return randomStyle;
    } else {
      // Exploitation: best performing style (weighted by confidence)
      const weightedStyles = stylePerformance.map(style => ({
        ...style,
        weighted_reward: style.f_per_1k_reward * style.confidence
      }));

      const bestStyle = weightedStyles.reduce((best, current) => 
        current.weighted_reward > best.weighted_reward ? current : best
      );

      console.log(`⚡ Exploiting: ${bestStyle.style_name} (F/1K: ${bestStyle.f_per_1k_reward.toFixed(2)})`);
      return bestStyle.style_name;
    }
  }

  private async updateNextStyle(style: string): Promise<void> {
    try {
      await supabaseClient.setBotConfig('next_style', style);
      console.log(`📝 Updated next_style to: ${style}`);
    } catch (error) {
      console.error('Error updating next style:', error);
    }
  }

  private async updateStyleRewards(): Promise<void> {
    try {
      const stylePerformance = await this.getStylePerformance();
      
      for (const style of stylePerformance) {
        // Upsert style rewards
        const { error } = await supabaseClient.supabase
          ?.from('style_rewards')
          .upsert({
            style_name: style.style_name,
            f_per_1k_reward: style.f_per_1k_reward,
            sample_count: style.sample_count,
            last_updated: new Date().toISOString()
          });

        if (error) throw error;
      }

      console.log(`📊 Updated rewards for ${stylePerformance.length} styles`);
    } catch (error) {
      console.error('Error updating style rewards:', error);
    }
  }

  async getTopPerformingStyles(limit: number = 5): Promise<StyleReward[]> {
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('style_rewards')
        .select('*')
        .order('f_per_1k_reward', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching top styles:', error);
      return [];
    }
  }

  // Adaptive epsilon based on exploration success
  async adaptEpsilon(): Promise<void> {
    const recentPerformance = await this.getStylePerformance();
    const avgPerformance = recentPerformance.reduce((sum, style) => sum + style.f_per_1k_reward, 0) / recentPerformance.length;
    
    // Increase exploration if performance is poor, decrease if doing well
    if (avgPerformance < 2.0) { // Poor performance threshold
      this.epsilon = Math.min(0.3, this.epsilon + 0.05);
    } else if (avgPerformance > 5.0) { // Good performance threshold
      this.epsilon = Math.max(0.05, this.epsilon - 0.01);
    }
    
    console.log(`🎛️ Adapted epsilon to: ${this.epsilon} (avg F/1K: ${avgPerformance.toFixed(2)})`);
  }
} 
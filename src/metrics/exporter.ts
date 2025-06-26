import { Request, Response } from 'express';
import { supabaseClient } from '../utils/supabaseClient';
import { AwarenessLogger } from '../utils/awarenessLogger';

interface MetricData {
  name: string;
  help: string;
  type: 'gauge' | 'counter' | 'histogram';
  value: number;
  labels?: Record<string, string>;
}

export class PrometheusExporter {
  private static instance: PrometheusExporter;
  private metrics: Map<string, MetricData> = new Map();

  static getInstance(): PrometheusExporter {
    if (!PrometheusExporter.instance) {
      PrometheusExporter.instance = new PrometheusExporter();
    }
    return PrometheusExporter.instance;
  }

  private constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    // Core growth metrics
    this.metrics.set('followers_per_1k_impressions', {
      name: 'followers_per_1k_impressions',
      help: 'Followers gained per 1000 tweet impressions (F/1K optimization metric)',
      type: 'gauge',
      value: 0
    });

    this.metrics.set('daily_follower_count', {
      name: 'daily_follower_count',
      help: 'Total follower count tracked daily',
      type: 'gauge',
      value: 0
    });

    this.metrics.set('daily_impression_count', {
      name: 'daily_impression_count',
      help: 'Total tweet impressions for the day',
      type: 'gauge',
      value: 0
    });

    this.metrics.set('follow_actions_daily', {
      name: 'follow_actions_daily',
      help: 'Number of follow actions performed today',
      type: 'gauge',
      value: 0
    });

    this.metrics.set('unfollow_actions_daily', {
      name: 'unfollow_actions_daily',
      help: 'Number of unfollow actions performed today',
      type: 'gauge',
      value: 0
    });

    this.metrics.set('strategy_epsilon', {
      name: 'strategy_epsilon',
      help: 'Current epsilon value for exploration vs exploitation',
      type: 'gauge',
      value: 0.1
    });

    this.metrics.set('content_style_rewards', {
      name: 'content_style_rewards',
      help: 'Average F/1K reward by content style',
      type: 'gauge',
      value: 0
    });

    this.metrics.set('tweet_post_rate', {
      name: 'tweet_post_rate',
      help: 'Tweets posted in the last 24 hours',
      type: 'gauge',
      value: 0
    });

    this.metrics.set('engagement_rate', {
      name: 'engagement_rate',
      help: 'Overall engagement rate (likes + retweets + replies) / impressions',
      type: 'gauge',
      value: 0
    });

    this.metrics.set('system_health_score', {
      name: 'system_health_score',
      help: 'Overall autonomous growth system health (0-1)',
      type: 'gauge',
      value: 1.0
    });
  }

  async updateMetricsFromDatabase(): Promise<void> {
    try {
      // Get latest growth metrics
      const { data: latestMetrics } = await supabaseClient.supabase
        .from('growth_metrics')
        .select('*')
        .order('metric_day', { ascending: false })
        .limit(1);

      if (latestMetrics && latestMetrics.length > 0) {
        const metric = latestMetrics[0];
        this.updateMetric('followers_per_1k_impressions', metric.f_per_1k || 0);
        this.updateMetric('daily_follower_count', metric.new_followers || 0);
        this.updateMetric('daily_impression_count', metric.impressions || 0);
      }

      // Get follow action counts for today
      const today = new Date().toISOString().split('T')[0];
      const { data: followActions } = await supabaseClient.supabase
        .from('follow_actions')
        .select('action_type')
        .gte('action_date', today)
        .eq('success', true);

      if (followActions) {
        const follows = followActions.filter(a => a.action_type === 'follow').length;
        const unfollows = followActions.filter(a => a.action_type === 'unfollow').length;
        this.updateMetric('follow_actions_daily', follows);
        this.updateMetric('unfollow_actions_daily', unfollows);
      }

      // Get strategy learner epsilon
      const epsilon = await supabaseClient.getBotConfig('strategy_epsilon');
      this.updateMetric('strategy_epsilon', parseFloat(epsilon || '0.1'));

      // Get average style rewards
      const { data: styleRewards } = await supabaseClient.supabase
        .from('style_rewards')
        .select('avg_reward')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (styleRewards && styleRewards.length > 0) {
        this.updateMetric('content_style_rewards', styleRewards[0].avg_reward || 0);
      }

      // Get recent tweet count
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { data: recentTweets } = await supabaseClient.supabase
        .from('tweets')
        .select('id')
        .gte('created_at', yesterday.toISOString());

      this.updateMetric('tweet_post_rate', recentTweets?.length || 0);

      // Calculate system health score
      const healthScore = this.calculateSystemHealth();
      this.updateMetric('system_health_score', healthScore);

      console.log('📊 Metrics updated from database');
    } catch (error) {
      console.error('❌ Failed to update metrics from database:', error);
      this.updateMetric('system_health_score', 0.5); // Degraded health
    }
  }

  private calculateSystemHealth(): number {
    let healthScore = 1.0;
    
    // Check if we're posting regularly
    const tweetRate = this.metrics.get('tweet_post_rate')?.value || 0;
    if (tweetRate < 1) healthScore -= 0.3;

    // Check follow/unfollow balance
    const follows = this.metrics.get('follow_actions_daily')?.value || 0;
    const unfollows = this.metrics.get('unfollow_actions_daily')?.value || 0;
    if (follows === 0 && unfollows === 0) healthScore -= 0.2;

    // Check F/1K performance
    const f1k = this.metrics.get('followers_per_1k_impressions')?.value || 0;
    if (f1k < 0.1) healthScore -= 0.2;

    // Check engagement rate
    const engagement = this.metrics.get('engagement_rate')?.value || 0;
    if (engagement < 0.01) healthScore -= 0.2;

    return Math.max(0, Math.min(1, healthScore));
  }

  updateMetric(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.value = value;
      if (labels) metric.labels = labels;
    }
  }

  formatPrometheusMetrics(): string {
    let output = '';
    
    for (const [name, metric] of this.metrics) {
      // Add help comment
      output += `# HELP ${metric.name} ${metric.help}\n`;
      output += `# TYPE ${metric.name} ${metric.type}\n`;
      
      // Add metric with labels if present
      if (metric.labels) {
        const labelStr = Object.entries(metric.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        output += `${metric.name}{${labelStr}} ${metric.value}\n`;
      } else {
        output += `${metric.name} ${metric.value}\n`;
      }
      output += '\n';
    }

    // Add timestamp
    output += `# Growth loop metrics updated at ${new Date().toISOString()}\n`;
    
    return output;
  }

  async handleMetricsRequest(req: Request, res: Response): Promise<void> {
    try {
      await this.updateMetricsFromDatabase();
      const metrics = this.formatPrometheusMetrics();
      
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(metrics);
      
      console.log('📊 Metrics endpoint served');
    } catch (error) {
      console.error('❌ Metrics endpoint error:', error);
      res.status(500).send('# Error generating metrics\n');
    }
  }
}

// Export singleton instance
export const metricsExporter = PrometheusExporter.getInstance(); 
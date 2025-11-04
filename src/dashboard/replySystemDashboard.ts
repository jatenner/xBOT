/**
 * 📊 REPLY SYSTEM DASHBOARD
 * 
 * Real-time performance monitoring for the reply system.
 * Displays all key metrics in one place.
 */

import { getSupabaseClient } from '../db';
import { unifiedReplyTracker } from '../learning/UnifiedReplyTracker';

export interface ReplySystemMetrics {
  // Pool health
  opportunity_pool: {
    total: number;
    golden: number;
    good: number;
    acceptable: number;
    avg_age_hours: number;
  };
  
  // Generation metrics
  generation: {
    last_24h: number;
    avg_quality_score: number;
    avg_predicted_er: number;
    top_generators: Array<{ name: string; count: number }>;
  };
  
  // Posting metrics
  posting: {
    queued: number;
    posted_today: number;
    success_rate_24h: number;
    avg_time_to_post_minutes: number;
    placeholder_ids: number;
  };
  
  // Performance metrics
  performance: {
    total_replies_tracked: number;
    total_followers_gained: number;
    avg_conversion_rate: number;
    top_accounts: Array<{ account: string; conversion: number }>;
    top_tiers: Array<{ tier: string; avg_followers: number }>;
  };
  
  // System health
  health: {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    last_updated: string;
  };
}

export class ReplySystemDashboard {
  private static instance: ReplySystemDashboard;
  private supabase = getSupabaseClient();

  private constructor() {}

  public static getInstance(): ReplySystemDashboard {
    if (!ReplySystemDashboard.instance) {
      ReplySystemDashboard.instance = new ReplySystemDashboard();
    }
    return ReplySystemDashboard.instance;
  }

  /**
   * Get all dashboard metrics
   */
  public async getMetrics(): Promise<ReplySystemMetrics> {
    console.log('[DASHBOARD] 📊 Fetching reply system metrics...');

    const [
      poolMetrics,
      generationMetrics,
      postingMetrics,
      performanceMetrics
    ] = await Promise.all([
      this.getOpportunityPoolMetrics(),
      this.getGenerationMetrics(),
      this.getPostingMetrics(),
      this.getPerformanceMetrics()
    ]);

    const health = this.calculateSystemHealth({
      pool: poolMetrics,
      generation: generationMetrics,
      posting: postingMetrics,
      performance: performanceMetrics
    });

    return {
      opportunity_pool: poolMetrics,
      generation: generationMetrics,
      posting: postingMetrics,
      performance: performanceMetrics,
      health
    };
  }

  /**
   * Get opportunity pool metrics
   */
  private async getOpportunityPoolMetrics() {
    const { data: opportunities } = await this.supabase
      .from('reply_opportunities')
      .select('tier, created_at')
      .eq('replied_to', false)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const total = opportunities?.length || 0;
    const golden = opportunities?.filter(o => o.tier === 'golden').length || 0;
    const good = opportunities?.filter(o => o.tier === 'good').length || 0;
    const acceptable = opportunities?.filter(o => o.tier === 'acceptable').length || 0;

    // Calculate average age
    const ages = opportunities?.map(o => {
      const created = new Date(o.created_at).getTime();
      return (Date.now() - created) / (1000 * 60 * 60); // hours
    }) || [];
    
    const avg_age_hours = ages.length > 0
      ? ages.reduce((sum, age) => sum + age, 0) / ages.length
      : 0;

    return {
      total,
      golden,
      good,
      acceptable,
      avg_age_hours
    };
  }

  /**
   * Get generation metrics
   */
  private async getGenerationMetrics() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: replies } = await this.supabase
      .from('content_metadata')
      .select('decision_id, quality_score, predicted_er, generator_name')
      .eq('decision_type', 'reply')
      .gte('created_at', twentyFourHoursAgo);

    const last_24h = replies?.length || 0;
    
    const avg_quality_score = replies && replies.length > 0
      ? replies.reduce((sum, r) => sum + (Number(r.quality_score) || 0), 0) / replies.length
      : 0;

    const avg_predicted_er = replies && replies.length > 0
      ? replies.reduce((sum, r) => sum + (Number(r.predicted_er) || 0), 0) / replies.length
      : 0;

    // Top generators
    const generatorCounts = new Map<string, number>();
    replies?.forEach(r => {
      if (r.generator_name) {
        generatorCounts.set(r.generator_name, (generatorCounts.get(r.generator_name) || 0) + 1);
      }
    });

    const top_generators = Array.from(generatorCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      last_24h,
      avg_quality_score,
      avg_predicted_er,
      top_generators
    };
  }

  /**
   * Get posting metrics
   */
  private async getPostingMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Queued replies
    const { count: queued } = await this.supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'queued');

    // Posted today
    const { count: posted_today } = await this.supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', today.toISOString());

    // Success rate last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: last24h } = await this.supabase
      .from('content_metadata')
      .select('status')
      .eq('decision_type', 'reply')
      .gte('created_at', twentyFourHoursAgo);

    const posted = last24h?.filter(r => r.status === 'posted').length || 0;
    const total = last24h?.length || 0;
    const success_rate_24h = total > 0 ? (posted / total) * 100 : 0;

    // Average time from creation to posting
    const { data: posted_replies } = await this.supabase
      .from('content_metadata')
      .select('created_at, posted_at')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', twentyFourHoursAgo)
      .not('posted_at', 'is', null)
      .limit(100);

    const times = posted_replies?.map(r => {
      const created = new Date(r.created_at).getTime();
      const posted = new Date(r.posted_at!).getTime();
      return (posted - created) / (1000 * 60); // minutes
    }) || [];

    const avg_time_to_post_minutes = times.length > 0
      ? times.reduce((sum, t) => sum + t, 0) / times.length
      : 0;

    // Placeholder IDs
    const { count: placeholder_ids } = await this.supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .like('tweet_id', 'reply_posted_%');

    return {
      queued: queued || 0,
      posted_today: posted_today || 0,
      success_rate_24h,
      avg_time_to_post_minutes,
      placeholder_ids: placeholder_ids || 0
    };
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics() {
    // Use unified tracker for system-wide stats
    const systemPerf = await unifiedReplyTracker.getSystemPerformance();

    // Get tier performance
    const { data: tierPerf } = await this.supabase
      .from('reply_conversions')
      .select('opportunity_tier, followers_gained')
      .not('opportunity_tier', 'is', null)
      .not('measured_at', 'is', null);

    const tierMap = new Map<string, number[]>();
    tierPerf?.forEach(t => {
      if (!tierMap.has(t.opportunity_tier!)) {
        tierMap.set(t.opportunity_tier!, []);
      }
      tierMap.get(t.opportunity_tier!)!.push(t.followers_gained || 0);
    });

    const top_tiers = Array.from(tierMap.entries())
      .map(([tier, followers]) => ({
        tier,
        avg_followers: followers.reduce((sum, f) => sum + f, 0) / followers.length
      }))
      .sort((a, b) => b.avg_followers - a.avg_followers);

    return {
      total_replies_tracked: systemPerf.total_replies,
      total_followers_gained: systemPerf.total_followers_gained,
      avg_conversion_rate: systemPerf.avg_conversion_rate,
      top_accounts: systemPerf.top_accounts.slice(0, 5).map(a => ({
        account: a.account,
        conversion: a.conversion_rate
      })),
      top_tiers
    };
  }

  /**
   * Calculate overall system health
   */
  private calculateSystemHealth(metrics: {
    pool: any;
    generation: any;
    posting: any;
    performance: any;
  }): { status: 'healthy' | 'warning' | 'critical'; issues: string[]; last_updated: string } {
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check pool health
    if (metrics.pool.total < 50) {
      issues.push(`Low opportunity pool: ${metrics.pool.total} (need 150+)`);
      status = 'critical';
    } else if (metrics.pool.total < 100) {
      issues.push(`Opportunity pool below target: ${metrics.pool.total} (target: 150+)`);
      if (status === 'healthy') status = 'warning';
    }

    if (metrics.pool.golden < 20) {
      issues.push(`Low golden opportunities: ${metrics.pool.golden} (need 50+)`);
      if (status === 'healthy') status = 'warning';
    }

    // Check generation rate
    if (metrics.generation.last_24h < 100) {
      issues.push(`Low generation rate: ${metrics.generation.last_24h}/day (target: 240/day)`);
      if (status === 'healthy') status = 'warning';
    }

    if (metrics.generation.avg_quality_score < 0.7) {
      issues.push(`Low quality score: ${metrics.generation.avg_quality_score.toFixed(2)} (target: 0.7+)`);
      if (status === 'healthy') status = 'warning';
    }

    // Check posting success
    if (metrics.posting.success_rate_24h < 50) {
      issues.push(`Low posting success: ${metrics.posting.success_rate_24h.toFixed(1)}% (target: 80%+)`);
      status = 'critical';
    } else if (metrics.posting.success_rate_24h < 75) {
      issues.push(`Posting success below target: ${metrics.posting.success_rate_24h.toFixed(1)}% (target: 80%+)`);
      if (status === 'healthy') status = 'warning';
    }

    if (metrics.posting.placeholder_ids > 10) {
      issues.push(`${metrics.posting.placeholder_ids} replies with placeholder IDs (run backfill job)`);
      if (status === 'healthy') status = 'warning';
    }

    // Check performance
    if (metrics.performance.avg_conversion_rate < 1.0) {
      issues.push(`Low conversion rate: ${metrics.performance.avg_conversion_rate.toFixed(2)} followers/reply`);
      if (status === 'healthy') status = 'warning';
    }

    if (issues.length === 0) {
      issues.push('All systems operational');
    }

    return {
      status,
      issues,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Print dashboard to console
   */
  public async printDashboard(): Promise<void> {
    const metrics = await this.getMetrics();

    console.log('\n' + '═'.repeat(80));
    console.log('📊 REPLY SYSTEM DASHBOARD');
    console.log('═'.repeat(80));

    // System Health
    const healthIcon = metrics.health.status === 'healthy' ? '✅' : metrics.health.status === 'warning' ? '⚠️' : '🚨';
    console.log(`\n${healthIcon} SYSTEM HEALTH: ${metrics.health.status.toUpperCase()}`);
    metrics.health.issues.forEach(issue => console.log(`   • ${issue}`));

    // Opportunity Pool
    console.log('\n🌾 OPPORTUNITY POOL:');
    console.log(`   Total: ${metrics.opportunity_pool.total} (🏆 ${metrics.opportunity_pool.golden} golden, ✅ ${metrics.opportunity_pool.good} good, 📊 ${metrics.opportunity_pool.acceptable} acceptable)`);
    console.log(`   Avg age: ${metrics.opportunity_pool.avg_age_hours.toFixed(1)} hours`);

    // Generation
    console.log('\n🤖 GENERATION (24h):');
    console.log(`   Replies generated: ${metrics.generation.last_24h}`);
    console.log(`   Avg quality: ${metrics.generation.avg_quality_score.toFixed(2)}`);
    console.log(`   Avg predicted ER: ${(metrics.generation.avg_predicted_er * 100).toFixed(2)}%`);
    if (metrics.generation.top_generators.length > 0) {
      console.log(`   Top generators:`);
      metrics.generation.top_generators.slice(0, 3).forEach(g => 
        console.log(`      • ${g.name}: ${g.count} replies`)
      );
    }

    // Posting
    console.log('\n🚀 POSTING:');
    console.log(`   Queued: ${metrics.posting.queued}`);
    console.log(`   Posted today: ${metrics.posting.posted_today}`);
    console.log(`   Success rate (24h): ${metrics.posting.success_rate_24h.toFixed(1)}%`);
    console.log(`   Avg time to post: ${metrics.posting.avg_time_to_post_minutes.toFixed(0)} minutes`);
    if (metrics.posting.placeholder_ids > 0) {
      console.log(`   ⚠️  Placeholder IDs: ${metrics.posting.placeholder_ids}`);
    }

    // Performance
    console.log('\n📈 PERFORMANCE:');
    console.log(`   Total replies tracked: ${metrics.performance.total_replies_tracked}`);
    console.log(`   Total followers gained: ${metrics.performance.total_followers_gained}`);
    console.log(`   Avg conversion: ${metrics.performance.avg_conversion_rate.toFixed(2)} followers/reply`);
    
    if (metrics.performance.top_tiers.length > 0) {
      console.log(`   Performance by tier:`);
      metrics.performance.top_tiers.forEach(t => 
        console.log(`      • ${t.tier}: ${t.avg_followers.toFixed(1)} followers/reply`)
      );
    }

    if (metrics.performance.top_accounts.length > 0) {
      console.log(`   Top accounts:`);
      metrics.performance.top_accounts.slice(0, 3).forEach(a => 
        console.log(`      • @${a.account}: ${a.conversion.toFixed(1)} followers/reply`)
      );
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`Last updated: ${new Date(metrics.health.last_updated).toLocaleString()}`);
    console.log('═'.repeat(80) + '\n');
  }
}

// Export singleton
export const replyDashboard = ReplySystemDashboard.getInstance();


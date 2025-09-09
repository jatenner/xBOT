/**
 * 🎯 OPENAI COST AUDIT DASHBOARD
 * Real-time dashboard for monitoring ALL OpenAI costs across the system
 */

import { openaiCostTracker, type CostSummary, type DailyCostTarget } from './openaiCostTracker';
import { getSafeDatabase } from '../lib/db';

export interface AuditReport {
  overview: {
    current_status: 'under_budget' | 'approaching_limit' | 'over_budget' | 'emergency_stop';
    daily_spend: number;
    daily_target: number;
    monthly_projection: number;
    efficiency_score: number; // 0-100 based on cost per operation vs targets
  };
  detailed_breakdown: {
    cost_per_post: number;
    cost_per_reply: number;
    cost_per_thread: number;
    posts_generated_today: number;
    replies_generated_today: number;
    threads_generated_today: number;
  };
  optimization_opportunities: Array<{
    area: string;
    current_cost: number;
    target_cost: number;
    potential_savings: number;
    recommendation: string;
  }>;
  cost_trends: {
    hourly_costs: Array<{ hour: string; cost: number; trend: 'up' | 'down' | 'stable' }>;
    daily_costs_week: Array<{ date: string; cost: number }>;
    model_efficiency: Array<{ model: string; cost_per_token: number; usage_percentage: number }>;
  };
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    action_required: boolean;
  }>;
}

export class CostAuditDashboard {
  private static instance: CostAuditDashboard;
  private db = getSafeDatabase();

  static getInstance(): CostAuditDashboard {
    if (!this.instance) {
      this.instance = new CostAuditDashboard();
    }
    return this.instance;
  }

  /**
   * 🎯 GENERATE COMPREHENSIVE AUDIT REPORT
   */
  async generateAuditReport(): Promise<AuditReport> {
    console.log('📊 GENERATING_AUDIT: Comprehensive OpenAI cost audit...');

    try {
      const [summary, target, operationCounts] = await Promise.all([
        openaiCostTracker.getCostSummary(),
        openaiCostTracker.getDailyCostTarget(),
        this.getOperationCounts()
      ]);

      // Calculate overview
      const overview = this.calculateOverview(summary, target);
      
      // Detailed breakdown
      const detailed_breakdown = {
        cost_per_post: summary.cost_per_post,
        cost_per_reply: summary.cost_per_reply,
        cost_per_thread: summary.cost_per_thread,
        posts_generated_today: operationCounts.posts_today,
        replies_generated_today: operationCounts.replies_today,
        threads_generated_today: operationCounts.threads_today
      };

      // Optimization opportunities
      const optimization_opportunities = this.findOptimizationOpportunities(summary, target, operationCounts);

      // Cost trends
      const cost_trends = this.analyzeCostTrends(summary);

      // Generate alerts
      const alerts = this.generateAlerts(summary, target, optimization_opportunities);

      const report: AuditReport = {
        overview,
        detailed_breakdown,
        optimization_opportunities,
        cost_trends,
        alerts
      };

      console.log(`✅ AUDIT_COMPLETE: Status ${overview.current_status}, Daily: $${overview.daily_spend.toFixed(4)}`);
      
      return report;

    } catch (error) {
      console.error('❌ AUDIT_GENERATION_ERROR:', error);
      throw error;
    }
  }

  /**
   * 📈 CALCULATE OVERVIEW METRICS
   */
  private calculateOverview(summary: CostSummary, target: DailyCostTarget): AuditReport['overview'] {
    let current_status: AuditReport['overview']['current_status'] = 'under_budget';
    
    if (target.current_daily_cost > target.target_daily_cost * 1.5) {
      current_status = 'emergency_stop';
    } else if (target.is_over_budget) {
      current_status = 'over_budget';
    } else if (target.current_daily_cost > target.target_daily_cost * 0.8) {
      current_status = 'approaching_limit';
    }

    // Calculate efficiency score (0-100)
    const post_efficiency = Math.max(0, 100 - ((summary.cost_per_post / 0.25) * 100 - 100));
    const reply_efficiency = Math.max(0, 100 - ((summary.cost_per_reply / 0.10) * 100 - 100));
    const thread_efficiency = Math.max(0, 100 - ((summary.cost_per_thread / 0.75) * 100 - 100));
    
    const efficiency_score = Math.round((post_efficiency + reply_efficiency + thread_efficiency) / 3);

    return {
      current_status,
      daily_spend: target.current_daily_cost,
      daily_target: target.target_daily_cost,
      monthly_projection: target.projected_monthly_cost,
      efficiency_score: Math.max(0, Math.min(100, efficiency_score))
    };
  }

  /**
   * 🔍 FIND OPTIMIZATION OPPORTUNITIES
   */
  private findOptimizationOpportunities(
    summary: CostSummary, 
    target: DailyCostTarget,
    operationCounts: any
  ): AuditReport['optimization_opportunities'] {
    const opportunities: AuditReport['optimization_opportunities'] = [];

    // Post generation optimization
    if (summary.cost_per_post > 0.25) {
      opportunities.push({
        area: 'Post Generation',
        current_cost: summary.cost_per_post,
        target_cost: 0.25,
        potential_savings: (summary.cost_per_post - 0.25) * operationCounts.posts_today,
        recommendation: summary.cost_per_post > 0.50 
          ? 'Switch to gpt-4o-mini for post generation to reduce costs by ~80%'
          : 'Optimize prompt length to reduce token usage'
      });
    }

    // Reply generation optimization  
    if (summary.cost_per_reply > 0.10) {
      opportunities.push({
        area: 'Reply Generation',
        current_cost: summary.cost_per_reply,
        target_cost: 0.10,
        potential_savings: (summary.cost_per_reply - 0.10) * operationCounts.replies_today,
        recommendation: summary.cost_per_reply > 0.20
          ? 'Use gpt-4o-mini for replies - replies don\'t need gpt-4o complexity'
          : 'Reduce reply length to save on completion tokens'
      });
    }

    // Thread generation optimization
    if (summary.cost_per_thread > 0.75) {
      opportunities.push({
        area: 'Thread Generation',
        current_cost: summary.cost_per_thread,
        target_cost: 0.75,
        potential_savings: (summary.cost_per_thread - 0.75) * operationCounts.threads_today,
        recommendation: summary.cost_per_thread > 1.50
          ? 'Consider hybrid approach: gpt-4o-mini for thread planning, gpt-4o only for final generation'
          : 'Limit thread length to 3-4 tweets maximum to control costs'
      });
    }

    // Model usage optimization
    const expensiveModels = summary.model_usage.filter(m => 
      m.model.includes('gpt-4') && !m.model.includes('mini') && m.requests > 10
    );
    
    if (expensiveModels.length > 0) {
      const totalExpensiveCost = expensiveModels.reduce((sum, m) => sum + m.total_cost, 0);
      opportunities.push({
        area: 'Model Selection',
        current_cost: totalExpensiveCost,
        target_cost: totalExpensiveCost * 0.3, // 70% savings with gpt-4o-mini
        potential_savings: totalExpensiveCost * 0.7,
        recommendation: `Switch ${expensiveModels.length} expensive model operations to gpt-4o-mini for 70% cost reduction`
      });
    }

    return opportunities.sort((a, b) => b.potential_savings - a.potential_savings);
  }

  /**
   * 📊 ANALYZE COST TRENDS
   */
  private analyzeCostTrends(summary: CostSummary): AuditReport['cost_trends'] {
    // Calculate hourly trends
    const hourly_costs = summary.hourly_breakdown.map((hour, index) => {
      const prevHour = index > 0 ? summary.hourly_breakdown[index - 1] : hour;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      
      if (hour.cost > prevHour.cost * 1.2) trend = 'up';
      else if (hour.cost < prevHour.cost * 0.8) trend = 'down';
      
      return {
        hour: hour.hour,
        cost: hour.cost,
        trend
      };
    });

    // Mock daily costs for the week (would come from actual data)
    const daily_costs_week = this.generateDailyCostsWeek(summary);

    // Model efficiency analysis
    const model_efficiency = summary.model_usage.map(model => {
      const totalRequests = summary.model_usage.reduce((sum, m) => sum + m.requests, 0);
      return {
        model: model.model,
        cost_per_token: model.avg_tokens > 0 ? model.total_cost / model.avg_tokens : 0,
        usage_percentage: Math.round((model.requests / totalRequests) * 100)
      };
    }).sort((a, b) => a.cost_per_token - b.cost_per_token);

    return {
      hourly_costs,
      daily_costs_week,
      model_efficiency
    };
  }

  /**
   * 🚨 GENERATE ALERTS
   */
  private generateAlerts(
    summary: CostSummary, 
    target: DailyCostTarget,
    opportunities: AuditReport['optimization_opportunities']
  ): AuditReport['alerts'] {
    const alerts: AuditReport['alerts'] = [];

    // Budget alerts
    if (target.is_over_budget) {
      alerts.push({
        severity: 'critical',
        message: `Daily budget exceeded: $${target.current_daily_cost.toFixed(2)} / $${target.target_daily_cost}`,
        action_required: true
      });
    } else if (target.current_daily_cost > target.target_daily_cost * 0.8) {
      alerts.push({
        severity: 'warning', 
        message: `Approaching daily budget limit: $${target.current_daily_cost.toFixed(2)} / $${target.target_daily_cost}`,
        action_required: false
      });
    }

    // Cost efficiency alerts
    if (summary.cost_per_post > 0.50) {
      alerts.push({
        severity: 'warning',
        message: `Post generation cost too high: $${summary.cost_per_post.toFixed(3)} per post (target: $0.25)`,
        action_required: true
      });
    }

    if (summary.cost_per_reply > 0.20) {
      alerts.push({
        severity: 'warning',
        message: `Reply generation cost too high: $${summary.cost_per_reply.toFixed(3)} per reply (target: $0.10)`,
        action_required: true
      });
    }

    // Optimization opportunities alert
    const totalSavings = opportunities.reduce((sum, opp) => sum + opp.potential_savings, 0);
    if (totalSavings > 2.00) {
      alerts.push({
        severity: 'info',
        message: `Potential daily savings of $${totalSavings.toFixed(2)} available through optimizations`,
        action_required: false
      });
    }

    // Model usage alerts
    const expensiveModelUsage = summary.model_usage
      .filter(m => m.model.includes('gpt-4') && !m.model.includes('mini'))
      .reduce((sum, m) => sum + m.total_cost, 0);
    
    if (expensiveModelUsage > summary.total_cost_today * 0.7) {
      alerts.push({
        severity: 'warning',
        message: `${Math.round((expensiveModelUsage / summary.total_cost_today) * 100)}% of costs from expensive models - consider gpt-4o-mini`,
        action_required: false
      });
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 3, warning: 2, info: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * 📊 GET OPERATION COUNTS FOR TODAY
   */
  private async getOperationCounts(): Promise<{
    posts_today: number;
    replies_today: number;
    threads_today: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // TODO: Implement proper query after database migration is complete
      console.warn('⚠️ OPERATION_COUNTS: Database table not available yet, using mock data');
      const data: any[] = []; // Will be populated after migration

      const counts = (data || []).reduce((acc, record) => {
        if (record.operation_type === 'post_generation') acc.posts_today++;
        else if (record.operation_type === 'reply_generation') acc.replies_today++;
        else if (record.operation_type === 'thread_generation') acc.threads_today++;
        return acc;
      }, { posts_today: 0, replies_today: 0, threads_today: 0 });

      return counts;
    } catch (error) {
      console.warn('⚠️ OPERATION_COUNTS_WARNING:', error);
      return { posts_today: 0, replies_today: 0, threads_today: 0 };
    }
  }

  /**
   * 📈 GENERATE DAILY COSTS FOR THE WEEK (MOCK DATA - REPLACE WITH REAL QUERY)
   */
  private generateDailyCostsWeek(summary: CostSummary): Array<{ date: string; cost: number }> {
    const costs = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Mock data - replace with actual Supabase query
      const cost = i === 0 ? summary.total_cost_today : Math.random() * 15;
      
      costs.push({
        date: date.toISOString().split('T')[0],
        cost: Number(cost.toFixed(2))
      });
    }
    
    return costs;
  }

  /**
   * 📋 GENERATE HUMAN-READABLE AUDIT REPORT
   */
  async generateTextReport(): Promise<string> {
    const report = await this.generateAuditReport();
    
    return `
🎯 OPENAI COST AUDIT DASHBOARD
=============================

📊 OVERVIEW:
Status: ${report.overview.current_status.toUpperCase()} ${this.getStatusEmoji(report.overview.current_status)}
Daily Spend: $${report.overview.daily_spend.toFixed(4)} / $${report.overview.daily_target} (${((report.overview.daily_spend / report.overview.daily_target) * 100).toFixed(1)}%)
Monthly Projection: $${report.overview.monthly_projection.toFixed(2)}
Efficiency Score: ${report.overview.efficiency_score}/100 ${this.getEfficiencyEmoji(report.overview.efficiency_score)}

💰 COST BREAKDOWN TODAY:
- Posts Generated: ${report.detailed_breakdown.posts_generated_today} ($${report.detailed_breakdown.cost_per_post.toFixed(4)} each)
- Replies Generated: ${report.detailed_breakdown.replies_generated_today} ($${report.detailed_breakdown.cost_per_reply.toFixed(4)} each)  
- Threads Generated: ${report.detailed_breakdown.threads_generated_today} ($${report.detailed_breakdown.cost_per_thread.toFixed(4)} each)

${report.optimization_opportunities.length > 0 ? `
🎯 OPTIMIZATION OPPORTUNITIES (Potential Savings: $${report.optimization_opportunities.reduce((sum, opp) => sum + opp.potential_savings, 0).toFixed(2)}):
${report.optimization_opportunities.slice(0, 3).map((opp, i) => 
  `${i + 1}. ${opp.area}: $${opp.potential_savings.toFixed(2)} savings\n   ${opp.recommendation}`
).join('\n')}
` : '✅ No major optimization opportunities found!'}

${report.alerts.length > 0 ? `
🚨 ALERTS:
${report.alerts.map(alert => 
  `${this.getAlertEmoji(alert.severity)} ${alert.message}${alert.action_required ? ' [ACTION REQUIRED]' : ''}`
).join('\n')}
` : '✅ No alerts - system operating efficiently!'}

📈 MODEL EFFICIENCY:
${report.cost_trends.model_efficiency.slice(0, 3).map(model => 
  `- ${model.model}: ${model.usage_percentage}% usage, $${(model.cost_per_token * 1000).toFixed(4)}/1K tokens`
).join('\n')}

Generated: ${new Date().toISOString()}
    `.trim();
  }

  private getStatusEmoji(status: string): string {
    const emojis = {
      under_budget: '✅',
      approaching_limit: '⚠️',
      over_budget: '🚨',
      emergency_stop: '🛑'
    };
    return emojis[status as keyof typeof emojis] || '❓';
  }

  private getEfficiencyEmoji(score: number): string {
    if (score >= 80) return '🟢';
    if (score >= 60) return '🟡';
    return '🔴';
  }

  private getAlertEmoji(severity: string): string {
    const emojis = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return emojis[severity as keyof typeof emojis] || '📝';
  }
}

// Export singleton instance
export const costAuditDashboard = CostAuditDashboard.getInstance();

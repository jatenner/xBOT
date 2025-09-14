/**
 * Dedicated Budget Status Endpoint
 * Provides detailed OpenAI spending analytics and monitoring
 */

import { Request, Response } from 'express';
import { budgetedOpenAI } from '../services/openaiBudgetedClient';

export interface BudgetStatusResponse {
  today_spend_usd: number;
  daily_limit_usd: number;
  blocked_requests_today: number;
  rollover_tz: string;
  redis_key: string;
  top_spenders: Array<{
    purpose: string;
    calls: number;
    cost_usd: number;
  }>;
  budget_alerts: {
    warning_threshold: number;
    critical_threshold: number;
    current_status: 'healthy' | 'warning' | 'critical' | 'blocked';
  };
  hourly_breakdown?: Array<{
    hour: number;
    spend_usd: number;
    calls: number;
  }>;
}

/**
 * GET /api/budget/status
 * Returns comprehensive budget status and analytics
 */
export async function getBudgetStatusEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const [status, spending] = await Promise.all([
      budgetedOpenAI.getBudgetStatus(),
      budgetedOpenAI.getSpendingBreakdown()
    ]);
    
    // Get blocked requests count from Redis
    const blockedCount = await getBlockedRequestsCount();
    
    // Determine current status
    let currentStatus: 'healthy' | 'warning' | 'critical' | 'blocked' = 'healthy';
    if (status.isBlocked) {
      currentStatus = 'blocked';
    } else if (status.percentUsed >= 95) {
      currentStatus = 'critical';
    } else if (status.percentUsed >= 80) {
      currentStatus = 'warning';
    }
    
    // Format top spenders
    const topSpenders = Object.entries(spending.byPurpose)
      .map(([purpose, data]) => ({
        purpose,
        calls: data.calls,
        cost_usd: Number(data.totalCost.toFixed(4))
      }))
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .slice(0, 10);
    
    const response: BudgetStatusResponse = {
      today_spend_usd: Number(status.usedTodayUSD.toFixed(4)),
      daily_limit_usd: status.dailyLimitUSD,
      blocked_requests_today: blockedCount,
      rollover_tz: process.env.COST_TRACKER_ROLLOVER_TZ || 'UTC',
      redis_key: `${process.env.REDIS_PREFIX || 'prod:'}openai_cost:${getTodayDateString()}`,
      top_spenders: topSpenders,
      budget_alerts: {
        warning_threshold: 80,
        critical_threshold: 95,
        current_status: currentStatus
      }
    };
    
    // Add hourly breakdown if requested
    if (req.query.hourly === 'true') {
      response.hourly_breakdown = await getHourlyBreakdown();
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ BUDGET_STATUS_ENDPOINT_ERROR:', error);
    res.status(500).json({
      error: 'Failed to retrieve budget status',
      today_spend_usd: 0,
      daily_limit_usd: parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5.0'),
      blocked_requests_today: 0,
      rollover_tz: 'UTC',
      redis_key: 'unavailable',
      top_spenders: [],
      budget_alerts: {
        warning_threshold: 80,
        critical_threshold: 95,
        current_status: 'healthy'
      }
    });
  }
}

/**
 * POST /api/budget/reset
 * Emergency budget reset (admin only)
 */
export async function resetBudgetEndpoint(req: Request, res: Response): Promise<void> {
  try {
    // Verify admin authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.includes(process.env.ADMIN_API_KEY || 'none')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL);
    
    const todayKey = `${process.env.REDIS_PREFIX || 'prod:'}openai_cost:${getTodayDateString()}`;
    const blockedKey = `${process.env.REDIS_PREFIX || 'prod:'}openai_blocked:${getTodayDateString()}`;
    
    await Promise.all([
      redis.del(todayKey),
      redis.del(`${todayKey}:calls`),
      redis.del(blockedKey)
    ]);
    
    console.log(`🔄 BUDGET_RESET: Emergency reset by admin (key: ${todayKey})`);
    
    res.json({
      success: true,
      message: 'Budget counters reset',
      reset_key: todayKey
    });
    
  } catch (error) {
    console.error('❌ BUDGET_RESET_ERROR:', error);
    res.status(500).json({ error: 'Failed to reset budget' });
  }
}

// Helper functions

async function getBlockedRequestsCount(): Promise<number> {
  try {
    // This would require tracking blocked requests in Redis
    // For now, return 0 - can be enhanced later
    return 0;
  } catch (error) {
    return 0;
  }
}

async function getHourlyBreakdown(): Promise<Array<{ hour: number; spend_usd: number; calls: number }>> {
  try {
    const { supaService } = await import('../db/supabaseService');
    const today = getTodayDateString();
    
    const { data: records } = await supaService
      .from('api_usage')
      .select('created_at, cost_usd')
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)
      .order('created_at', { ascending: true });
    
    if (!records) return [];
    
    // Group by hour
    const hourlyData: Record<number, { spend_usd: number; calls: number }> = {};
    
    records.forEach(record => {
      const hour = new Date(record.created_at).getUTCHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = { spend_usd: 0, calls: 0 };
      }
      hourlyData[hour].spend_usd += record.cost_usd;
      hourlyData[hour].calls += 1;
    });
    
    // Convert to array format
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      spend_usd: Number((hourlyData[hour]?.spend_usd || 0).toFixed(4)),
      calls: hourlyData[hour]?.calls || 0
    }));
    
  } catch (error) {
    console.error('❌ HOURLY_BREAKDOWN_ERROR:', error);
    return [];
  }
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

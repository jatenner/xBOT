/**
 * 🧠 LEARN STATUS ENDPOINT
 * Provides learning system status and performance metrics
 */

import { Request, Response } from 'express';

export interface LearnStatus {
  // Learning overview
  mode: 'shadow' | 'live';
  last_run: string;
  next_run_estimate: string;
  
  // Training data
  training_samples_available: number;
  real_outcomes_count: number;
  simulated_outcomes_count: number;
  
  // Bandit arms performance
  content_arms: Array<{
    arm_name: string;
    successes: number;
    trials: number;
    success_rate: number;
    confidence_interval: [number, number];
  }>;
  
  timing_arms: Array<{
    slot: number;
    avg_reward: number;
    trials: number;
    ucb_score: number;
  }>;
  
  // Predictor status
  predictor: {
    version: string;
    last_trained: string;
    feature_count: number;
    accuracy_score?: number;
    training_samples_used: number;
  };
  
  // Performance insights
  top_performing_content_type: string;
  best_timing_slot: number;
  current_explore_ratio: number;
  
  // Recent improvements
  er_trend_7d: number; // % change
  engagement_momentum: 'increasing' | 'stable' | 'decreasing';
}

export async function getLearnStatus(req: Request, res: Response): Promise<void> {
  try {
    const { getConfig } = await import('../config/config');
    const config = getConfig();
    
    // Get learning metrics from various sources
    const banditStats = await getBanditStatus();
    const predictorStats = await getPredictorStatus();
    const trainingDataStats = await getTrainingDataStats();
    
    const status: LearnStatus = {
      mode: config.MODE,
      last_run: await getLastLearnRun(),
      next_run_estimate: estimateNextRun(),
      
      training_samples_available: trainingDataStats.total,
      real_outcomes_count: trainingDataStats.real,
      simulated_outcomes_count: trainingDataStats.simulated,
      
      content_arms: banditStats.content_arms,
      timing_arms: banditStats.timing_arms,
      
      predictor: predictorStats,
      
      top_performing_content_type: banditStats.top_content_type,
      best_timing_slot: banditStats.best_timing_slot,
      current_explore_ratio: banditStats.explore_ratio,
      
      er_trend_7d: await calculateERTrend(),
      engagement_momentum: await calculateMomentum()
    };
    
    res.json(status);
    
  } catch (error: any) {
    console.error('[LEARN_STATUS] ❌ Failed to get learn status:', error.message);
    res.status(500).json({ 
      error: 'Failed to get learning status',
      details: error.message 
    });
  }
}

async function getBanditStatus() {
  // Mock bandit status - in real implementation would query bandit_arms table
  return {
    content_arms: [
      { arm_name: 'educational', successes: 15, trials: 20, success_rate: 0.75, confidence_interval: [0.65, 0.85] as [number, number] },
      { arm_name: 'wellness_tip', successes: 12, trials: 18, success_rate: 0.67, confidence_interval: [0.55, 0.79] as [number, number] },
      { arm_name: 'fact_sharing', successes: 8, trials: 15, success_rate: 0.53, confidence_interval: [0.39, 0.67] as [number, number] }
    ],
    timing_arms: [
      { slot: 14, avg_reward: 0.031, trials: 8, ucb_score: 1.45 },
      { slot: 16, avg_reward: 0.038, trials: 12, ucb_score: 1.52 },
      { slot: 18, avg_reward: 0.042, trials: 15, ucb_score: 1.48 }
    ],
    top_content_type: 'educational',
    best_timing_slot: 18,
    explore_ratio: 0.224
  };
}

async function getPredictorStatus() {
  // Mock predictor status - in real implementation would check Redis and DB
  return {
    version: 'v2',
    last_trained: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    feature_count: 12,
    accuracy_score: 0.73,
    training_samples_used: 45
  };
}

async function getTrainingDataStats() {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Get counts of real vs simulated outcomes
    const { count: realCount } = await supabase
      .from('outcomes')
      .select('*', { count: 'exact', head: true })
      .eq('simulated', false);
      
    const { count: simulatedCount } = await supabase
      .from('outcomes')
      .select('*', { count: 'exact', head: true })
      .eq('simulated', true);
    
    return {
      total: (realCount || 0) + (simulatedCount || 0),
      real: realCount || 0,
      simulated: simulatedCount || 0
    };
  } catch (error) {
    return { total: 0, real: 0, simulated: 0 };
  }
}

async function getLastLearnRun(): Promise<string> {
  // Mock - in real implementation would check job manager or database
  return new Date(Date.now() - 45 * 60 * 1000).toISOString(); // 45 minutes ago
}

function estimateNextRun(): string {
  // Learning runs every 2 hours
  const nextRun = new Date(Date.now() + 75 * 60 * 1000); // 75 minutes from now
  return nextRun.toISOString();
}

async function calculateERTrend(): Promise<number> {
  // Mock ER trend calculation - in real implementation would compare 7d windows
  return 5.2; // +5.2% improvement over last 7 days
}

async function calculateMomentum(): Promise<'increasing' | 'stable' | 'decreasing'> {
  // Mock momentum calculation
  const trend = await calculateERTrend();
  if (trend > 2) return 'increasing';
  if (trend < -2) return 'decreasing';
  return 'stable';
}
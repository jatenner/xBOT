/**
 * 📊 SHADOW OUTCOMES JOB
 * Simulates engagement outcomes for shadow mode learning
 */

import { getConfig } from '../config/config';

export async function simulateOutcomes(): Promise<void> {
  console.log('[SHADOW_OUTCOMES] 📊 Starting shadow outcomes simulation...');
  
  try {
    // Find recent decisions without outcomes
    const recentDecisions = await findDecisionsNeedingOutcomes();
    
    if (recentDecisions.length === 0) {
      console.log('[SHADOW_OUTCOMES] ℹ️ No recent decisions need synthetic outcomes');
      return;
    }
    
    // Simulate realistic engagement metrics
    const simulatedOutcomes = await simulateEngagementMetrics(recentDecisions);
    
    // Store simulated outcomes in database
    await storeSimulatedOutcomes(simulatedOutcomes);
    
    console.log(`[SHADOW_OUTCOMES] ✅ Simulated outcomes for ${simulatedOutcomes.length} decisions`);
  } catch (error) {
    console.error('[SHADOW_OUTCOMES] ❌ Shadow outcomes simulation failed:', error.message);
    throw error;
  }
}

async function findDecisionsNeedingOutcomes(): Promise<any[]> {
  console.log('[SHADOW_OUTCOMES] 🔍 Finding recent decisions without outcomes...');
  
  // Mock recent decisions that need outcomes
  // In real implementation, this would query the database for recent content
  // that doesn't have engagement metrics yet
  
  const mockDecisions = [
    {
      id: 'decision_1',
      content: 'Health tip about hydration',
      quality_score: 0.82,
      predicted_er: 0.034,
      format: 'educational',
      posted_at: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    },
    {
      id: 'decision_2', 
      content: 'Sleep schedule fact sharing',
      quality_score: 0.91,
      predicted_er: 0.041,
      format: 'fact_sharing',
      posted_at: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
    },
    {
      id: 'decision_3',
      content: 'Mental health wellness tip',
      quality_score: 0.88,
      predicted_er: 0.037,
      format: 'wellness_tip',
      posted_at: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
    }
  ];
  
  console.log(`[SHADOW_OUTCOMES] 📋 Found ${mockDecisions.length} decisions needing outcomes`);
  return mockDecisions;
}

async function simulateEngagementMetrics(decisions: any[]): Promise<any[]> {
  console.log('[SHADOW_OUTCOMES] 🎲 Simulating realistic engagement metrics...');
  
  const simulatedOutcomes = decisions.map(decision => {
    // Simulate engagement based on quality score and content type
    const baseEngagement = decision.quality_score * 100; // Base impressions
    const variation = 0.3; // 30% random variation
    
    // Add realistic randomness while respecting quality predictions
    const randomFactor = 1 + (Math.random() - 0.5) * variation;
    
    const impressions = Math.floor(baseEngagement * 50 * randomFactor);
    const engagementRate = decision.predicted_er * randomFactor;
    const likes = Math.floor(impressions * engagementRate * 0.7);
    const retweets = Math.floor(impressions * engagementRate * 0.15);
    const replies = Math.floor(impressions * engagementRate * 0.1);
    const bookmarks = Math.floor(impressions * engagementRate * 0.05);
    
    return {
      decision_id: decision.id,
      content: decision.content,
      simulated: true,
      
      // Engagement metrics
      impressions,
      likes,
      retweets,
      replies,
      bookmarks,
      engagement_rate: engagementRate,
      
      // Performance scores
      viral_score: likes + (retweets * 2) + (replies * 3),
      quality_match: Math.abs(engagementRate - decision.predicted_er) < 0.01 ? 'good' : 'needs_tuning',
      
      // Metadata
      measured_at: new Date(),
      hours_since_post: Math.floor((Date.now() - decision.posted_at.getTime()) / (1000 * 60 * 60))
    };
  });
  
  // Log simulated outcomes
  simulatedOutcomes.forEach(outcome => {
    console.log(`[SHADOW_OUTCOMES] 📈 ${outcome.decision_id}:`);
    console.log(`[SHADOW_OUTCOMES]    Impressions: ${outcome.impressions.toLocaleString()}`);
    console.log(`[SHADOW_OUTCOMES]    Engagement: ${outcome.likes}L, ${outcome.retweets}RT, ${outcome.replies}R`);
    console.log(`[SHADOW_OUTCOMES]    ER: ${(outcome.engagement_rate * 100).toFixed(2)}% (${outcome.quality_match})`);
  });
  
  return simulatedOutcomes;
}

async function storeSimulatedOutcomes(outcomes: any[]): Promise<void> {
  console.log('[SHADOW_OUTCOMES] 💾 Storing simulated outcomes in database...');
  
  // Store simulated outcomes in unified outcomes table
  const { storeUnifiedOutcome } = await import('./outcomeWriter');
  
  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    
    await storeUnifiedOutcome({
      decision_id: `decision_${i + 1}`, // In real system, would use actual decision IDs from unified_ai_intelligence
      tweet_id: undefined, // No real tweet for shadow mode
      impressions: outcome.impressions,
      likes: outcome.likes,
      retweets: outcome.retweets,
      replies: outcome.replies,
      bookmarks: Math.floor(outcome.likes * 0.1), // Estimate bookmarks
      er_calculated: outcome.er,
      followers_delta_24h: Math.floor(outcome.likes * 0.02), // Estimate follower gain
      viral_score: outcome.er > 0.04 ? 85 : outcome.er > 0.03 ? 65 : 45,
      simulated: true, // Mark as simulated data
      collected_at: new Date()
    });
  }
  
  console.log(`[SHADOW_OUTCOMES] 📝 Stored ${outcomes.length} simulated outcomes`);
  
  // Mock storage delay
  await new Promise(resolve => setTimeout(resolve, 500));
}

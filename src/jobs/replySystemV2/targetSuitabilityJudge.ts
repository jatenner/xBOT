/**
 * 🎯 TARGET SUITABILITY JUDGE (Tier A)
 * 
 * Lightweight LLM judge that evaluates candidate tweets for reply suitability
 * Outputs structured JSON with multiple signals
 */

import { getSupabaseClient } from '../../db/index';
import { logLLMUsage, extractTokenUsage } from '../../services/llmCostLogger';
import { createBudgetedChatCompletion } from '../../services/openaiBudgetedClient';

export interface JudgeDecision {
  relevance: number; // 0-1: How relevant to health/fitness topic
  replyability: number; // 0-1: How suitable for generating a reply
  momentum: number; // 0-1: Engagement velocity signal
  audience_fit: number; // 0-1: Alignment with our audience
  spam_risk: number; // 0-1: Risk of spam/low-quality (lower is better)
  /** 0-1: How natural/credible a health/performance reply angle is (broad viral needs this). */
  health_angle_fit?: number;
  expected_views_bucket: 'low' | 'medium' | 'high' | 'viral'; // Expected view range
  topic_category?: string; // Primary health topic classification
  decision: 'accept' | 'reject' | 'explore'; // Final decision
  reasons: string; // Human-readable explanation
}

/**
 * Judge a candidate tweet for reply suitability
 */
export async function judgeTargetSuitability(
  tweetId: string,
  authorUsername: string,
  content: string,
  likeCount: number,
  replyCount: number,
  retweetCount: number,
  postedAt: string,
  traceIds?: { candidate_id?: string; feed_run_id?: string }
): Promise<JudgeDecision> {
  const supabase = getSupabaseClient();
  
  // Calculate age in minutes
  const postedTime = new Date(postedAt).getTime();
  const ageMinutes = Math.max(1, (Date.now() - postedTime) / (1000 * 60));
  const velocity = (likeCount + replyCount + retweetCount) / ageMinutes;
  
  // Get current control plane state for adaptive threshold
  const { data: controlState } = await supabase
    .from('control_plane_state')
    .select('acceptance_threshold, exploration_rate')
    .is('expires_at', null)
    .order('effective_at', { ascending: false })
    .limit(1)
    .single();
  
  const acceptanceThreshold = controlState?.acceptance_threshold || 0.60;
  const explorationRate = controlState?.exploration_rate || 0.10;
  
  const prompt = `You are evaluating whether @Neurix5 (a neuroscience/health expert) can write a valuable reply to this tweet.

CRITICAL: Health connects to EVERYTHING. Sports = performance science. Travel = circadian disruption. Politics = public health. Food = nutrition. Work stress = cortisol. Sleep = brain function. Tech = health implications. You should almost ALWAYS find an angle.

Tweet ID: ${tweetId}
Author: @${authorUsername}
Content: ${content.substring(0, 500)}
Engagement: ${likeCount} likes, ${replyCount} replies, ${retweetCount} retweets
Age: ${Math.round(ageMinutes)} minutes

Return JSON:
{
  "relevance": <0-1>, // Can we add a health/science angle? Basketball=0.7 (sports science), cooking=0.9 (nutrition), politics=0.5 (stress/policy), pure meme=0.2
  "replyability": <0-1>, // Can we write a short, specific, valuable reply? Questions and controversial takes are great.
  "momentum": <0-1>, // Engagement velocity (>10/min=1.0, >1/min=0.5, else velocity/10)
  "audience_fit": <0-1>, // Would the author's followers care about a health angle?
  "spam_risk": <0-1>, // 0=quality, 1=spam/bot
  "health_angle_fit": <0-1>, // How natural is the health connection? Direct health=1.0, sports/food=0.8, travel/work=0.6, politics=0.5, pure entertainment=0.2
  "expected_views_bucket": "<low|medium|high|viral>",
  "topic_category": "<sleep|nutrition|exercise|mental_health|longevity|stress|metabolism|recovery|neuroscience|performance|general_health|lifestyle|off_topic>",
  "decision": "<accept|reject|explore>",
  "reasons": "<brief explanation>"
}

Rules:
- health_angle_fit >= 0.4 AND replyability >= 0.4 AND spam_risk < 0.4 => accept
- spam_risk >= 0.6 OR (relevance < 0.15 AND health_angle_fit < 0.2) => reject
- Otherwise => explore

Be GENEROUS with accept. We're a new account that needs to post replies to grow. Only reject truly impossible angles (pure memes, foreign language, spam).

Return ONLY valid JSON.`;

  const startTime = Date.now();
  
  try {
    const response = await createBudgetedChatCompletion(
      {
        model: 'gpt-4o-mini', // Lightweight model for fast, cheap judgments
        messages: [
          { role: 'system', content: 'You are a Twitter engagement expert. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3, // Low temperature for consistent judgments
        max_tokens: 300,
        response_format: { type: 'json_object' }
      },
      {
        purpose: 'target_judge',
        requestId: `judge_${tweetId}_${Date.now()}`,
        priority: 'medium'
      }
    );
    
    const latency_ms = Date.now() - startTime;
    const usage = extractTokenUsage(response);
    
    // Log LLM usage
    await logLLMUsage({
      model: 'gpt-4o-mini',
      purpose: 'target_judge',
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      latency_ms,
      trace_ids: {
        candidate_id: traceIds?.candidate_id || tweetId,
        feed_run_id: traceIds?.feed_run_id || '',
      },
      request_metadata: {
        tweet_id: tweetId,
        author: authorUsername,
        velocity,
      }
    });
    
    // Parse JSON response
    const content = response.choices[0]?.message?.content || '{}';
    let decision: JudgeDecision;
    
    try {
      decision = JSON.parse(content);
    } catch (parseError) {
      // Fallback: try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        decision = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`Failed to parse judge response: ${content}`);
      }
    }
    
    // Validate decision structure
    if (!decision.decision || decision.relevance === undefined) {
      throw new Error(`Invalid judge response structure: ${JSON.stringify(decision)}`);
    }
    if (decision.health_angle_fit == null) decision.health_angle_fit = decision.relevance;

    // Apply adaptive threshold with exploration
    const finalDecision = applyAdaptiveThreshold(decision, acceptanceThreshold, explorationRate);
    
    console.log(`[JUDGE] ✅ ${tweetId}: decision=${finalDecision.decision} relevance=${finalDecision.relevance.toFixed(2)} replyability=${finalDecision.replyability.toFixed(2)}`);
    
    return finalDecision;
    
  } catch (error: any) {
    const latency_ms = Date.now() - startTime;
    const msg = error?.message ?? String(error);

    await logLLMUsage({
      model: 'gpt-4o-mini',
      purpose: 'target_judge',
      input_tokens: 0,
      output_tokens: 0,
      latency_ms,
      trace_ids: traceIds || {},
      request_metadata: { error: msg }
    });

    console.error(`[JUDGE] ❌ Error judging ${tweetId}: ${msg}`);

    // 429 / quota / rate-limit: throw so caller can fall back to heuristic scoring (do not hard-reject with 0/0)
    const isRateLimitOrQuota =
      msg.includes('429') ||
      /quota|rate limit|rate_limit/i.test(msg) ||
      (error?.status !== undefined && Number(error.status) === 429);
    if (isRateLimitOrQuota) {
      console.warn(`[JUDGE] ⚠️ Judge API rate-limit/quota (429) - caller should use heuristic fallback for ${tweetId}`);
      throw error;
    }

    // Other errors: return conservative rejection (unchanged)
    return {
      relevance: 0,
      replyability: 0,
      momentum: 0,
      audience_fit: 0,
      spam_risk: 1.0,
      health_angle_fit: 0,
      expected_views_bucket: 'low',
      decision: 'reject',
      reasons: `Judge error: ${msg}`
    };
  }
}

/**
 * Apply adaptive threshold with exploration rate
 */
function applyAdaptiveThreshold(
  decision: JudgeDecision,
  acceptanceThreshold: number,
  explorationRate: number
): JudgeDecision {
  // Use health_angle_fit as primary signal (can we ADD a health angle?)
  // Not relevance (is this ABOUT health?) — health connects to everything
  const healthAngle = decision.health_angle_fit ?? decision.relevance;

  // Calculate composite score — health_angle_fit weighted highest
  const compositeScore = (
    healthAngle * 0.35 +
    decision.replyability * 0.30 +
    decision.momentum * 0.15 +
    decision.audience_fit * 0.20
  ) - (decision.spam_risk * 0.4);

  // Hard rejections: only spam or truly zero health connection
  if (decision.spam_risk >= 0.6 || (decision.relevance < 0.1 && healthAngle < 0.15)) {
    return { ...decision, decision: 'reject' };
  }

  // Accept if above threshold (lowered from 0.6 default to 0.35 for bootstrap)
  const effectiveThreshold = Math.min(acceptanceThreshold, 0.35);
  if (compositeScore >= effectiveThreshold) {
    return { ...decision, decision: 'accept' };
  }

  // Exploration: randomly accept borderline candidates (generous at bootstrap)
  if (Math.random() < Math.max(explorationRate, 0.25) && compositeScore >= effectiveThreshold * 0.6) {
    return { ...decision, decision: 'explore' };
  }

  // Default: reject
  return { ...decision, decision: 'reject' };
}


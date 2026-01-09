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
  expected_views_bucket: 'low' | 'medium' | 'high' | 'viral'; // Expected view range
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
  
  const prompt = `You are a Twitter/X engagement expert evaluating a tweet for reply suitability.

Tweet ID: ${tweetId}
Author: @${authorUsername}
Content: ${content.substring(0, 500)}
Engagement: ${likeCount} likes, ${replyCount} replies, ${retweetCount} retweets
Age: ${Math.round(ageMinutes)} minutes
Velocity: ${velocity.toFixed(2)} engagements/minute

Evaluate this tweet and return a JSON object with these exact fields:
{
  "relevance": <0-1>, // How relevant to health/fitness/nutrition/wellness topics
  "replyability": <0-1>, // How suitable for generating an insightful reply (consider: is it a question? controversial? informative?)
  "momentum": <0-1>, // Engagement velocity signal (normalize velocity: >10/min = 1.0, >1/min = 0.5, else = velocity/10)
  "audience_fit": <0-1>, // Alignment with health-conscious audience (consider author credibility, topic fit)
  "spam_risk": <0-1>, // Risk of spam/low-quality (0 = high quality, 1 = spam)
  "expected_views_bucket": "<low|medium|high|viral>", // Expected 24h view range (low: <500, medium: 500-2000, high: 2000-10000, viral: >10000)
  "decision": "<accept|reject|explore>", // accept = high quality, reject = low quality/spam, explore = borderline (use exploration_rate)
  "reasons": "<brief explanation>"
}

Rules:
- relevance >= 0.6 AND replyability >= 0.5 AND spam_risk < 0.3 => accept
- spam_risk >= 0.5 OR relevance < 0.3 => reject
- Otherwise => explore (for exploration_rate candidates)

Return ONLY valid JSON, no markdown, no explanation.`;

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
    
    // Apply adaptive threshold with exploration
    const finalDecision = applyAdaptiveThreshold(decision, acceptanceThreshold, explorationRate);
    
    console.log(`[JUDGE] ✅ ${tweetId}: decision=${finalDecision.decision} relevance=${finalDecision.relevance.toFixed(2)} replyability=${finalDecision.replyability.toFixed(2)}`);
    
    return finalDecision;
    
  } catch (error: any) {
    const latency_ms = Date.now() - startTime;
    
    // Log error
    await logLLMUsage({
      model: 'gpt-4o-mini',
      purpose: 'target_judge',
      input_tokens: 0,
      output_tokens: 0,
      latency_ms,
      trace_ids: traceIds || {},
      request_metadata: { error: error.message }
    });
    
    console.error(`[JUDGE] ❌ Error judging ${tweetId}: ${error.message}`);
    
    // Fail-safe: return conservative rejection
    return {
      relevance: 0,
      replyability: 0,
      momentum: 0,
      audience_fit: 0,
      spam_risk: 1.0,
      expected_views_bucket: 'low',
      decision: 'reject',
      reasons: `Judge error: ${error.message}`
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
  // Calculate composite score
  const compositeScore = (
    decision.relevance * 0.3 +
    decision.replyability * 0.3 +
    decision.momentum * 0.2 +
    decision.audience_fit * 0.2
  ) - (decision.spam_risk * 0.5); // Penalize spam
  
  // Hard rejections (never override)
  if (decision.spam_risk >= 0.5 || decision.relevance < 0.2) {
    return { ...decision, decision: 'reject' };
  }
  
  // Accept if above threshold
  if (compositeScore >= acceptanceThreshold) {
    return { ...decision, decision: 'accept' };
  }
  
  // Exploration: randomly accept some candidates below threshold
  if (Math.random() < explorationRate && compositeScore >= acceptanceThreshold * 0.7) {
    return { ...decision, decision: 'explore' };
  }
  
  // Default: reject
  return { ...decision, decision: 'reject' };
}


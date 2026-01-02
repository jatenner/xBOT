/**
 * 🎯 REPLY VISIBILITY RANKER
 * Filters and ranks reply candidates for maximum visibility
 */

export interface RankedCandidate {
  tweetId: string;
  score: number;
  ageMinutes: number;
  likes: number;
  replies: number;
  reposts: number;
  velocity: number;
  decision: 'keep' | 'skip';
  reason: string;
}

/**
 * Calculate velocity score (engagement per hour)
 */
function calculateVelocity(
  likes: number,
  replies: number,
  reposts: number,
  ageMinutes: number
): number {
  if (ageMinutes <= 0) return 0;
  
  const totalEngagement = likes + (replies * 2) + (reposts * 3);
  const ageHours = ageMinutes / 60;
  
  return totalEngagement / Math.max(ageHours, 0.1);
}

/**
 * Rank and filter reply candidates for visibility
 */
export function rankReplyCandidate(
  tweetId: string,
  ageMinutes: number,
  likes: number = 0,
  replies: number = 0,
  reposts: number = 0
): RankedCandidate {
  const velocity = calculateVelocity(likes, replies, reposts, ageMinutes);
  
  // RULE 1: Skip if too old and low engagement
  if (ageMinutes > 180 && likes < 1000) {
    console.log(`[REPLY_RANK] candidate=${tweetId} age_min=${ageMinutes} metrics=likes:${likes} score=0 decision=skip reason=too_old_low_engagement`);
    return {
      tweetId,
      score: 0,
      ageMinutes,
      likes,
      replies,
      reposts,
      velocity,
      decision: 'skip',
      reason: 'too_old_low_engagement',
    };
  }
  
  // RULE 2: Skip if dead (all metrics near zero and older than 60min)
  if (ageMinutes > 60 && likes < 100 && replies < 10 && reposts < 5) {
    console.log(`[REPLY_RANK] candidate=${tweetId} age_min=${ageMinutes} metrics=likes:${likes},replies:${replies},reposts:${reposts} score=0 decision=skip reason=dead_thread`);
    return {
      tweetId,
      score: 0,
      ageMinutes,
      likes,
      replies,
      reposts,
      velocity,
      decision: 'skip',
      reason: 'dead_thread',
    };
  }
  
  // RULE 3: Prefer recent OR high velocity
  let score = 0;
  
  // Recency bonus (decays after 2 hours)
  if (ageMinutes <= 120) {
    score += (120 - ageMinutes) / 120 * 50; // Max 50 points for fresh tweets
  }
  
  // Velocity bonus
  if (velocity > 100) {
    score += Math.min(velocity / 10, 50); // Max 50 points for high velocity
  }
  
  // Engagement bonus
  score += Math.min(likes / 100, 30); // Max 30 points for likes
  score += Math.min(replies / 5, 10); // Max 10 points for replies
  score += Math.min(reposts / 2, 10); // Max 10 points for reposts
  
  const decision = score >= 30 ? 'keep' : 'skip';
  const reason = decision === 'keep' 
    ? `score=${score.toFixed(1)} velocity=${velocity.toFixed(1)}`
    : 'score_too_low';
  
  console.log(`[REPLY_RANK] candidate=${tweetId} age_min=${ageMinutes} metrics=likes:${likes},replies:${replies},reposts:${reposts} velocity=${velocity.toFixed(1)} score=${score.toFixed(1)} decision=${decision} reason=${reason}`);
  
  return {
    tweetId,
    score,
    ageMinutes,
    likes,
    replies,
    reposts,
    velocity,
    decision,
    reason,
  };
}

/**
 * Sort candidates by score (highest first)
 */
export function sortByScore(candidates: RankedCandidate[]): RankedCandidate[] {
  return candidates
    .filter(c => c.decision === 'keep')
    .sort((a, b) => b.score - a.score);
}


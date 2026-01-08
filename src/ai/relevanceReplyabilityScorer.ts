/**
 * 🎯 RELEVANCE & REPLYABILITY SCORER
 * 
 * Computes relevance_score (0-1) and replyability_score (0-1) for reply opportunities
 * Lightweight, deterministic, no model calls
 */

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH KEYWORDS (for relevance scoring)
// ═══════════════════════════════════════════════════════════════════════════

const HEALTH_KEYWORDS = [
  // Core health topics
  'fitness', 'training', 'workout', 'exercise', 'gym', 'strength', 'cardio', 'hiit',
  'nutrition', 'diet', 'protein', 'carbs', 'calories', 'macros', 'meal', 'eating',
  'sleep', 'recovery', 'rest', 'circadian', 'insomnia', 'melatonin',
  'longevity', 'aging', 'lifespan', 'healthspan', 'anti-aging',
  'metabolism', 'metabolic', 'mitochondria', 'cellular',
  'hormones', 'testosterone', 'estrogen', 'cortisol', 'insulin', 'thyroid',
  'gut', 'microbiome', 'digestion', 'probiotics', 'fiber',
  'supplements', 'vitamin', 'mineral', 'omega', 'magnesium', 'zinc', 'iron',
  'labs', 'blood', 'glucose', 'cholesterol', 'a1c', 'hrv', 'vo2', 'bmi',
  'habits', 'routine', 'protocol', 'biohacking', 'optimization',
  'mental health', 'anxiety', 'stress', 'depression', 'focus', 'memory',
  'inflammation', 'immune', 'autoimmune', 'chronic pain',
  'fasting', 'keto', 'carnivore', 'vegan', 'paleo',
  'research', 'study', 'clinical', 'trial', 'evidence', 'data',
];

// Off-topic keywords (penalize unless seed is in allowlist)
const OFF_TOPIC_KEYWORDS = [
  'crypto', 'bitcoin', 'ethereum', 'nft', 'web3', 'blockchain',
  'trump', 'biden', 'election', 'politics', 'democrat', 'republican',
  'stock', 'trading', 'invest', 'finance', 'market',
  'gaming', 'streaming', 'movie', 'tv show',
];

// Health authority allowlist (broader topics allowed, also used for gate exemptions)
export const HEALTH_AUTHORITY_ALLOWLIST = new Set([
  'hubermanlab', 'foundmyfitness', 'peterattiamd', 'bengreenfield',
  'jeff_nippard', 'biolayne', 'drandygalpin', 'drericberg',
  'thefitnesschef_', 'nicknorwitzphd', 'drgundry',
  'who', 'cdcgov', 'nih', // Health organizations
]);

// ═══════════════════════════════════════════════════════════════════════════
// REPLYABILITY PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

// Positive signals (increase replyability) - legacy, kept for compatibility
const REPLYABILITY_POSITIVE = [
  /\?/, // Question marks
  /\b(what do you think|what's your take|your thoughts|opinion|hot take)\b/i,
  /\b(agree|disagree|thoughts|perspective|view)\b/i,
  /\b(should|would|could|might)\b/i, // Advice-seeking
  /\b(poll|vote|choose|pick)\b/i,
  /\b(controversial|debate|discuss|argument)\b/i,
  /\b(prove|wrong|false|myth|fact)\b/i, // Claims that invite pushback
];

// Additional reply hooks for health Twitter (enhanced)
const REPLYABILITY_HOOKS = {
  question: {
    pattern: /\?|(what do you think|thoughts|opinion|agree|disagree|anyone else)/i,
    boost: 0.25,
    name: 'question_or_opinion_seeking',
  },
  controversy: {
    pattern: /\b(hot take|unpopular opinion|controversial|debate)\b/i,
    boost: 0.15,
    name: 'controversy_or_debate',
  },
  mindChange: {
    pattern: /\b(I used to think|I thought|changed my mind|mistake I made|I was wrong|I learned)\b/i,
    boost: 0.15,
    name: 'mind_change_or_learning',
  },
  protocol: {
    pattern: /\b(steps?|protocol|routine|checklist|framework|how to|do this|try this|here's how|here are \d+)\b/i,
    boost: 0.12,
    name: 'protocol_or_steps',
  },
  claimWithEvidence: {
    pattern: /\b(\d+%|\d+\s*(mg|mcg|g|grams?|iu|hours?|days?|weeks?|months?)|risk|hazard ratio|odds ratio|meta-analysis|randomized|trial|study|evidence)\b/i,
    boost: 0.10,
    name: 'claim_with_evidence',
  },
};

// Negative signals (decrease replyability)
const REPLYABILITY_NEGATIVE = [
  /\b(link in bio|check out|subscribe|follow me|swipe|link below)\b/i,
  /\b(exclusive partner|proud to announce|we're honored|partnership|sponsored)\b/i,
  /\b(announcing|launching|dropping|minting|giveaway|contest)\b/i,
  /\b(we're excited|thrilled|delighted|proud to)\b/i, // Corporate PR
  /^https?:\/\//, // Link-only posts
];

// Strengthened negative signals (stronger penalties)
const REPLYABILITY_NEGATIVE_STRONG = [
  /\b(giveaway|contest|win|prize|free|exclusive partner|sponsored|use code|sign up|webinar|register)\b/i,
  /\b(link in bio|check out|subscribe|follow me|swipe|link below)\b/i,
  /\b(we're excited|thrilled|delighted|proud to announce|we're honored|partnership)\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════
// SENSITIVE TOPICS (block completely)
// ═══════════════════════════════════════════════════════════════════════════

const SENSITIVE_KEYWORDS = [
  'death', 'died', 'killed', 'murder', 'suicide', 'kms', 'kill myself',
  'shooting', 'bombing', 'terrorist', 'attack', 'massacre',
  'tragedy', 'disaster', 'catastrophe', 'crisis',
  'cancer', 'terminal', 'funeral', 'mourning',
];

// ═══════════════════════════════════════════════════════════════════════════
// SCORING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface RelevanceReplyabilityScores {
  relevance_score: number; // 0-1
  replyability_score: number; // 0-1
  disallowed_reason?: string; // If tweet should be blocked
}

/**
 * Compute relevance_score (0-1) based on health keywords and author
 */
export function computeRelevanceScore(
  tweetText: string,
  authorHandle: string
): number {
  const textLower = tweetText.toLowerCase();
  let score = 0;
  
  // Count health keyword matches
  let healthMatches = 0;
  for (const keyword of HEALTH_KEYWORDS) {
    if (textLower.includes(keyword.toLowerCase())) {
      healthMatches++;
    }
  }
  
  // Base score from health keywords (0-0.7)
  score = Math.min(healthMatches * 0.1, 0.7);
  
  // Bonus if author is health authority (0.2)
  if (HEALTH_AUTHORITY_ALLOWLIST.has(authorHandle.toLowerCase())) {
    score += 0.2;
    // If health authority AND has health signals, max out
    if (healthMatches >= 2) {
      score = Math.min(score, 1.0);
    }
  }
  
  // Penalize off-topic keywords (unless health authority)
  if (!HEALTH_AUTHORITY_ALLOWLIST.has(authorHandle.toLowerCase())) {
    let offTopicMatches = 0;
    for (const keyword of OFF_TOPIC_KEYWORDS) {
      if (textLower.includes(keyword.toLowerCase())) {
        offTopicMatches++;
      }
    }
    if (offTopicMatches > 0 && healthMatches === 0) {
      score *= 0.3; // Heavy penalty if off-topic and no health keywords
    } else if (offTopicMatches > 0) {
      score *= 0.7; // Moderate penalty if mixed
    }
  }
  
  // Clamp to 0-1
  return Math.max(0, Math.min(1, score));
}

/**
 * Explain replyability signals (for debugging/logging)
 */
export function explainReplyabilitySignals(tweetText: string, relevanceScore?: number): { boosts: string[]; penalties: string[] } {
  const boosts: string[] = [];
  const penalties: string[] = [];
  const textLower = tweetText.toLowerCase();
  
  // Check health relevance
  let hasHealthKeywords = false;
  for (const keyword of HEALTH_KEYWORDS) {
    if (textLower.includes(keyword.toLowerCase())) {
      hasHealthKeywords = true;
      break;
    }
  }
  const isHealthRelevant = (relevanceScore !== undefined && relevanceScore >= 0.30) || hasHealthKeywords;
  
  // Check positive hooks
  for (const [key, hook] of Object.entries(REPLYABILITY_HOOKS)) {
    if (hook.pattern.test(tweetText)) {
      // For claimWithEvidence, only boost if health-relevant
      if (key === 'claimWithEvidence' && !isHealthRelevant) {
        continue;
      }
      boosts.push(hook.name);
    }
  }
  
  // Check negative signals
  for (const pattern of REPLYABILITY_NEGATIVE_STRONG) {
    if (pattern.test(tweetText)) {
      penalties.push('promo_corporate');
      break; // Only log once
    }
  }
  
  for (const pattern of REPLYABILITY_NEGATIVE) {
    if (pattern.test(tweetText)) {
      penalties.push('promo_link');
      break;
    }
  }
  
  if (tweetText.trim().length < 30) {
    penalties.push('too_short');
  }
  
  if (/^https?:\/\//.test(tweetText.trim())) {
    penalties.push('link_only');
  }
  
  return { boosts, penalties };
}

/**
 * Compute replyability_score (0-1) based on tweet content patterns
 * @param tweetText The tweet content
 * @param relevanceScore Optional relevance score (0-1) to conditionally apply informative boost
 */
export function computeReplyabilityScore(tweetText: string, relevanceScore?: number): number {
  if (!tweetText || tweetText.trim().length < 10) {
    return 0; // Too short or empty
  }
  
  let score = 0.3; // Base score
  
  // Check if health-relevant (has health keywords)
  const textLower = tweetText.toLowerCase();
  let hasHealthKeywords = false;
  for (const keyword of HEALTH_KEYWORDS) {
    if (textLower.includes(keyword.toLowerCase())) {
      hasHealthKeywords = true;
      break;
    }
  }
  const isHealthRelevant = (relevanceScore !== undefined && relevanceScore >= 0.30) || hasHealthKeywords;
  
  // Apply reply hooks (stackable, but cap at 1.0)
  for (const [key, hook] of Object.entries(REPLYABILITY_HOOKS)) {
    if (hook.pattern.test(tweetText)) {
      // For claimWithEvidence, only boost if health-relevant
      if (key === 'claimWithEvidence' && !isHealthRelevant) {
        continue;
      }
      score += hook.boost;
    }
  }
  
  // Negative signals (promo, corporate, link-only) - strengthened penalties
  for (const pattern of REPLYABILITY_NEGATIVE_STRONG) {
    if (pattern.test(tweetText)) {
      score -= 0.3; // Stronger penalty
    }
  }
  
  for (const pattern of REPLYABILITY_NEGATIVE) {
    if (pattern.test(tweetText)) {
      score -= 0.2;
    }
  }
  
  // Penalize very short tweets (likely image-only or link-only)
  if (tweetText.trim().length < 30) {
    score -= 0.3;
  }
  
  // Penalize link-only (starts with URL)
  if (/^https?:\/\//.test(tweetText.trim())) {
    score -= 0.4;
  }
  
  // Clamp to 0-1
  return Math.max(0, Math.min(1, score));
}

/**
 * Classify if tweet is disallowed (corporate/promo/sensitive)
 */
export function classifyDisallowedTweet(
  tweetText: string,
  authorHandle: string,
  tweetUrl?: string
): string | null {
  const textLower = tweetText.toLowerCase();
  
  // Check sensitive topics
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (textLower.includes(keyword.toLowerCase())) {
      return 'sensitive';
    }
  }
  
  // Check promo/PR patterns
  const promoPatterns = [
    /\b(exclusive partner|proud to announce|we're honored|partnership|sponsored)\b/i,
    /\b(announcing|launching|dropping|minting|giveaway|contest|promo)\b/i,
    /\b(we're excited|thrilled|delighted|proud to)\b/i,
  ];
  
  for (const pattern of promoPatterns) {
    if (pattern.test(tweetText)) {
      return 'promo_pr';
    }
  }
  
  // Check giveaway
  if (/\b(giveaway|contest|win|prize|free)\b/i.test(tweetText)) {
    return 'giveaway';
  }
  
  // Check empty text (image-only)
  if (tweetText.trim().length < 10) {
    return 'empty_text';
  }
  
  // Check link-only
  if (/^https?:\/\//.test(tweetText.trim()) && tweetText.trim().length < 50) {
    return 'image_only';
  }
  
  return null;
}

/**
 * Compute both scores and check if disallowed
 */
export function computeRelevanceReplyabilityScores(
  tweetText: string,
  authorHandle: string,
  tweetUrl?: string
): RelevanceReplyabilityScores {
  const disallowedReason = classifyDisallowedTweet(tweetText, authorHandle, tweetUrl);
  
  if (disallowedReason) {
    return {
      relevance_score: 0,
      replyability_score: 0,
      disallowed_reason: disallowedReason,
    };
  }
  
  return {
    relevance_score: computeRelevanceScore(tweetText, authorHandle),
    replyability_score: computeReplyabilityScore(tweetText),
  };
}


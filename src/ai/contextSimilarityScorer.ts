/**
 * Context Similarity Scorer
 * 
 * Computes context_similarity (0-1) by comparing tweet text to brand anchor texts
 * Uses simple keyword/term matching (lightweight, no embeddings needed)
 */

// ═══════════════════════════════════════════════════════════════════════════
// BRAND ANCHOR TEXTS (representing our niche)
// ═══════════════════════════════════════════════════════════════════════════

const BRAND_ANCHOR_TEXTS = [
  // Sleep & Recovery
  'sleep quality circadian rhythm melatonin deep sleep REM recovery rest',
  
  // Training & Performance
  'training workout exercise strength cardio HIIT performance muscle hypertrophy adaptation',
  
  // Nutrition & Metabolism
  'nutrition diet protein carbs macros metabolism glucose insulin fasting ketosis',
  
  // Longevity & Aging
  'longevity lifespan healthspan aging anti-aging cellular repair autophagy',
  
  // Neuroscience & Cognitive
  'neuroscience brain cognitive function memory focus attention neuroplasticity',
  
  // Metabolism & Energy
  'metabolism metabolic mitochondria cellular energy ATP oxidative stress',
  
  // Recovery & Adaptation
  'recovery adaptation stress response cortisol inflammation immune system',
];

// Extract key terms from anchor texts
const ANCHOR_TERMS = new Set<string>();
BRAND_ANCHOR_TEXTS.forEach(anchor => {
  anchor.split(/\s+/).forEach(term => {
    if (term.length > 3) { // Only meaningful terms
      ANCHOR_TERMS.add(term.toLowerCase());
    }
  });
});

/**
 * Compute context_similarity (0-1) by matching tweet terms to brand anchors
 */
export function computeContextSimilarity(tweetText: string): number {
  if (!tweetText || tweetText.trim().length < 10) {
    return 0;
  }
  
  const textLower = tweetText.toLowerCase();
  const tweetTerms = textLower
    .split(/\s+/)
    .filter(term => term.length > 3) // Only meaningful terms
    .filter(term => !['that', 'this', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'where', 'which', 'their', 'there', 'these', 'those', 'about', 'would', 'could', 'should'].includes(term));
  
  // Count matches with anchor terms
  let matches = 0;
  for (const term of tweetTerms) {
    if (ANCHOR_TERMS.has(term)) {
      matches++;
    }
  }
  
  // Score: matches / max(unique_tweet_terms, 5)
  // Normalize to 0-1 range
  const uniqueTerms = new Set(tweetTerms).size;
  const denominator = Math.max(uniqueTerms, 5);
  const rawScore = matches / denominator;
  
  // Boost if multiple matches (stronger signal)
  const boostedScore = rawScore * (1 + Math.min(matches * 0.1, 0.5));
  
  // Clamp to 0-1
  return Math.max(0, Math.min(1, boostedScore));
}

/**
 * Compute final opportunity score using weighted formula:
 * opportunity_score_final = 0.45*relevance + 0.25*replyability + 0.30*context_similarity
 */
export function computeOpportunityScoreFinal(
  relevanceScore: number,
  replyabilityScore: number,
  contextSimilarity: number
): number {
  return (
    0.45 * relevanceScore +
    0.25 * replyabilityScore +
    0.30 * contextSimilarity
  );
}


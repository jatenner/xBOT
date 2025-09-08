/**
 * Content Scoring System for xBOT
 * Scores hook, clarity, novelty, and structure with rejection thresholds
 */

import { QUALITY_STANDARDS } from './policies';

export interface ContentScores {
  hookScore: number;
  clarityScore: number;
  noveltyScore: number;
  structureScore: number;
  overallScore: number;
  passed: boolean;
  rejectionReasons: string[];
}

export interface ScoringInput {
  content: string;
  tweets?: string[];
  format: 'single' | 'thread';
  topic: string;
}

/**
 * Score content across all quality dimensions
 */
export function scoreContent(input: ScoringInput): ContentScores {
  const { content, tweets, format, topic } = input;
  
  // Use tweets array if available (for threads), otherwise split content
  const tweetArray = tweets || [content];
  
  const hookScore = scoreHook(tweetArray[0], format);
  const clarityScore = scoreClarity(tweetArray);
  const noveltyScore = scoreNovelty(tweetArray, topic);
  const structureScore = scoreStructure(tweetArray, format);
  
  // Calculate weighted overall score
  const overallScore = calculateOverallScore({
    hookScore,
    clarityScore,
    noveltyScore,
    structureScore
  });
  
  // Check for rejection
  const rejectionReasons = checkRejectionCriteria({
    hookScore,
    clarityScore,
    noveltyScore,
    structureScore
  });
  
  return {
    hookScore,
    clarityScore,
    noveltyScore,
    structureScore,
    overallScore,
    passed: rejectionReasons.length === 0,
    rejectionReasons
  };
}

/**
 * Score hook effectiveness (0-1)
 */
export function scoreHook(hook: string, format: 'single' | 'thread'): number {
  let score = 0.3; // Base score
  
  // Length check
  if (hook.length < 50) {
    return 0.2; // Too short
  }
  if (hook.length > 280) {
    return 0.1; // Too long
  }
  
  // Optimal length bonus
  if (hook.length >= 100 && hook.length <= 240) {
    score += 0.1;
  }
  
  // Curiosity gap indicators
  const curiosityMarkers = [
    'contrary to', 'but', 'however', 'actually', 'surprisingly', 
    'turns out', 'what if', 'imagine', 'most people think'
  ];
  
  const hasCuriosityGap = curiosityMarkers.some(marker => 
    hook.toLowerCase().includes(marker.toLowerCase())
  );
  
  if (hasCuriosityGap) {
    score += 0.25;
  }
  
  // Contrarian angle
  const contrarianMarkers = [
    'myth', 'wrong', 'contrary', 'conventional wisdom', 'popular belief',
    'everyone thinks', 'standard advice', 'common assumption'
  ];
  
  const hasContrarianAngle = contrarianMarkers.some(marker =>
    hook.toLowerCase().includes(marker.toLowerCase())
  );
  
  if (hasContrarianAngle) {
    score += 0.2;
  }
  
  // Avoid conclusions in hook
  const conclusionMarkers = [
    'because', 'therefore', 'so', 'thus', 'consequently', 'as a result'
  ];
  
  const hasConclusion = conclusionMarkers.some(marker =>
    hook.toLowerCase().includes(marker.toLowerCase())
  );
  
  if (!hasConclusion) {
    score += 0.1;
  }
  
  // Thread indicator (for thread format)
  if (format === 'thread') {
    const hasThreadIndicator = ['🧵', '👇', 'thread', '/'].some(indicator =>
      hook.includes(indicator)
    );
    
    if (hasThreadIndicator) {
      score += 0.05;
    }
  }
  
  // Specificity bonus
  const hasSpecifics = /\d+/.test(hook) || hook.includes('%');
  if (hasSpecifics) {
    score += 0.1;
  }
  
  return Math.min(1.0, score);
}

/**
 * Score clarity across all tweets (0-1)
 */
export function scoreClarity(tweets: string[]): number {
  let score = 0.4; // Base score
  
  // One idea per tweet
  const avgComplexity = tweets.reduce((sum, tweet) => {
    // Count sentences and complex connectors
    const sentences = tweet.split(/[.!?]/).filter(s => s.trim().length > 0).length;
    const connectors = (tweet.match(/[;,]/g) || []).length;
    return sum + sentences + (connectors * 0.5);
  }, 0) / tweets.length;
  
  if (avgComplexity <= 1.5) {
    score += 0.25; // Simple, clear ideas
  } else if (avgComplexity <= 2.0) {
    score += 0.1; // Moderate complexity
  }
  
  // Readability check
  const avgWordsPerSentence = tweets.reduce((sum, tweet) => {
    const sentences = tweet.split(/[.!?]/).filter(s => s.trim().length > 0);
    const words = tweet.split(/\s+/).length;
    return sum + (words / Math.max(sentences.length, 1));
  }, 0) / tweets.length;
  
  if (avgWordsPerSentence <= 15) {
    score += 0.15; // Good readability
  }
  
  // Jargon handling
  const jargonTerms = [
    'metabolism', 'circadian', 'homeostasis', 'inflammation', 'oxidative',
    'mitochondrial', 'endocrine', 'neurotransmitter', 'cytokine'
  ];
  
  const jargonUsage = tweets.reduce((sum, tweet) => {
    const jargonCount = jargonTerms.filter(term => 
      tweet.toLowerCase().includes(term.toLowerCase())
    ).length;
    
    const explained = tweet.includes(':') || tweet.includes('(') || tweet.includes('=');
    return sum + (jargonCount - (explained ? jargonCount * 0.5 : 0));
  }, 0);
  
  if (jargonUsage === 0) {
    score += 0.1; // No unexplained jargon
  }
  
  // Flow and transition
  if (tweets.length > 1) {
    const hasFlow = tweets.some((tweet, i) => {
      if (i === 0) return false;
      const flowWords = ['next', 'then', 'also', 'additionally', 'furthermore', 'moreover'];
      return flowWords.some(word => tweet.toLowerCase().includes(word.toLowerCase()));
    });
    
    if (hasFlow) {
      score += 0.1;
    }
  }
  
  return Math.min(1.0, score);
}

/**
 * Score novelty and insight quality (0-1)
 */
export function scoreNovelty(tweets: string[], topic: string): number {
  let score = 0.3; // Base score
  
  const fullText = tweets.join(' ').toLowerCase();
  
  // Surprising or counterintuitive content
  const surpriseMarkers = [
    'surprising', 'unexpected', 'counterintuitive', 'contrary', 'actually',
    'myth', 'misconception', 'wrong', 'debunk', 'challenge'
  ];
  
  const hasSurprise = surpriseMarkers.some(marker => fullText.includes(marker));
  if (hasSurprise) {
    score += 0.2;
  }
  
  // Research and evidence
  const evidenceMarkers = [
    'research', 'study', 'studies', 'clinical trial', 'meta-analysis',
    'peer-reviewed', 'published', 'findings', 'data shows', 'evidence'
  ];
  
  const hasEvidence = evidenceMarkers.some(marker => fullText.includes(marker));
  if (hasEvidence) {
    score += 0.2;
  }
  
  // Specific statistics and numbers
  const hasStats = /\d+%|\d+ times|\d+x|\d+ participants|\d+ years/.test(fullText);
  if (hasStats) {
    score += 0.15;
  }
  
  // Mechanism explanation
  const mechanismMarkers = [
    'because', 'mechanism', 'pathway', 'process', 'how', 'why',
    'triggers', 'activates', 'inhibits', 'increases', 'decreases'
  ];
  
  const hasMechanism = mechanismMarkers.some(marker => fullText.includes(marker));
  if (hasMechanism) {
    score += 0.1;
  }
  
  // Recent or emerging research
  const recentMarkers = [
    'recent', 'new', 'latest', 'emerging', '2023', '2024', 'breakthrough'
  ];
  
  const hasRecent = recentMarkers.some(marker => fullText.includes(marker));
  if (hasRecent) {
    score += 0.05;
  }
  
  return Math.min(1.0, score);
}

/**
 * Score structure compliance (0-1)
 */
export function scoreStructure(tweets: string[], format: 'single' | 'thread'): number {
  let score = 0.3; // Base score
  
  if (format === 'single') {
    return scoreSingleTweetStructure(tweets[0]);
  }
  
  // Thread structure scoring
  if (tweets.length < 3 || tweets.length > 5) {
    return 0.2; // Wrong length
  }
  
  score += 0.2; // Correct length
  
  // Hook structure (first tweet)
  const hook = tweets[0];
  const hasThreadIndicator = ['🧵', '👇', 'thread', '/'].some(indicator =>
    hook.includes(indicator)
  );
  
  if (hasThreadIndicator) {
    score += 0.1;
  }
  
  // Body structure (middle tweets)
  const bodyTweets = tweets.slice(1, -1);
  const hasEvidenceInBody = bodyTweets.some(tweet => {
    const evidenceMarkers = ['research', 'study', 'data', 'evidence', 'finding'];
    return evidenceMarkers.some(marker => tweet.toLowerCase().includes(marker));
  });
  
  if (hasEvidenceInBody) {
    score += 0.2;
  }
  
  // Close structure (last tweet)
  const close = tweets[tweets.length - 1];
  const hasActionable = [
    'tip:', 'try', 'start', 'focus', 'prioritize', 'avoid', 'key',
    'remember', 'takeaway', 'action'
  ].some(marker => close.toLowerCase().includes(marker));
  
  const hasCTA = close.toLowerCase().includes('follow');
  
  if (hasActionable) {
    score += 0.1;
  }
  
  if (hasCTA) {
    score += 0.1;
  }
  
  return Math.min(1.0, score);
}

/**
 * Score single tweet structure
 */
function scoreSingleTweetStructure(tweet: string): number {
  let score = 0.4; // Base score
  
  // Length check
  if (tweet.length > 280) {
    return 0.1; // Too long
  }
  
  if (tweet.length >= 120 && tweet.length <= 250) {
    score += 0.2; // Good length
  }
  
  // Has hook element
  const hasHook = ['contrary', 'myth', 'actually', 'surprisingly'].some(marker =>
    tweet.toLowerCase().includes(marker)
  );
  
  if (hasHook) {
    score += 0.2;
  }
  
  // Has evidence
  const hasEvidence = ['research', 'study', 'data', '%'].some(marker =>
    tweet.toLowerCase().includes(marker) || /\d+/.test(tweet)
  );
  
  if (hasEvidence) {
    score += 0.2;
  }
  
  return Math.min(1.0, score);
}

/**
 * Calculate weighted overall score
 */
function calculateOverallScore(scores: {
  hookScore: number;
  clarityScore: number;
  noveltyScore: number;
  structureScore: number;
}): number {
  const { hookScore, clarityScore, noveltyScore, structureScore } = scores;
  
  // Weighted average: Hook 30%, Clarity 25%, Novelty 25%, Structure 20%
  return (
    hookScore * 0.30 +
    clarityScore * 0.25 +
    noveltyScore * 0.25 +
    structureScore * 0.20
  );
}

/**
 * Check if content meets minimum quality thresholds
 */
function checkRejectionCriteria(scores: {
  hookScore: number;
  clarityScore: number;
  noveltyScore: number;
  structureScore: number;
}): string[] {
  const rejectionReasons: string[] = [];
  
  const { hookScore, clarityScore, noveltyScore, structureScore } = scores;
  
  if (hookScore < QUALITY_STANDARDS.hookScore.minimum) {
    rejectionReasons.push(`Hook score too low: ${hookScore.toFixed(2)} < ${QUALITY_STANDARDS.hookScore.minimum}`);
  }
  
  if (clarityScore < QUALITY_STANDARDS.clarityScore.minimum) {
    rejectionReasons.push(`Clarity score too low: ${clarityScore.toFixed(2)} < ${QUALITY_STANDARDS.clarityScore.minimum}`);
  }
  
  if (noveltyScore < QUALITY_STANDARDS.noveltyScore.minimum) {
    rejectionReasons.push(`Novelty score too low: ${noveltyScore.toFixed(2)} < ${QUALITY_STANDARDS.noveltyScore.minimum}`);
  }
  
  if (structureScore < QUALITY_STANDARDS.structureScore.minimum) {
    rejectionReasons.push(`Structure score too low: ${structureScore.toFixed(2)} < ${QUALITY_STANDARDS.structureScore.minimum}`);
  }
  
  return rejectionReasons;
}

/**
 * Batch score multiple content candidates
 */
export function batchScoreContent(candidates: ScoringInput[]): ContentScores[] {
  return candidates.map(candidate => scoreContent(candidate));
}

/**
 * Select best content from scored candidates
 */
export function selectBestContent(scoredCandidates: ContentScores[]): ContentScores | null {
  const passedCandidates = scoredCandidates.filter(candidate => candidate.passed);
  
  if (passedCandidates.length === 0) {
    return null; // No candidates passed quality gates
  }
  
  // Return highest scoring passed candidate
  return passedCandidates.reduce((best, current) => 
    current.overallScore > best.overallScore ? current : best
  );
}

export default {
  scoreContent,
  scoreHook,
  scoreClarity,
  scoreNovelty,
  scoreStructure,
  batchScoreContent,
  selectBestContent
};

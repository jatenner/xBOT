/**
 * 🚫 TOPIC MISMATCH GUARD - Deterministic check for obvious mismatches
 * Prevents health replies under tech/politics/art threads
 * FAIL-CLOSED: Block replies where target topic is clearly non-health
 */

const TECH_KEYWORDS = [
  'grok', 'app store', 'openai', 'tesla', 'iphone', 'android', 'gpu', 'cpu',
  'software', 'algorithm', 'code', 'api', 'database', 'server', 'cloud',
  'machine learning', 'neural network', 'cryptocurrency', 'blockchain',
  'ai model', 'llm', 'chatgpt', 'github', 'javascript', 'python', 'npm',
  'programming', 'developer', 'cybertruck', 'starlink', 'spacex', 'elon musk',
  'nvidia', 'amd', 'intel', 'microsoft', 'google', 'apple', 'meta'
];

const POLITICS_KEYWORDS = [
  'trump', 'biden', 'democrat', 'republican', 'congress', 'senate', 'election',
  'voting', 'politician', 'political', 'liberal', 'conservative', 'left-wing',
  'right-wing', 'government', 'president', 'campaign', 'policy', 'legislation'
];

const ART_ENTERTAINMENT_KEYWORDS = [
  'movie', 'film', 'album', 'concert', 'actor', 'actress', 'director',
  'music', 'song', 'artist', 'painting', 'exhibition', 'gallery', 'celebrity',
  'netflix', 'disney', 'marvel', 'dc comics', 'anime', 'manga', 'video game',
  'playstation', 'xbox', 'nintendo', 'streaming', 'tiktok', 'viral video'
];

const SPORTS_KEYWORDS = [
  'football', 'soccer', 'nfl', 'nba', 'basketball', 'baseball', 'hockey',
  'tennis', 'golf', 'olympics', 'championship', 'playoffs', 'super bowl',
  'world cup', 'goal', 'touchdown', 'slam dunk', 'home run', 'referee',
  'coach', 'team', 'player', 'athlete', 'stadium', 'match', 'game'
];

// Combine all non-health topics
const NON_HEALTH_KEYWORDS = [
  ...TECH_KEYWORDS,
  ...POLITICS_KEYWORDS,
  ...ART_ENTERTAINMENT_KEYWORDS,
  ...SPORTS_KEYWORDS
];

const HEALTH_KEYWORDS = [
  'turmeric', 'cortisol', 'gut', 'magnesium', 'vitamin', 'supplement',
  'probiotic', 'inflammation', 'metabolism', 'hormone', 'microbiome',
  'nutrition', 'diet', 'wellness', 'symptom', 'disease', 'digestive',
  'antioxidant', 'protein', 'omega', 'fasting', 'calorie', 'exercise',
  'sleep', 'stress', 'anxiety', 'hydration', 'immune', 'energy', 'fatigue'
];

export interface TopicCheckResult {
  pass: boolean;
  skip_reason: string | null;
  details: {
    target_is_tech: boolean;
    reply_is_health: boolean;
    target_keywords_found: string[];
    reply_keywords_found: string[];
  };
}

function containsKeywords(text: string, keywords: string[]): { found: boolean; matches: string[] } {
  const lowerText = text.toLowerCase();
  const matches = keywords.filter(kw => lowerText.includes(kw.toLowerCase()));
  return { found: matches.length > 0, matches };
}

export function checkTopicMismatch(targetTweetText: string, replyText: string): TopicCheckResult {
  const targetNonHealth = containsKeywords(targetTweetText, NON_HEALTH_KEYWORDS);
  const replyHealth = containsKeywords(replyText, HEALTH_KEYWORDS);
  const targetHealth = containsKeywords(targetTweetText, HEALTH_KEYWORDS);

  // If target is about non-health topic AND reply is about health AND target is NOT about health => MISMATCH
  // Exception: If target also contains health keywords, allow the reply (mixed content)
  if (targetNonHealth.found && replyHealth.found && !targetHealth.found) {
    console.warn(`[TOPIC_MISMATCH] ⚠️ Detected non-health target + health reply`);
    console.warn(`[TOPIC_MISMATCH]   Target keywords: ${targetNonHealth.matches.join(', ')}`);
    console.warn(`[TOPIC_MISMATCH]   Reply keywords: ${replyHealth.matches.join(', ')}`);
    console.warn(`[TOPIC_MISMATCH]   Target has no health keywords - BLOCKING`);

    return {
      pass: false,
      skip_reason: 'topic_mismatch',
      details: {
        target_is_tech: targetNonHealth.found,
        reply_is_health: replyHealth.found,
        target_keywords_found: targetNonHealth.matches,
        reply_keywords_found: replyHealth.matches
      }
    };
  }

  return {
    pass: true,
    skip_reason: null,
    details: {
      target_is_tech: targetNonHealth.found,
      reply_is_health: replyHealth.found,
      target_keywords_found: targetNonHealth.matches,
      reply_keywords_found: replyHealth.matches
    }
  };
}


/**
 * 🚫 TOPIC MISMATCH GUARD - Deterministic check for obvious mismatches
 * Prevents health replies under tech threads and vice versa
 */

const TECH_KEYWORDS = [
  'grok',
  'app store',
  'openai',
  'tesla',
  'iphone',
  'android',
  'gpu',
  'cpu',
  'software',
  'algorithm',
  'code',
  'api',
  'database',
  'server',
  'cloud',
  'machine learning',
  'neural network',
  'cryptocurrency',
  'blockchain',
  'ai model',
  'llm',
  'chatgpt'
];

const HEALTH_KEYWORDS = [
  'turmeric',
  'cortisol',
  'gut',
  'magnesium',
  'vitamin',
  'supplement',
  'probiotic',
  'inflammation',
  'metabolism',
  'hormone',
  'microbiome',
  'nutrition',
  'diet',
  'wellness',
  'symptom',
  'disease',
  'digestive',
  'antioxidant'
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
  const targetTech = containsKeywords(targetTweetText, TECH_KEYWORDS);
  const replyHealth = containsKeywords(replyText, HEALTH_KEYWORDS);

  // If target is about tech AND reply is about health => MISMATCH
  if (targetTech.found && replyHealth.found) {
    console.warn(`[TOPIC_MISMATCH] ⚠️ Detected tech target + health reply`);
    console.warn(`[TOPIC_MISMATCH]   Target keywords: ${targetTech.matches.join(', ')}`);
    console.warn(`[TOPIC_MISMATCH]   Reply keywords: ${replyHealth.matches.join(', ')}`);

    return {
      pass: false,
      skip_reason: 'topic_mismatch',
      details: {
        target_is_tech: true,
        reply_is_health: true,
        target_keywords_found: targetTech.matches,
        reply_keywords_found: replyHealth.matches
      }
    };
  }

  return {
    pass: true,
    skip_reason: null,
    details: {
      target_is_tech: targetTech.found,
      reply_is_health: replyHealth.found,
      target_keywords_found: targetTech.matches,
      reply_keywords_found: replyHealth.matches
    }
  };
}


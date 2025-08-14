/**
 * Thread Validator - Strict validation and repair for thread integrity
 */

export interface ThreadValidationConfig {
  minTweets: number;
  maxTweets: number;
  maxCharsHard: number;
  forceNoHashtags: boolean;
  emojiMax: number;
}

export interface ThreadValidationResult {
  ok: boolean;
  reason?: string;
  k?: number;
  repairedTweets?: string[];
}

export interface ThreadDraft {
  tweets: { text: string }[];
}

/**
 * Load thread validation config from environment variables
 */
export function getThreadValidationConfig(): ThreadValidationConfig {
  return {
    minTweets: parseInt(process.env.THREAD_MIN_TWEETS || '5'),
    maxTweets: parseInt(process.env.THREAD_MAX_TWEETS || '9'),
    maxCharsHard: parseInt(process.env.TWEET_MAX_CHARS_HARD || '279'),
    forceNoHashtags: process.env.FORCE_NO_HASHTAGS === 'true',
    emojiMax: parseInt(process.env.EMOJI_MAX || '2')
  };
}

/**
 * Validate thread draft against strict requirements
 */
export function validateThread(draft: ThreadDraft, config?: ThreadValidationConfig): ThreadValidationResult {
  const cfg = config || getThreadValidationConfig();
  
  if (!draft.tweets || !Array.isArray(draft.tweets)) {
    return { ok: false, reason: 'invalid_structure' };
  }
  
  const k = draft.tweets.length;
  
  // Check tweet count requirements
  if (k < cfg.minTweets) {
    return { ok: false, reason: 'too_short', k };
  }
  
  if (k > cfg.maxTweets) {
    return { ok: false, reason: 'too_long', k };
  }
  
  // Validate each tweet
  const repairedTweets: string[] = [];
  
  for (let i = 0; i < draft.tweets.length; i++) {
    const tweet = draft.tweets[i];
    if (!tweet.text || typeof tweet.text !== 'string') {
      return { ok: false, reason: 'invalid_tweet_structure', k: i + 1 };
    }
    
    let text = tweet.text.trim();
    
    // Auto-repair: Remove numbering and thread markers
    text = removeThreadMarkersAndNumbering(text);
    
    // Auto-repair: Remove hashtags if forced
    if (cfg.forceNoHashtags) {
      text = text.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
    }
    
    // Auto-repair: Limit emojis
    text = limitEmojis(text, cfg.emojiMax);
    
    // Check character limit (after repair)
    if (text.length > cfg.maxCharsHard) {
      return { ok: false, reason: 'tweet_too_long', k: i + 1 };
    }
    
    // Check for empty tweet after repair
    if (text.length === 0) {
      return { ok: false, reason: 'empty_after_repair', k: i + 1 };
    }
    
    // Check T1 "before the fold" requirement (should be substantial but not too long)
    if (i === 0 && text.length < 50) {
      return { ok: false, reason: 'T1_too_short', k: text.length };
    }
    
    // Check for "follow this thread" fluff in T1
    if (i === 0 && containsThreadFluff(text)) {
      return { ok: false, reason: 'T1_thread_fluff', k: 1 };
    }
    
    repairedTweets.push(text);
  }
  
  return { ok: true, repairedTweets };
}

/**
 * Remove thread numbering and markers from text
 */
function removeThreadMarkersAndNumbering(text: string): string {
  // Remove various numbering patterns: 1/7, (1/7), 1., 2.), etc.
  text = text.replace(/^\s*\(?\d+\/\d+\)?\s*[-\.]?\s*/g, '');
  text = text.replace(/^\s*\(?\d+\)?\s*[\.\-]\s*/g, '');
  
  // Remove thread markers: 🧵, 👇, "thread", "🧵👇"
  text = text.replace(/🧵|👇/g, '');
  text = text.replace(/\b(thread|Thread|THREAD)\b/g, '');
  
  // Clean up extra spaces and fix capitalization
  text = text.replace(/\s+/g, ' ').trim();
  
  // Capitalize first letter if needed
  if (text.length > 0 && text[0] === text[0].toLowerCase()) {
    text = text[0].toUpperCase() + text.slice(1);
  }
  
  return text;
}

/**
 * Limit emojis in text to maxCount
 */
function limitEmojis(text: string, maxCount: number): string {
  if (maxCount <= 0) {
    return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  }
  
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojis = text.match(emojiRegex) || [];
  
  if (emojis.length <= maxCount) {
    return text;
  }
  
  // Keep first maxCount emojis, remove the rest
  let count = 0;
  return text.replace(emojiRegex, (match) => {
    count++;
    return count <= maxCount ? match : '';
  });
}

/**
 * Check if text contains "follow this thread" type fluff
 */
function containsThreadFluff(text: string): boolean {
  const fluffPatterns = [
    /follow\s+this(\s+thread)?/i,  // "follow this" or "follow this thread"
    /thread\s+below/i,
    /more\s+in\s+thread/i,
    /continued\s+below/i,
    /see\s+thread/i,
    /check\s+thread/i,
    /👇.*thread/i,
    /thread.*👇/i,
    /let's\s+dive\s+in/i
  ];
  
  return fluffPatterns.some(pattern => pattern.test(text));
}

/**
 * Generate strict thread prompt for LLM retry
 */
export function generateStrictThreadPrompt(topic: string, minTweets: number, maxTweets: number, maxChars: number): string {
  return `Generate a Twitter thread about "${topic}".

STRICT REQUIREMENTS:
- Return JSON: {"tweets":[{"text":"..."}]}
- Exactly ${minTweets}-${maxTweets} tweets
- Each tweet ≤ ${maxChars} characters
- NO numbering (1/7, 2/7, etc.)
- NO thread markers (🧵, 👇)
- NO "follow this thread" language
- Tweet 1 must deliver complete standalone value (220-240 chars)
- Each tweet must be self-contained but connect to the next
- Health/wellness focus with actionable insights
- Use simple, human language
- Max 2 emojis total across all tweets

Topic: ${topic}

Return ONLY the JSON object, nothing else.`;
}
/**
 * 🎛️ FEATURE FLAGS AND QUALITY THRESHOLDS
 * Centralized configuration for mega prompt pipeline
 */

export interface FeatureFlags {
  // Core posting features
  ENABLE_SINGLES: boolean;
  ENABLE_THREADS: boolean;
  ENABLE_REPLIES: boolean;
  ENABLE_QUOTES: boolean;
  
  // Safety controls
  POSTING_DISABLED: boolean;
  QUALITY_MIN_SCORE: number;
  HUMAN_VOICE_SCORE: number;
  
  // Quality gates
  REQUIRE_FACT_TOKENS: boolean;
  REQUIRE_VIRAL_TRIGGERS: boolean;
  BANNED_PHRASE_TOLERANCE: number;
  
  // Threading
  AUTO_THREAD_THRESHOLD: number;
  THREAD_MIN_TWEETS: number;
  THREAD_MAX_TWEETS: number;
  ENFORCE_THREAD_NUMBERING: boolean;
  
  // Mega prompt system
  MEGAPROMPT_ENABLED: boolean;
  MEGAPROMPT_QUALITY_GATES: boolean;
  MEGAPROMPT_FACT_INJECTION: boolean;
  MEGAPROMPT_REGENERATION: boolean;
}

// Default configuration
const DEFAULT_FLAGS: FeatureFlags = {
  // Core posting features
  ENABLE_SINGLES: true,
  ENABLE_THREADS: true,
  ENABLE_REPLIES: false,
  ENABLE_QUOTES: false,
  
  // Safety controls
  POSTING_DISABLED: false,
  QUALITY_MIN_SCORE: 85,
  HUMAN_VOICE_SCORE: 0, // No human voice allowed
  
  // Quality gates
  REQUIRE_FACT_TOKENS: true,
  REQUIRE_VIRAL_TRIGGERS: true,
  BANNED_PHRASE_TOLERANCE: 0, // Zero tolerance
  
  // Threading
  AUTO_THREAD_THRESHOLD: 240, // Auto-thread if >240 chars
  THREAD_MIN_TWEETS: 2,
  THREAD_MAX_TWEETS: 5,
  ENFORCE_THREAD_NUMBERING: true,
  
  // Mega prompt system
  MEGAPROMPT_ENABLED: true,
  MEGAPROMPT_QUALITY_GATES: true,
  MEGAPROMPT_FACT_INJECTION: true,
  MEGAPROMPT_REGENERATION: true
};

/**
 * 🎛️ GET FEATURE FLAGS
 */
export function getFeatureFlags(): FeatureFlags {
  const flags: FeatureFlags = { ...DEFAULT_FLAGS };
  
  // Override with environment variables
  if (process.env.ENABLE_SINGLES !== undefined) {
    flags.ENABLE_SINGLES = process.env.ENABLE_SINGLES === 'true';
  }
  
  if (process.env.ENABLE_THREADS !== undefined) {
    flags.ENABLE_THREADS = process.env.ENABLE_THREADS === 'true';
  }
  
  if (process.env.ENABLE_REPLIES !== undefined) {
    flags.ENABLE_REPLIES = process.env.ENABLE_REPLIES === 'true';
  }
  
  if (process.env.ENABLE_QUOTES !== undefined) {
    flags.ENABLE_QUOTES = process.env.ENABLE_QUOTES === 'true';
  }
  
  if (process.env.POSTING_DISABLED !== undefined) {
    flags.POSTING_DISABLED = process.env.POSTING_DISABLED === 'true';
  }
  
  if (process.env.QUALITY_MIN_SCORE !== undefined) {
    flags.QUALITY_MIN_SCORE = parseInt(process.env.QUALITY_MIN_SCORE, 10) || 85;
  }
  
  if (process.env.HUMAN_VOICE_SCORE !== undefined) {
    flags.HUMAN_VOICE_SCORE = parseInt(process.env.HUMAN_VOICE_SCORE, 10) || 0;
  }
  
  // Log active configuration
  console.log('🎛️ FEATURE_FLAGS: Configuration loaded');
  console.log(`   📝 Singles: ${flags.ENABLE_SINGLES}`);
  console.log(`   🧵 Threads: ${flags.ENABLE_THREADS}`);
  console.log(`   💬 Replies: ${flags.ENABLE_REPLIES}`);
  console.log(`   🔄 Quotes: ${flags.ENABLE_QUOTES}`);
  console.log(`   🛑 Posting Disabled: ${flags.POSTING_DISABLED}`);
  console.log(`   📊 Quality Min Score: ${flags.QUALITY_MIN_SCORE}`);
  console.log(`   👤 Human Voice Score: ${flags.HUMAN_VOICE_SCORE}`);
  
  return flags;
}

/**
 * 🔍 VALIDATE CONTENT AGAINST FLAGS
 */
export function validateContentFlags(content: any, flags: FeatureFlags): {
  allowed: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  
  // Check posting disabled
  if (flags.POSTING_DISABLED) {
    reasons.push('Posting is globally disabled');
  }
  
  // Check content type permissions
  if (content.format === 'single' && !flags.ENABLE_SINGLES) {
    reasons.push('Single tweets are disabled');
  }
  
  if (content.format === 'thread' && !flags.ENABLE_THREADS) {
    reasons.push('Thread posting is disabled');
  }
  
  // Check quality score
  if (content.qualityScore < flags.QUALITY_MIN_SCORE) {
    reasons.push(`Quality score ${content.qualityScore} below minimum ${flags.QUALITY_MIN_SCORE}`);
  }
  
  // Check human voice score
  if (content.humanVoiceScore > flags.HUMAN_VOICE_SCORE) {
    reasons.push(`Human voice score ${content.humanVoiceScore} exceeds maximum ${flags.HUMAN_VOICE_SCORE}`);
  }
  
  const allowed = reasons.length === 0;
  
  if (!allowed) {
    console.warn(`🚫 CONTENT_BLOCKED: ${reasons.join(', ')}`);
  }
  
  return { allowed, reasons };
}

/**
 * 🎯 CHECK THREAD REQUIREMENTS
 */
export function validateThreadFlags(tweets: string[], flags: FeatureFlags): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check thread count
  if (tweets.length < flags.THREAD_MIN_TWEETS) {
    issues.push(`Thread has ${tweets.length} tweets, minimum is ${flags.THREAD_MIN_TWEETS}`);
  }
  
  if (tweets.length > flags.THREAD_MAX_TWEETS) {
    issues.push(`Thread has ${tweets.length} tweets, maximum is ${flags.THREAD_MAX_TWEETS}`);
  }
  
  // Check numbering if enforced
  if (flags.ENFORCE_THREAD_NUMBERING) {
    const hasProperNumbering = tweets.every((tweet, index) => {
      const expectedPrefix = `${index + 1}/${tweets.length}`;
      return tweet.startsWith(expectedPrefix);
    });
    
    if (!hasProperNumbering) {
      issues.push('Thread missing proper 1/n numbering format');
    }
  }
  
  const valid = issues.length === 0;
  
  return { valid, issues };
}

/**
 * 🎛️ GET QUALITY THRESHOLDS
 */
export function getQualityThresholds(): {
  minQualityScore: number;
  minViralScore: number;
  minShockValue: number;
  maxHumanVoice: number;
} {
  const flags = getFeatureFlags();
  
  return {
    minQualityScore: flags.QUALITY_MIN_SCORE,
    minViralScore: 70, // Fixed threshold for viral content
    minShockValue: 50, // Minimum shock value for engagement
    maxHumanVoice: flags.HUMAN_VOICE_SCORE
  };
}

// Export singleton
export const featureFlags = getFeatureFlags();

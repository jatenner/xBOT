/**
 * 🚦 ENVIRONMENT FLAGS - Autonomous System Control
 * 
 * Critical flags that control LLM generation, posting, and analytics behavior
 */

export interface EnvironmentFlags {
  // ===== AI/LLM Control =====
  AI_QUOTA_CIRCUIT_OPEN: boolean;           // true = block ALL LLM calls (circuit breaker)
  DAILY_OPENAI_LIMIT_USD: number;          // Daily spend cap
  DISABLE_LLM_WHEN_BUDGET_HIT: boolean;    // Stop LLM when budget exceeded
  BUDGET_STRICT: boolean;                   // Fail hard on budget violations
  
  // ===== Posting Control =====
  POSTING_DISABLED: boolean;                // true = do NOT post (but still queue)
  LIVE_POSTS: boolean;                      // true = allow actual X posting
  
  // ===== Analytics Control =====
  REAL_METRICS_ENABLED: boolean;            // true = collect real X engagement
  
  // ===== Operational Mode =====
  MODE: 'shadow' | 'live';                  // Shadow = synthetic, Live = real
  
  // ===== Content Controls =====
  ENABLE_REPLIES: boolean;
  ENABLE_SINGLES: boolean;
  ENABLE_THREADS: boolean;
  ENABLE_BANDIT_LEARNING: boolean;
  
  // ===== Thresholds =====
  DUP_COSINE_THRESHOLD: number;             // Uniqueness similarity threshold
  SIMILARITY_THRESHOLD: number;             // Fallback similarity threshold
  MIN_QUALITY_SCORE: number;                // Minimum content quality
  
  // ===== Rate Limits =====
  MAX_POSTS_PER_HOUR: number;
  MIN_POST_INTERVAL_MINUTES: number;
  REPLY_MAX_PER_DAY: number;
  
  // ===== Models =====
  OPENAI_MODEL: string;
  EMBED_MODEL: string;
}

/**
 * Load environment flags from process.env
 */
export function loadEnvironmentFlags(): EnvironmentFlags {
  const parseBoolean = (val: string | undefined, defaultVal: boolean): boolean => {
    if (val === undefined) return defaultVal;
    return val === 'true' || val === '1';
  };
  
  const parseNumber = (val: string | undefined, defaultVal: number): number => {
    if (val === undefined) return defaultVal;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? defaultVal : parsed;
  };
  
  return {
    // AI/LLM Control
    AI_QUOTA_CIRCUIT_OPEN: parseBoolean(process.env.AI_QUOTA_CIRCUIT_OPEN, false),
    DAILY_OPENAI_LIMIT_USD: parseNumber(process.env.DAILY_OPENAI_LIMIT_USD, 10.0),
    DISABLE_LLM_WHEN_BUDGET_HIT: parseBoolean(process.env.DISABLE_LLM_WHEN_BUDGET_HIT, true),
    BUDGET_STRICT: parseBoolean(process.env.BUDGET_STRICT, true),
    
    // Posting Control
    POSTING_DISABLED: parseBoolean(process.env.POSTING_DISABLED, true),
    LIVE_POSTS: parseBoolean(process.env.LIVE_POSTS, false),
    
    // Analytics Control
    REAL_METRICS_ENABLED: parseBoolean(process.env.REAL_METRICS_ENABLED, false),
    
    // Operational Mode
    MODE: (process.env.MODE === 'live' ? 'live' : 'shadow') as 'shadow' | 'live',
    
    // Content Controls
    ENABLE_REPLIES: parseBoolean(process.env.ENABLE_REPLIES, true),
    ENABLE_SINGLES: parseBoolean(process.env.ENABLE_SINGLES, true),
    ENABLE_THREADS: parseBoolean(process.env.ENABLE_THREADS, true),
    ENABLE_BANDIT_LEARNING: parseBoolean(process.env.ENABLE_BANDIT_LEARNING, true),
    
    // Thresholds
    DUP_COSINE_THRESHOLD: parseNumber(process.env.DUP_COSINE_THRESHOLD, 0.85),
    SIMILARITY_THRESHOLD: parseNumber(process.env.SIMILARITY_THRESHOLD, 0.85),
    MIN_QUALITY_SCORE: parseNumber(process.env.MIN_QUALITY_SCORE, 0.7),
    
    // Rate Limits
    MAX_POSTS_PER_HOUR: parseNumber(process.env.MAX_POSTS_PER_HOUR, 1),
    MIN_POST_INTERVAL_MINUTES: parseNumber(process.env.MIN_POST_INTERVAL_MINUTES, 15),
    REPLY_MAX_PER_DAY: parseNumber(process.env.REPLY_MAX_PER_DAY, 10),
    
    // Models
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    EMBED_MODEL: process.env.EMBED_MODEL || 'text-embedding-3-small'
  };
}

// Singleton instance
let cachedFlags: EnvironmentFlags | null = null;

export function getEnvFlags(): EnvironmentFlags {
  if (!cachedFlags) {
    cachedFlags = loadEnvironmentFlags();
  }
  return cachedFlags;
}

/**
 * Check if LLM calls are allowed
 * Returns: { allowed: boolean, reason?: string }
 */
export function isLLMAllowed(): { allowed: boolean; reason?: string } {
  const flags = getEnvFlags();
  
  // Circuit breaker takes priority
  if (flags.AI_QUOTA_CIRCUIT_OPEN) {
    return { allowed: false, reason: 'AI_QUOTA_CIRCUIT_OPEN=true (circuit breaker active)' };
  }
  
  // Note: POSTING_DISABLED does NOT block LLM
  // LLM is only blocked by AI_QUOTA_CIRCUIT_OPEN and budget limits
  
  return { allowed: true };
}

/**
 * Check if posting is allowed
 * Returns: { allowed: boolean, reason?: string }
 */
export function isPostingAllowed(): { allowed: boolean; reason?: string } {
  const flags = getEnvFlags();
  
  if (flags.POSTING_DISABLED) {
    return { allowed: false, reason: 'POSTING_DISABLED=true' };
  }
  
  if (!flags.LIVE_POSTS) {
    return { allowed: false, reason: 'LIVE_POSTS=false' };
  }
  
  return { allowed: true };
}

/**
 * Check if real analytics collection is allowed
 */
export function isRealAnalyticsAllowed(): boolean {
  const flags = getEnvFlags();
  return flags.REAL_METRICS_ENABLED;
}

/**
 * Get flag summary for logging
 */
export function getFlagSummary(): string {
  const flags = getEnvFlags();
  const llm = isLLMAllowed();
  const posting = isPostingAllowed();
  
  return [
    `MODE=${flags.MODE}`,
    `LLM=${llm.allowed ? '✅' : '❌' + (llm.reason ? ` (${llm.reason})` : '')}`,
    `POSTING=${posting.allowed ? '✅' : '❌' + (posting.reason ? ` (${posting.reason})` : '')}`,
    `ANALYTICS=${flags.REAL_METRICS_ENABLED ? '✅' : '❌'}`,
    `BUDGET_LIMIT=$${flags.DAILY_OPENAI_LIMIT_USD}/day`
  ].join(' | ');
}

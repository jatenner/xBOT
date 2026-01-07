/**
 * 🎯 TARGET QUALITY FILTER
 * 
 * Filters reply opportunities to ensure we only target ELITE, brand-safe,
 * health-relevant tweets that maximize impressions and follower conversion.
 * 
 * Quality Score (0-100):
 * - 85+: Elite (1.5x multiplier)
 * - 70-84: Good (1.2x multiplier)
 * - <70: Blocked (0x multiplier)
 * 
 * Hard blocks:
 * - Profanity/slurs/crude language
 * - Pure meme/joke format with no actionable content
 * - Off-topic (politics, drama, crypto, etc.)
 */

// ═══════════════════════════════════════════════════════════════════════════
// HARD BLOCK LISTS
// ═══════════════════════════════════════════════════════════════════════════

const PROFANITY_PATTERNS = [
  // Hard profanity (always block)
  /\b(fuck|fucking|fucked|fucker|fuckin)\b/i,
  /\b(shit|shitting|shitty|bullshit)\b/i,
  /\b(ass|asses|asshole)\b/i,
  /\b(bitch|bitches|bitching)\b/i,
  /\b(damn|damned)\b/i,
  /\b(crap|crappy)\b/i,
  /\b(dick|dicks|dickhead)\b/i,
  /\b(pussy|pussies)\b/i,
  /\b(cock|cocks)\b/i,
  /\b(whore|slut|hoe)\b/i,
  /\b(retard|retarded)\b/i,
  /\b(faggot|fag)\b/i,
  /\bnigga|niggas|nigger\b/i,
  /\b(bastard)\b/i,
  /\b(wtf|stfu|lmfao)\b/i,
  // Crude/vulgar
  /\b(piss|pissing|pissed)\b/i,
  /\b(cunt)\b/i,
  /\b(horny)\b/i,
];

const CRUDE_HUMOR_PATTERNS = [
  // Crude comparisons
  /eat like.*dogs?/i,
  /stray dogs?/i,
  /like.*animals?/i,
  /look like.*garbage/i,
  /smell like/i,
  // Sexual innuendo
  /that's what she said/i,
  /in bed/i,
  /size doesn't matter/i,
  // Bathroom humor
  /toilet|poop|pooping|farting|fart/i,
  // Violence/dark
  /kill myself|kms|want to die/i,
  /murder|killing|dead body/i,
];

const MEME_FORMAT_PATTERNS = [
  // Greentext style
  /^>be\s/im,
  /^>.*\n>.*\n>/im,
  // POV format
  /^pov:/i,
  // "Nobody:" format
  /nobody:\s*\n/i,
  /no one:\s*\n/i,
  // Twitter meme patterns
  /me at 3am/i,
  /my last two brain cells/i,
  /brain: do it/i,
  /anxiety: what if/i,
  // Relatable memes with no value
  /this is a personal attack/i,
  /i feel attacked/i,
  /why is this so accurate/i,
  /literally me/i,
];

const OFF_TOPIC_PATTERNS = [
  // Politics
  /\b(trump|biden|election|democrat|republican|maga|liberal|conservative)\b/i,
  /\b(vote for|voting for|political)\b/i,
  // Crypto/NFT
  /\b(crypto|bitcoin|ethereum|nft|web3|airdrop|token)\b/i,
  // Drama/gossip
  /\b(drama|cancelled|canceled|exposed|beef|clout)\b/i,
  // Gambling
  /\b(bet|betting|gambling|casino|odds)\b/i,
  // War/conflict
  /\b(gaza|ukraine|war|bombing|missile)\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════
// POSITIVE QUALITY INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

const HEALTH_SCIENCE_PATTERNS = [
  // Research/evidence
  /\b(study|studies|research|researchers|scientists)\b/i,
  /\b(evidence|data|findings|results)\b/i,
  /\b(clinical|trial|experiment)\b/i,
  /\b(published|journal|peer-reviewed)\b/i,
  // Mechanisms
  /\b(mechanism|pathway|receptor|enzyme|hormone)\b/i,
  /\b(insulin|cortisol|testosterone|estrogen|dopamine|serotonin)\b/i,
  /\b(metabolism|metabolic|mitochondria)\b/i,
  // Health metrics
  /\b(blood pressure|cholesterol|glucose|a1c|hdl|ldl)\b/i,
  /\b(heart rate|hrv|vo2|bmi)\b/i,
  // Nutrition specifics
  /\b(protein|carbs|fats|calories|macros|fiber)\b/i,
  /\b(vitamin|mineral|supplement|omega-3|magnesium|zinc)\b/i,
  // Fitness specifics
  /\b(reps|sets|volume|intensity|progressive overload)\b/i,
  /\b(strength|hypertrophy|endurance|cardio|resistance)\b/i,
  // Longevity/biohacking
  /\b(longevity|lifespan|healthspan|aging|anti-aging)\b/i,
  /\b(fasting|autophagy|ketosis|zone 2)\b/i,
];

const ACTIONABLE_CONTENT_PATTERNS = [
  // Tips/advice format
  /\b(tip|tips|hack|hacks|trick|tricks)\b/i,
  /\b(how to|here's how|ways to|steps to)\b/i,
  /\b(you should|try this|start doing|stop doing)\b/i,
  // Numbers/specifics
  /\b\d+\s*(grams?|mg|mcg|iu|hours?|minutes?|days?|weeks?|reps?|sets?)\b/i,
  /\b\d+%|\d+x\b/i,
  // Results-oriented
  /\b(improved|increased|decreased|reduced|boosted)\b/i,
  /\b(benefit|benefits|effective|works)\b/i,
];

const CREDIBLE_AUTHOR_PATTERNS = [
  // Credentials in name/handle
  /\b(dr|md|phd|rn|rd|dpt|dc)\b/i,
  /\bdoctor\b/i,
  /\bcoach\b/i,
  /\bnutritionist\b/i,
  /\bdietitian\b/i,
  /\btrainer\b/i,
  /\bscientist\b/i,
  /\bresearcher\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY SCORING
// ═══════════════════════════════════════════════════════════════════════════

export interface QualityResult {
  score: number;           // 0-100
  pass: boolean;           // score >= 70
  reasons: string[];       // Why this score
  block_reason?: string;   // If hard blocked
  quality_tier: 'elite' | 'good' | 'blocked';
  multiplier: number;      // 1.5, 1.2, or 0
}

export function scoreTargetQuality(
  content: string,
  author: string,
  authorFollowers?: number,
  viewCount?: number,
  likeCount?: number
): QualityResult {
  const reasons: string[] = [];
  let score = 50; // Base score
  
  // ═══════════════════════════════════════════════════════════════════════
  // HARD BLOCKS (immediate reject)
  // ═══════════════════════════════════════════════════════════════════════
  
  // Check profanity
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(content)) {
      const match = content.match(pattern);
      return {
        score: 0,
        pass: false,
        reasons: ['profanity_detected'],
        block_reason: `profanity: ${match?.[0] || 'detected'}`,
        quality_tier: 'blocked',
        multiplier: 0,
      };
    }
  }
  
  // Check crude humor
  for (const pattern of CRUDE_HUMOR_PATTERNS) {
    if (pattern.test(content)) {
      return {
        score: 0,
        pass: false,
        reasons: ['crude_humor_detected'],
        block_reason: 'crude_humor',
        quality_tier: 'blocked',
        multiplier: 0,
      };
    }
  }
  
  // Check off-topic
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(content)) {
      return {
        score: 0,
        pass: false,
        reasons: ['off_topic_detected'],
        block_reason: 'off_topic',
        quality_tier: 'blocked',
        multiplier: 0,
      };
    }
  }
  
  // Check pure meme format with no substance
  let memePatternMatches = 0;
  for (const pattern of MEME_FORMAT_PATTERNS) {
    if (pattern.test(content)) memePatternMatches++;
  }
  
  // If multiple meme patterns AND short content AND no health keywords → block
  const hasHealthKeywords = HEALTH_SCIENCE_PATTERNS.some(p => p.test(content));
  if (memePatternMatches >= 1 && content.length < 150 && !hasHealthKeywords) {
    return {
      score: 15,
      pass: false,
      reasons: ['meme_format_no_substance'],
      block_reason: 'meme_without_value',
      quality_tier: 'blocked',
      multiplier: 0,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // POSITIVE SCORING
  // ═══════════════════════════════════════════════════════════════════════
  
  // Health/science content (+30 max)
  let healthScore = 0;
  for (const pattern of HEALTH_SCIENCE_PATTERNS) {
    if (pattern.test(content)) healthScore += 7;
  }
  healthScore = Math.min(healthScore, 30);
  if (healthScore > 0) {
    score += healthScore;
    reasons.push(`health_science_content:+${healthScore}`);
  }
  
  // Actionable content (+15 max)
  let actionableScore = 0;
  for (const pattern of ACTIONABLE_CONTENT_PATTERNS) {
    if (pattern.test(content)) actionableScore += 5;
  }
  actionableScore = Math.min(actionableScore, 15);
  if (actionableScore > 0) {
    score += actionableScore;
    reasons.push(`actionable_content:+${actionableScore}`);
  }
  
  // Content length (medium is better for replies)
  if (content.length >= 100 && content.length <= 280) {
    score += 5;
    reasons.push('optimal_length:+5');
  } else if (content.length < 50) {
    score -= 10;
    reasons.push('too_short:-10');
  }
  
  // Numbers/data points (signals specific claims)
  const numberMatches = content.match(/\d+(\.\d+)?(%|x|mg|g|hours?|min|days?)?/g);
  if (numberMatches && numberMatches.length >= 2) {
    score += 12;
    reasons.push('data_points:+12');
  }
  
  // Percentage claims (strong scientific signal)
  if (/\d+(\.\d+)?%/.test(content)) {
    score += 5;
    reasons.push('percentage_claim:+5');
  }
  
  // Author credibility
  if (CREDIBLE_AUTHOR_PATTERNS.some(p => p.test(author))) {
    score += 10;
    reasons.push('credible_author:+10');
  }
  
  // Follower count (if available)
  if (authorFollowers) {
    if (authorFollowers >= 1000000) {
      score += 15;
      reasons.push('mega_account:+15');
    } else if (authorFollowers >= 100000) {
      score += 10;
      reasons.push('large_account:+10');
    } else if (authorFollowers >= 10000) {
      score += 5;
      reasons.push('established_account:+5');
    }
  }
  
  // View count (if available) - strong signal
  if (viewCount) {
    if (viewCount >= 10000000) {
      score += 20;
      reasons.push('mega_viral_views:+20');
    } else if (viewCount >= 1000000) {
      score += 15;
      reasons.push('viral_views:+15');
    } else if (viewCount >= 100000) {
      score += 10;
      reasons.push('high_views:+10');
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // NEGATIVE SCORING (soft penalties)
  // ═══════════════════════════════════════════════════════════════════════
  
  // All caps (spammy)
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (capsRatio > 0.5) {
    score -= 15;
    reasons.push('excessive_caps:-15');
  }
  
  // Too many emojis (spammy)
  const emojiCount = (content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 5) {
    score -= 10;
    reasons.push('too_many_emojis:-10');
  }
  
  // Promotional patterns
  if (/\b(link in bio|check out|subscribe|follow me)\b/i.test(content)) {
    score -= 10;
    reasons.push('promotional:-10');
  }
  
  // Meme format (soft penalty if some substance exists)
  if (memePatternMatches > 0) {
    score -= 5 * memePatternMatches;
    reasons.push(`meme_format:-${5 * memePatternMatches}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // FINAL SCORE + TIER
  // ═══════════════════════════════════════════════════════════════════════
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Quality threshold (configurable via env, default 50)
  const qualityThreshold = Number(process.env.TARGET_QUALITY_THRESHOLD) || 50;
  
  // Determine tier
  let quality_tier: 'elite' | 'good' | 'blocked';
  let multiplier: number;
  
  if (score >= 85) {
    quality_tier = 'elite';
    multiplier = 1.5;
  } else if (score >= qualityThreshold) {
    quality_tier = 'good';
    multiplier = 1.2;
  } else {
    quality_tier = 'blocked';
    multiplier = 0;
  }
  
  // Log threshold at runtime (first call only)
  if (!(globalThis as any).__quality_threshold_logged) {
    console.log(`[QUALITY_FILTER] 🎯 Quality threshold: ${qualityThreshold} (env: ${process.env.TARGET_QUALITY_THRESHOLD || 'default'})`);
    (globalThis as any).__quality_threshold_logged = true;
  }
  
  return {
    score,
    pass: score >= qualityThreshold,
    reasons,
    block_reason: score < qualityThreshold ? `quality_score_${score}_below_threshold` : undefined,
    quality_tier,
    multiplier,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH FILTERING
// ═══════════════════════════════════════════════════════════════════════════

export interface OpportunityWithQuality {
  tweet_id: string;
  content: string;
  author: string;
  like_count: number;
  view_count?: number;
  author_followers?: number;
  quality_result: QualityResult;
}

export function filterOpportunitiesByQuality(
  opportunities: Array<{
    tweet_id?: string;
    target_tweet_id?: string;
    tweet_content?: string;
    target_tweet_content?: string;
    tweet_author?: string;
    target_username?: string;
    like_count?: number;
    view_count?: number;
    author_followers?: number;
  }>
): { kept: OpportunityWithQuality[]; blocked: OpportunityWithQuality[] } {
  const kept: OpportunityWithQuality[] = [];
  const blocked: OpportunityWithQuality[] = [];
  
  for (const opp of opportunities) {
    const tweetId = opp.tweet_id || opp.target_tweet_id || '';
    const content = opp.tweet_content || opp.target_tweet_content || '';
    const author = opp.tweet_author || opp.target_username || '';
    const likeCount = opp.like_count || 0;
    const viewCount = opp.view_count;
    const authorFollowers = opp.author_followers;
    
    const quality = scoreTargetQuality(content, author, authorFollowers, viewCount, likeCount);
    
    const result: OpportunityWithQuality = {
      tweet_id: tweetId,
      content,
      author,
      like_count: likeCount,
      view_count: viewCount,
      author_followers: authorFollowers,
      quality_result: quality,
    };
    
    if (quality.pass) {
      kept.push(result);
      console.log(`[QUALITY_FILTER] ✅ KEPT: @${author} (${likeCount} likes) score=${quality.score} tier=${quality.quality_tier}`);
    } else {
      blocked.push(result);
      console.log(`[QUALITY_FILTER] 🚫 BLOCKED: @${author} (${likeCount} likes) score=${quality.score} reason=${quality.block_reason}`);
    }
  }
  
  console.log(`[QUALITY_FILTER] Summary: ${kept.length} kept, ${blocked.length} blocked`);
  
  return { kept, blocked };
}


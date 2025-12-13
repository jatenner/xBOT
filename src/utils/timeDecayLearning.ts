/**
 * ⏰ TIME-DECAYED LEARNING UTILITY
 * 
 * Implements exponential decay for learning systems to prioritize recent data
 * Formula: decay_factor = exp(-lambda * age_in_days)
 * effective_score = primary_objective_score * decay_factor
 * 
 * This ensures that:
 * - Recent posts have higher weight in learning
 * - Older posts gradually lose influence
 * - System adapts to changing patterns
 */

export interface TimeDecayConfig {
  lambda?: number; // Decay rate (default: 0.1 = ~10% per day)
  minDecayFactor?: number; // Minimum decay factor (default: 0.1 = never go below 10%)
  maxAgeDays?: number; // Maximum age to consider (default: 60 days)
}

export interface DecayedScore {
  originalScore: number;
  decayFactor: number;
  effectiveScore: number;
  ageDays: number;
}

/**
 * Calculate decay factor based on age
 * 
 * @param ageDays - Age of the data point in days
 * @param lambda - Decay rate (default: 0.1)
 * @param minDecayFactor - Minimum decay factor (default: 0.1)
 * @returns Decay factor between minDecayFactor and 1.0
 */
export function calculateDecayFactor(
  ageDays: number,
  config?: TimeDecayConfig
): number {
  const {
    lambda = 0.1, // Default: ~10% decay per day
    minDecayFactor = 0.1, // Never go below 10% weight
  } = config || {};

  // Exponential decay: exp(-lambda * age)
  const decayFactor = Math.exp(-lambda * ageDays);

  // Clamp to minimum decay factor
  return Math.max(minDecayFactor, decayFactor);
}

/**
 * Calculate effective score with time decay
 * 
 * @param score - Original score (e.g., primary_objective_score)
 * @param ageDays - Age of the data point in days
 * @param config - Time decay configuration
 * @returns Decayed score result
 */
export function calculateDecayedScore(
  score: number,
  ageDays: number,
  config?: TimeDecayConfig
): DecayedScore {
  const decayFactor = calculateDecayFactor(ageDays, config);
  const effectiveScore = score * decayFactor;

  return {
    originalScore: score,
    decayFactor,
    effectiveScore,
    ageDays
  };
}

/**
 * Calculate age in days from posted_at timestamp
 * 
 * @param postedAt - ISO timestamp string or Date
 * @returns Age in days (can be fractional)
 */
export function calculateAgeDays(postedAt: string | Date): number {
  const posted = typeof postedAt === 'string' ? new Date(postedAt) : postedAt;
  const now = new Date();
  const diffMs = now.getTime() - posted.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(0, diffDays);
}

/**
 * Filter and weight data points by age
 * 
 * @param dataPoints - Array of data points with posted_at timestamps
 * @param scoreField - Field name containing the score to decay
 * @param config - Time decay configuration
 * @returns Filtered and weighted data points
 */
export function applyTimeDecay<T extends { posted_at: string | Date; [key: string]: any }>(
  dataPoints: T[],
  scoreField: keyof T,
  config?: TimeDecayConfig
): Array<T & { decay_factor: number; effective_score: number; age_days: number }> {
  const {
    maxAgeDays = 60, // Default: only consider last 60 days
  } = config || {};

  return dataPoints
    .map(point => {
      const ageDays = calculateAgeDays(point.posted_at);
      
      // Filter out data points older than maxAgeDays
      if (ageDays > maxAgeDays) {
        return null;
      }

      const score = Number(point[scoreField]) || 0;
      const decayed = calculateDecayedScore(score, ageDays, config);

      return {
        ...point,
        decay_factor: decayed.decayFactor,
        effective_score: decayed.effectiveScore,
        age_days: ageDays
      };
    })
    .filter((point): point is NonNullable<typeof point> => point !== null);
}

/**
 * Calculate weighted average with time decay
 * 
 * @param dataPoints - Array of data points with scores and timestamps
 * @param scoreField - Field name containing the score
 * @param config - Time decay configuration
 * @returns Weighted average score
 */
export function calculateWeightedAverage<T extends { posted_at: string | Date; [key: string]: any }>(
  dataPoints: T[],
  scoreField: keyof T,
  config?: TimeDecayConfig
): number {
  const decayedPoints = applyTimeDecay(dataPoints, scoreField, config);

  if (decayedPoints.length === 0) {
    return 0;
  }

  // Calculate weighted average: sum(effective_score) / count
  // Or weighted by decay_factor: sum(score * decay_factor) / sum(decay_factor)
  const totalEffectiveScore = decayedPoints.reduce((sum, point) => sum + point.effective_score, 0);
  const totalDecayFactor = decayedPoints.reduce((sum, point) => sum + point.decay_factor, 0);

  if (totalDecayFactor === 0) {
    return 0;
  }

  // Weighted average: sum(score * weight) / sum(weight)
  return totalEffectiveScore / decayedPoints.length;
}

/**
 * Get decay configuration for different learning contexts
 */
export function getDecayConfig(context: 'generator' | 'topic' | 'tone' | 'hook' | 'default'): TimeDecayConfig {
  switch (context) {
    case 'generator':
      // Generators change slowly - use slower decay
      return { lambda: 0.08, minDecayFactor: 0.2, maxAgeDays: 90 };
    
    case 'topic':
      // Topics can trend quickly - use faster decay
      return { lambda: 0.12, minDecayFactor: 0.1, maxAgeDays: 45 };
    
    case 'tone':
      // Tone preferences change moderately
      return { lambda: 0.1, minDecayFactor: 0.15, maxAgeDays: 60 };
    
    case 'hook':
      // Hook effectiveness can change quickly
      return { lambda: 0.15, minDecayFactor: 0.1, maxAgeDays: 30 };
    
    default:
      return { lambda: 0.1, minDecayFactor: 0.1, maxAgeDays: 60 };
  }
}


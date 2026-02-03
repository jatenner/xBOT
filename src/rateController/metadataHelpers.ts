/**
 * 🏷️ METADATA HELPERS
 * 
 * Helper functions to compute hour_bucket, extract prompt_version, strategy_id
 */

/**
 * Get current hour in America/New_York timezone (0-23)
 */
export function getHourBucketET(): number {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return etTime.getHours();
}

/**
 * Extract prompt_version from decision features or generator_name
 */
export function extractPromptVersion(decision: any): string | null {
  // Check features first
  if (decision.features?.prompt_version) {
    return decision.features.prompt_version;
  }
  
  // Check generator_name (may contain version info)
  if (decision.generator_name) {
    // If generator_name contains version, extract it
    const match = decision.generator_name.match(/v(\d+)/i);
    if (match) {
      return `v${match[1]}`;
    }
  }
  
  // Default version
  return 'v1';
}

/**
 * Extract strategy_id from decision features or generator_name
 */
export function extractStrategyId(decision: any): string | null {
  // Check features first
  if (decision.features?.strategy_id) {
    return decision.features.strategy_id;
  }
  
  // Check generator_name (may indicate strategy)
  if (decision.generator_name) {
    // Map generator names to strategy IDs
    const strategyMap: Record<string, string> = {
      'dataNerd': 'high_topic_fit',
      'contrarian': 'provocative',
      'coach': 'actionable',
      'researcher': 'evidence_based',
    };
    
    for (const [generator, strategy] of Object.entries(strategyMap)) {
      if (decision.generator_name.toLowerCase().includes(generator.toLowerCase())) {
        return strategy;
      }
    }
  }
  
  // Default strategy
  return 'baseline';
}

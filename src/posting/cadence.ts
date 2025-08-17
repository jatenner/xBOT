/**
 * Cadence Control Module with Environment Knobs + Bootstrap Bypass
 * Manages posting frequency with configurable intervals and bootstrap mode
 */

export interface CadenceParams {
  now: Date;
  lastPostAt?: Date;
  format: 'single' | 'thread';
  totalPosts: number;
}

export interface CadenceResult {
  allowed: boolean;
  waitMin: number;
  bootstrapBypass?: boolean;
  reason?: string;
}

/**
 * Check if posting is allowed based on cadence rules
 */
export function checkCadence(params: CadenceParams): CadenceResult {
  const minSingle = parseInt(process.env.POST_MIN_GAP_MINUTES_SINGLE || '60', 10);
  const minThread = parseInt(process.env.POST_MIN_GAP_MINUTES_THREAD || '180', 10);
  const bootstrapMin = parseInt(process.env.BOOTSTRAP_MIN_POSTS || '5', 10);
  const bootstrapGap = parseInt(process.env.BOOTSTRAP_MIN_GAP_MINUTES || '10', 10);

  // Bootstrap mode: if we have fewer than minimum posts, use faster cadence
  if (params.totalPosts < bootstrapMin) {
    if (!params.lastPostAt) {
      return { 
        allowed: true, 
        bootstrapBypass: true, 
        waitMin: 0,
        reason: `bootstrap mode - no previous post (${params.totalPosts}/${bootstrapMin} posts)`
      };
    }
    
    const diffMs = params.now.getTime() - params.lastPostAt.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const allowed = diffMin >= bootstrapGap;
    const waitMin = Math.max(0, bootstrapGap - diffMin);
    
    return { 
      allowed, 
      bootstrapBypass: true, 
      waitMin,
      reason: `bootstrap mode - ${allowed ? 'gap sufficient' : 'gap insufficient'} (${diffMin}min/${bootstrapGap}min, ${params.totalPosts}/${bootstrapMin} posts)`
    };
  }

  // Get minimum gap for this format
  const minGap = params.format === 'thread' ? minThread : minSingle;
  
  // If no previous post, allow immediately
  if (!params.lastPostAt) {
    return { 
      allowed: true, 
      waitMin: 0,
      reason: 'no previous post'
    };
  }

  // Calculate time since last post
  const diffMs = params.now.getTime() - params.lastPostAt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const allowed = diffMin >= minGap;
  const waitMin = Math.max(0, minGap - diffMin);

  return { 
    allowed, 
    waitMin,
    reason: allowed 
      ? `gap sufficient (${diffMin}min >= ${minGap}min)`
      : `gap insufficient (${diffMin}min < ${minGap}min)`
  };
}

/**
 * Log cadence check results
 */
export function logCadenceCheck(params: CadenceParams, result: CadenceResult): void {
  if (result.bootstrapBypass) {
    console.log(`CADENCE_BOOTSTRAP ${JSON.stringify({
      allowed: result.allowed,
      wait_min: result.waitMin,
      total_posts: params.totalPosts,
      bootstrap_min: parseInt(process.env.BOOTSTRAP_MIN_POSTS || '5', 10),
      bootstrap_gap: parseInt(process.env.BOOTSTRAP_MIN_GAP_MINUTES || '10', 10),
      reason: result.reason
    })}`);
  } else {
    console.log(`CADENCE_CHECK ${JSON.stringify({
      allowed: result.allowed,
      wait_min: result.waitMin,
      last_post: params.lastPostAt?.toISOString(),
      format: params.format,
      reason: result.reason
    })}`);
  }
}

/**
 * Get cadence configuration for debugging
 */
export function getCadenceConfig() {
  return {
    POST_MIN_GAP_MINUTES_SINGLE: parseInt(process.env.POST_MIN_GAP_MINUTES_SINGLE || '60', 10),
    POST_MIN_GAP_MINUTES_THREAD: parseInt(process.env.POST_MIN_GAP_MINUTES_THREAD || '180', 10),
    BOOTSTRAP_MIN_POSTS: parseInt(process.env.BOOTSTRAP_MIN_POSTS || '3', 10)
  };
}

/**
 * Enhanced cadence check with automatic logging
 */
export function checkCadenceWithLogging(params: CadenceParams): CadenceResult {
  const result = checkCadence(params);
  logCadenceCheck(params, result);
  return result;
}

/**
 * Calculate next allowed posting time
 */
export function getNextAllowedTime(params: CadenceParams): Date | null {
  const result = checkCadence(params);
  
  if (result.allowed || result.bootstrapBypass) {
    return params.now; // Can post now
  }
  
  const nextTime = new Date(params.now.getTime() + (result.waitMin * 60 * 1000));
  return nextTime;
}

/**
 * Get human-readable cadence status
 */
export function getCadenceStatus(params: CadenceParams): string {
  const result = checkCadence(params);
  
  if (result.bootstrapBypass) {
    return `Bootstrap mode: ${params.totalPosts}/${parseInt(process.env.BOOTSTRAP_MIN_POSTS || '3', 10)} posts`;
  }
  
  if (result.allowed) {
    return `Ready to post (${params.format})`;
  }
  
  const nextTime = getNextAllowedTime(params);
  return `Wait ${result.waitMin} minutes (next: ${nextTime?.toLocaleTimeString()})`;
}

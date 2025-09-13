/**
 * Posting Guard - Ensures POSTING_DISABLED is honored throughout the system
 */

const POSTING_DISABLED = process.env.POSTING_DISABLED === 'true';
const DRY_RUN = process.env.DRY_RUN === 'true';

/**
 * Check if posting is allowed
 */
export function isPostingAllowed(): { allowed: boolean; reason?: string } {
  if (POSTING_DISABLED) {
    return { allowed: false, reason: 'POSTING_DISABLED=true' };
  }
  
  if (DRY_RUN) {
    return { allowed: false, reason: 'DRY_RUN=true' };
  }
  
  return { allowed: true };
}

/**
 * Guard wrapper for posting functions
 */
export function withPostingGuard<T extends (...args: any[]) => any>(
  fn: T,
  context: string = 'unknown'
): T {
  return ((...args: any[]) => {
    const check = isPostingAllowed();
    
    if (!check.allowed) {
      console.log(`🚨 POSTING_FACADE: ${context} - ${check.reason}, skipping post`);
      return Promise.resolve(null);
    }
    
    return fn(...args);
  }) as T;
}

/**
 * Manual check for posting permission
 */
export function checkPostingPermission(context: string = 'unknown'): boolean {
  const check = isPostingAllowed();
  
  if (!check.allowed) {
    console.log(`🚨 POSTING_BLOCKED: ${context} - ${check.reason}`);
    return false;
  }
  
  return true;
}

/**
 * Log posting attempt without actually posting
 */
export function logPostingAttempt(content: string, context: string = 'unknown'): void {
  const check = isPostingAllowed();
  
  if (!check.allowed) {
    console.log(`🚨 POSTING_FACADE: ${context} - ${check.reason}, would have posted:`);
    console.log(`📝 CONTENT_PREVIEW: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
  }
}

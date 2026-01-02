/**
 * 🎯 REPLY JOB ENHANCEMENTS - Phase 2 & 3 Integration
 * Wraps existing replyJob with root resolution + pacing
 */

import { generateReplies as originalGenerateReplies } from './replyJob';
import { checkReplyPacing, calculateNextRunHint } from './replyPacingGuard';
import { ensureReplySchemaColumns } from '../db/autoMigrationGuard';

/**
 * Enhanced reply job with Phase 2 & 3 features
 */
export async function generateRepliesEnhanced(): Promise<void> {
  console.log('[REPLY_JOB_ENHANCED] 🚀 Starting enhanced reply generation...');
  
  // PHASE 3: Check pacing guard FIRST
  const pacingCheck = await checkReplyPacing();
  
  if (!pacingCheck.canReply) {
    const nextHint = calculateNextRunHint(pacingCheck);
    console.log(`[REPLY_JOB] next_run_hint_in_min=${nextHint} reason=${pacingCheck.reason}`);
    
    if (pacingCheck.stats) {
      console.log(`[REPLY_JOB] 📊 Stats: hour=${pacingCheck.stats.hourCount}/4 day=${pacingCheck.stats.dayCount}/40`);
    }
    
    return;
  }
  
  // PHASE 2: Ensure schema is ready
  const schemaCheck = await ensureReplySchemaColumns();
  if (!schemaCheck.allPresent) {
    console.warn(`[REPLY_JOB] ⚠️ Running in degraded mode (schema incomplete)`);
  }
  
  // Call original reply job
  await originalGenerateReplies();
  
  console.log('[REPLY_JOB_ENHANCED] ✅ Enhanced reply generation complete');
}


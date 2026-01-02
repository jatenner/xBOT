/**
 * 🎯 REPLY JOB ENHANCEMENTS - Phase 2 & 3 & 4 Integration
 * Wraps existing replyJob with root resolution + pacing + visibility ranking
 */

import { generateReplies as originalGenerateReplies } from './replyJob';
import { checkReplyPacing, calculateNextRunHint } from './replyPacingGuard';
import { ensureReplySchemaColumns } from '../db/autoMigrationGuard';

/**
 * Enhanced reply job with Phase 2 & 3 & 4 features
 */
export async function generateRepliesEnhanced(): Promise<void> {
  console.log('[REPLY_JOB_ENHANCED] 🚀 Starting enhanced reply generation (root resolution + pacing + visibility ranking)...');
  
  // PHASE 3: Check pacing guard FIRST
  const pacingCheck = await checkReplyPacing();
  
  // 📊 PACING DIAGNOSTIC - Always log this
  console.log('[REPLY_PACING] ═══════════════════════════════════════');
  console.log(`[REPLY_PACING] pass=${pacingCheck.canReply}`);
  if (pacingCheck.stats) {
    console.log(`[REPLY_PACING] hourCount=${pacingCheck.stats.hourCount}/4`);
    console.log(`[REPLY_PACING] dayCount=${pacingCheck.stats.dayCount}/40`);
    if (pacingCheck.stats.lastReplyAt) {
      const lastReplyMinutesAgo = Math.round((Date.now() - new Date(pacingCheck.stats.lastReplyAt).getTime()) / 60000);
      console.log(`[REPLY_PACING] lastReplyAt=${pacingCheck.stats.lastReplyAt} (${lastReplyMinutesAgo} min ago)`);
    } else {
      console.log(`[REPLY_PACING] lastReplyAt=null (no recent replies)`);
    }
  }
  console.log(`[REPLY_PACING] reason=${pacingCheck.reason || 'ok'}`);
  console.log('[REPLY_PACING] ═══════════════════════════════════════');
  
  if (!pacingCheck.canReply) {
    const nextHint = calculateNextRunHint(pacingCheck);
    console.log(`[REPLY_JOB] ⏸️ Pacing blocked. Next allowed in ${nextHint} minutes`);
    return;
  }
  
  // PHASE 2: Ensure schema is ready
  const schemaCheck = await ensureReplySchemaColumns();
  if (!schemaCheck.allPresent) {
    console.warn(`[REPLY_JOB] ⚠️ Running in degraded mode (schema incomplete)`);
  }
  
  // Call original reply job (now includes Phase 4 visibility ranking)
  await originalGenerateReplies();
  
  console.log('[REPLY_JOB_ENHANCED] ✅ Enhanced reply generation complete');
}


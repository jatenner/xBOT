/**
 * Reply System Diagnostic Logging
 * Centralized logging for reply system debugging
 */

export interface ReplyDiagnostics {
  timestamp: Date;
  cycle_number: number;
  
  // Quota state
  quota_hourly: { used: number; limit: number; available: number };
  quota_daily: { used: number; limit: number; available: number };
  time_since_last: { minutes: number; required: number; can_post: boolean };
  
  // Opportunities
  opportunities_pending: number;
  opportunities_found: number;
  opportunities_selected: number;
  
  // Generation
  replies_generated: number;
  replies_queued: number;
  replies_failed: number;
  
  // Reasons
  blocked_reason?: string;
  errors: string[];
  
  // Next cycle
  next_available_at?: Date;
  estimated_next_reply?: Date;
}

export class ReplyDiagnosticLogger {
  private static cycleNumber = 0;
  
  /**
   * Log start of reply cycle
   */
  static logCycleStart(): void {
    this.cycleNumber++;
    console.log('═'.repeat(60));
    console.log(`[REPLY_DIAGNOSTIC] 🔄 CYCLE #${this.cycleNumber} START`);
    console.log(`[REPLY_DIAGNOSTIC] ⏰ ${new Date().toLocaleString()}`);
    console.log('═'.repeat(60));
  }
  
  /**
   * Log quota status
   */
  static logQuotaStatus(diagnostics: Partial<ReplyDiagnostics>): void {
    console.log('[REPLY_DIAGNOSTIC] 📊 QUOTA STATUS:');
    
    if (diagnostics.quota_hourly) {
      const { used, limit, available } = diagnostics.quota_hourly;
      console.log(`  • Hourly: ${used}/${limit} (${available} available)`);
    }
    
    if (diagnostics.quota_daily) {
      const { used, limit, available } = diagnostics.quota_daily;
      console.log(`  • Daily: ${used}/${limit} (${available} available)`);
    }
    
    if (diagnostics.time_since_last) {
      const { minutes, required, can_post } = diagnostics.time_since_last;
      const status = can_post ? '✅' : '❌';
      console.log(`  • Time since last: ${minutes} min (required: ${required} min) ${status}`);
    }
  }
  
  /**
   * Log opportunity status
   */
  static logOpportunityStatus(pending: number, found: number, selected: number): void {
    console.log('[REPLY_DIAGNOSTIC] 🎯 OPPORTUNITIES:');
    console.log(`  • Pending in DB: ${pending}`);
    console.log(`  • Queried: ${found}`);
    console.log(`  • Selected for generation: ${selected}`);
  }
  
  /**
   * Log generation results
   */
  static logGenerationResults(generated: number, queued: number, failed: number): void {
    console.log('[REPLY_DIAGNOSTIC] ✨ GENERATION RESULTS:');
    console.log(`  • Generated: ${generated}`);
    console.log(`  • Queued: ${queued}`);
    console.log(`  • Failed: ${failed}`);
  }
  
  /**
   * Log blocking reason
   */
  static logBlocked(reason: string, nextAvailable?: Date): void {
    console.log('[REPLY_DIAGNOSTIC] 🚫 BLOCKED:');
    console.log(`  • Reason: ${reason}`);
    if (nextAvailable) {
      console.log(`  • Next available: ${nextAvailable.toLocaleString()}`);
    }
  }
  
  /**
   * Log cycle end
   */
  static logCycleEnd(success: boolean, errors: string[] = []): void {
    console.log('─'.repeat(60));
    console.log(`[REPLY_DIAGNOSTIC] ${success ? '✅' : '❌'} CYCLE #${this.cycleNumber} ${success ? 'SUCCESS' : 'FAILED'}`);
    if (errors.length > 0) {
      console.log('[REPLY_DIAGNOSTIC] 🚨 ERRORS:');
      errors.forEach(err => console.log(`  • ${err}`));
    }
    console.log('═'.repeat(60));
    console.log('');
  }
  
  /**
   * Log full diagnostic snapshot
   */
  static logSnapshot(diagnostics: ReplyDiagnostics): void {
    console.log('[REPLY_DIAGNOSTIC] 📸 SYSTEM SNAPSHOT:');
    console.log(JSON.stringify(diagnostics, null, 2));
  }
  
  /**
   * Log SLA miss (expected vs actual)
   */
  static logSlaMiss(data: { expected: number; actual: number; deficit: number; reason: string }): void {
    console.log('[REPLY_SLA] ⚠️ SLA MISS:');
    console.log(`  • Expected: ${data.expected} replies`);
    console.log(`  • Actual: ${data.actual} replies`);
    console.log(`  • Deficit: ${data.deficit} replies`);
    console.log(`  • Reason: ${data.reason}`);
  }
  
  /**
   * Log reply scheduled (for SLA tracking)
   */
  static logReplyScheduled(data: {
    decision_id: string;
    scheduled_at: Date;
    delay_minutes: number;
    target: string;
    generator: string;
  }): void {
    console.log(`[REPLY_SLA] 📅 Scheduled: ${data.decision_id} → @${data.target} at ${data.scheduled_at.toLocaleTimeString()} (${data.delay_minutes}min, ${data.generator})`);
  }
}


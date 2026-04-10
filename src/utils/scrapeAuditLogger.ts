/**
 * SCRAPE AUDIT LOGGER
 *
 * Fire-and-forget utility that logs every scrape attempt (success or failure)
 * to the scrape_audit_log table. Provides forensic audit trail for metrics provenance.
 *
 * NEVER throws — all errors are caught and logged as warnings.
 */

import { getSupabaseClient } from '../db';

export interface ScrapeAuditEntry {
  tweet_id: string;
  decision_id?: string;
  collection_phase: string;
  collection_status: 'success' | 'partial' | 'failed' | 'timeout' | 'auth_failed' | 'consent_blocked' | 'content_mismatch';
  confidence?: number | null;
  source_url?: string;
  raw_values?: any;
  parsed_values?: any;
  error_message?: string;
  page_state?: string;
  duration_ms?: number;
}

export async function logScrapeAudit(entry: ScrapeAuditEntry): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('scrape_audit_log').insert({
      tweet_id: entry.tweet_id,
      decision_id: entry.decision_id,
      collection_phase: entry.collection_phase,
      data_source: 'playwright_scraper',
      collection_status: entry.collection_status,
      confidence: entry.confidence ?? null,
      source_url: entry.source_url,
      raw_values: entry.raw_values,
      parsed_values: entry.parsed_values,
      error_message: entry.error_message,
      page_state: entry.page_state,
      duration_ms: entry.duration_ms,
      scraper_version: 'orchestrator_v2',
    });
  } catch (err: any) {
    console.warn(`[SCRAPE_AUDIT] Failed to log audit (non-fatal): ${err.message}`);
  }
}

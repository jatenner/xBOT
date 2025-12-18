#!/usr/bin/env tsx
/**
 * Truth Audit: Last 24 Hours
 * 
 * Queries database and logs to determine what actually posted,
 * detecting threads based on thread_tweet_ids length > 1
 */

import { getSupabaseClient } from '../src/db/index';
import { execSync } from 'child_process';

interface DecisionRow {
  decision_id: string;
  intended_type: string;
  detected_type: string;
  tweet_id: string | null;
  tweet_ids_count: number;
  status: string;
  posted_at: string | null;
  method: string;
  url: string | null;
  thread_tweet_ids: string | null;
}

interface LogSummary {
  singles: number;
  threads: number;
  replies: number;
  total: number;
}

interface TruthAuditResult {
  dbDecisions: DecisionRow[];
  logSummary: LogSummary;
  mismatches: Array<{
    decision_id: string;
    intended_type: string;
    detected_type: string;
    reason: string;
  }>;
  missingLogs: Array<{
    decision_id: string;
    status: string;
    posted_at: string;
    reason: string;
  }>;
  missingDb: Array<{
    decision_id: string;
    type: string;
    timestamp: string;
  }>;
}

async function queryDatabase(): Promise<DecisionRow[]> {
  const supabase = getSupabaseClient();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  console.log(`[TRUTH_AUDIT] Querying database for decisions updated since ${twentyFourHoursAgo}`);

  // Query content_metadata for decisions updated in last 24h
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, tweet_id, thread_tweet_ids, posted_at, updated_at')
    .gte('updated_at', twentyFourHoursAgo)
    .in('status', ['posted', 'failed', 'retrying'])
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  console.log(`[TRUTH_AUDIT] Found ${data?.length || 0} decisions updated in last 24h`);

  const rows: DecisionRow[] = (data || []).map((row: any) => {
    // Parse thread_tweet_ids
    let tweetIdsCount = 1;
    let threadTweetIds: string[] = [];
    
    if (row.thread_tweet_ids) {
      try {
        threadTweetIds = typeof row.thread_tweet_ids === 'string' 
          ? JSON.parse(row.thread_tweet_ids) 
          : row.thread_tweet_ids;
        tweetIdsCount = Array.isArray(threadTweetIds) ? threadTweetIds.length : 1;
      } catch (e) {
        console.warn(`[TRUTH_AUDIT] Failed to parse thread_tweet_ids for ${row.decision_id}:`, e);
        tweetIdsCount = 1;
      }
    }

    // Detect type: thread if tweetIdsCount > 1
    const detectedType = tweetIdsCount > 1 ? 'thread' : (row.decision_type || 'single');

    // Determine method (infer from thread_tweet_ids presence and count)
    let method = 'unknown';
    if (row.status === 'posted' && row.tweet_id) {
      if (tweetIdsCount > 1) {
        method = 'reply-chain'; // Most likely if we have multiple IDs
      } else {
        method = row.decision_type === 'thread' ? 'native-composer' : 'single';
      }
    }

    // Build URL
    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
    const url = row.tweet_id 
      ? `https://x.com/${username}/status/${row.tweet_id}`
      : null;

    return {
      decision_id: row.decision_id,
      intended_type: row.decision_type || 'single',
      detected_type: detectedType,
      tweet_id: row.tweet_id,
      tweet_ids_count: tweetIdsCount,
      status: row.status,
      posted_at: row.posted_at,
      method: method,
      url: url,
      thread_tweet_ids: row.thread_tweet_ids,
    };
  });

  return rows;
}

async function fetchLogs(): Promise<string> {
  console.log(`[TRUTH_AUDIT] Fetching Railway logs (last 20k lines)...`);
  
  try {
    const logs = execSync(
      'railway logs --service xBOT --lines 20000 2>&1',
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    return logs;
  } catch (error: any) {
    console.warn(`[TRUTH_AUDIT] Failed to fetch logs: ${error.message}`);
    return '';
  }
}

function parseLogs(logs: string): LogSummary & { successLogs: Array<{ decision_id: string; type: string; tweet_ids_count: number; timestamp: string }> } {
  const successLogs: Array<{ decision_id: string; type: string; tweet_ids_count: number; timestamp: string }> = [];
  
  // Match: [POSTING_QUEUE][SUCCESS] decision_id=... type=... tweet_id=... (tweet_ids_count=...)?
  const successPattern = /\[POSTING_QUEUE\]\[SUCCESS\] decision_id=([a-f0-9-]+) type=(\w+)(?: tweet_ids_count=(\d+))?/g;
  
  let match;
  while ((match = successPattern.exec(logs)) !== null) {
    const decisionId = match[1];
    const type = match[2];
    const tweetIdsCount = match[3] ? parseInt(match[3], 10) : 1;
    
    // Extract timestamp from log line (approximate)
    const lineStart = Math.max(0, match.index - 100);
    const lineEnd = Math.min(logs.length, match.index + 200);
    const logLine = logs.substring(lineStart, lineEnd);
    const timestampMatch = logLine.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
    const timestamp = timestampMatch ? timestampMatch[1] : 'unknown';

    successLogs.push({
      decision_id: decisionId,
      type: type,
      tweet_ids_count: tweetIdsCount,
      timestamp: timestamp,
    });
  }

  // Count by type
  const singles = successLogs.filter(l => l.type === 'single').length;
  const threads = successLogs.filter(l => l.type === 'thread' || l.tweet_ids_count > 1).length;
  const replies = successLogs.filter(l => l.type === 'reply').length;

  return {
    singles,
    threads,
    replies,
    total: successLogs.length,
    successLogs,
  };
}

function reconcile(dbDecisions: DecisionRow[], logData: ReturnType<typeof parseLogs>): TruthAuditResult {
  const mismatches: Array<{ decision_id: string; intended_type: string; detected_type: string; reason: string }> = [];
  const missingLogs: Array<{ decision_id: string; status: string; posted_at: string; reason: string }> = [];
  const missingDb: Array<{ decision_id: string; type: string; timestamp: string }> = [];

  // Create maps for quick lookup
  const dbMap = new Map(dbDecisions.map(d => [d.decision_id, d]));
  const logMap = new Map(logData.successLogs.map(l => [l.decision_id, l]));

  // Check for mismatches (intended_type != detected_type)
  for (const dbDecision of dbDecisions) {
    if (dbDecision.intended_type !== dbDecision.detected_type) {
      mismatches.push({
        decision_id: dbDecision.decision_id,
        intended_type: dbDecision.intended_type,
        detected_type: dbDecision.detected_type,
        reason: `thread_tweet_ids length=${dbDecision.tweet_ids_count} > 1`,
      });
    }

    // Check for missing logs
    if (dbDecision.status === 'posted' && !logMap.has(dbDecision.decision_id)) {
      const postedAt = dbDecision.posted_at ? new Date(dbDecision.posted_at) : null;
      const hoursAgo = postedAt ? Math.round((Date.now() - postedAt.getTime()) / (1000 * 60 * 60)) : null;
      
      let reason = 'unknown';
      if (hoursAgo !== null && hoursAgo > 20) {
        reason = 'log_rotation (posted >20h ago)';
      } else if (hoursAgo !== null && hoursAgo > 12) {
        reason = 'likely_log_rotation';
      } else {
        reason = 'service_restart_or_crash';
      }

      missingLogs.push({
        decision_id: dbDecision.decision_id,
        status: dbDecision.status,
        posted_at: dbDecision.posted_at || 'unknown',
        reason: reason,
      });
    }
  }

  // Check for missing DB entries (logs without DB)
  for (const logEntry of logData.successLogs) {
    if (!dbMap.has(logEntry.decision_id)) {
      missingDb.push({
        decision_id: logEntry.decision_id,
        type: logEntry.type,
        timestamp: logEntry.timestamp,
      });
    }
  }

  return {
    dbDecisions,
    logSummary: {
      singles: logData.singles,
      threads: logData.threads,
      replies: logData.replies,
      total: logData.total,
    },
    mismatches,
    missingLogs,
    missingDb,
  };
}

function generateReport(result: TruthAuditResult): string {
  const posted = result.dbDecisions.filter(d => d.status === 'posted');
  const postedSingles = posted.filter(d => d.detected_type === 'single').length;
  const postedThreads = posted.filter(d => d.detected_type === 'thread').length;
  const postedReplies = posted.filter(d => d.intended_type === 'reply').length;

  const recentThreads = posted
    .filter(d => d.detected_type === 'thread')
    .sort((a, b) => {
      const aTime = a.posted_at ? new Date(a.posted_at).getTime() : 0;
      const bTime = b.posted_at ? new Date(b.posted_at).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 10);

  let report = `# Truth Audit: Last 24 Hours\n\n`;
  report += `**Date:** ${new Date().toISOString()}\n\n`;
  report += `---\n\n`;

  report += `## Totals\n\n`;
  report += `- **Posted Singles:** ${postedSingles}\n`;
  report += `- **Posted Threads:** ${postedThreads}\n`;
  report += `- **Posted Replies:** ${postedReplies}\n`;
  report += `- **Total Posted:** ${posted.length}\n`;
  report += `- **Failed/Retrying:** ${result.dbDecisions.filter(d => d.status !== 'posted').length}\n\n`;

  report += `## Log Summary\n\n`;
  report += `- **Log Singles:** ${result.logSummary.singles}\n`;
  report += `- **Log Threads:** ${result.logSummary.threads}\n`;
  report += `- **Log Replies:** ${result.logSummary.replies}\n`;
  report += `- **Total Log Entries:** ${result.logSummary.total}\n\n`;

  report += `## Mismatches (intended_type vs detected_type)\n\n`;
  if (result.mismatches.length === 0) {
    report += `✅ No mismatches found.\n\n`;
  } else {
    report += `Found ${result.mismatches.length} mismatches:\n\n`;
    report += `| decision_id | intended_type | detected_type | reason |\n`;
    report += `|-------------|---------------|---------------|--------|\n`;
    for (const mismatch of result.mismatches.slice(0, 20)) {
      report += `| ${mismatch.decision_id.substring(0, 8)}... | ${mismatch.intended_type} | ${mismatch.detected_type} | ${mismatch.reason} |\n`;
    }
    report += `\n`;
  }

  report += `## Missing Logs (DB posted but no SUCCESS log)\n\n`;
  if (result.missingLogs.length === 0) {
    report += `✅ All posted decisions have SUCCESS logs.\n\n`;
  } else {
    report += `Found ${result.missingLogs.length} posted decisions without SUCCESS logs:\n\n`;
    report += `| decision_id | status | posted_at | reason |\n`;
    report += `|-------------|--------|-----------|--------|\n`;
    for (const missing of result.missingLogs.slice(0, 20)) {
      report += `| ${missing.decision_id.substring(0, 8)}... | ${missing.status} | ${missing.posted_at} | ${missing.reason} |\n`;
    }
    report += `\n`;
  }

  report += `## Missing DB (SUCCESS log but no DB entry)\n\n`;
  if (result.missingDb.length === 0) {
    report += `✅ All SUCCESS logs have DB entries.\n\n`;
  } else {
    report += `Found ${result.missingDb.length} SUCCESS logs without DB entries:\n\n`;
    report += `| decision_id | type | timestamp |\n`;
    report += `|-------------|------|-----------|\n`;
    for (const missing of result.missingDb.slice(0, 20)) {
      report += `| ${missing.decision_id.substring(0, 8)}... | ${missing.type} | ${missing.timestamp} |\n`;
    }
    report += `\n`;
  }

  report += `## Top 10 Most Recent Threads\n\n`;
  if (recentThreads.length === 0) {
    report += `No threads found in last 24 hours.\n\n`;
  } else {
    report += `| decision_id | tweet_ids_count | method | posted_at | url |\n`;
    report += `|-------------|-----------------|--------|-----------|-----|\n`;
    for (const thread of recentThreads) {
      report += `| ${thread.decision_id.substring(0, 8)}... | ${thread.tweet_ids_count} | ${thread.method} | ${thread.posted_at || 'N/A'} | ${thread.url || 'N/A'} |\n`;
    }
    report += `\n`;
  }

  report += `---\n\n`;
  report += `**Report Generated:** ${new Date().toISOString()}\n`;

  return report;
}

async function main() {
  try {
    console.log(`[TRUTH_AUDIT] Starting truth audit for last 24 hours...\n`);

    // Query database
    const dbDecisions = await queryDatabase();

    // Fetch and parse logs
    const logs = await fetchLogs();
    const logData = parseLogs(logs);

    // Reconcile
    const result = reconcile(dbDecisions, logData);

    // Generate report
    const report = generateReport(result);

    // Write report
    const fs = await import('fs/promises');
    const reportPath = 'docs/reports/TRUTH_AUDIT_LAST24H.md';
    await fs.writeFile(reportPath, report, 'utf-8');

    console.log(`\n[TRUTH_AUDIT] ✅ Report generated: ${reportPath}\n`);

    // Print summary to console
    console.log(`Summary:`);
    console.log(`- DB Posted: ${dbDecisions.filter(d => d.status === 'posted').length}`);
    console.log(`- DB Threads: ${dbDecisions.filter(d => d.status === 'posted' && d.detected_type === 'thread').length}`);
    console.log(`- Log SUCCESS entries: ${logData.total}`);
    console.log(`- Mismatches: ${result.mismatches.length}`);
    console.log(`- Missing logs: ${result.missingLogs.length}`);
    console.log(`- Missing DB: ${result.missingDb.length}`);

  } catch (error: any) {
    console.error(`[TRUTH_AUDIT] ❌ Error:`, error.message);
    process.exit(1);
  }
}

main();


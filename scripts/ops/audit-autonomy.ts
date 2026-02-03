#!/usr/bin/env tsx
/**
 * 🔍 OPS:AUDIT:AUTONOMY - Complete Autonomy Readiness Audit
 * 
 * Comprehensive audit of posts + threads + replies + learning + safety.
 * 
 * Usage:
 *   pnpm run ops:audit:autonomy
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getSupabaseClient } from '../../src/db/index';
import { getRunnerPaths } from '../../src/infra/runnerProfile';

const REPORT_DIR = path.join(process.cwd(), 'docs', 'AUDITS');
const REPORT_PATH = path.join(REPORT_DIR, 'AUTONOMY_AUDIT_LATEST.md');
const LEDGER_PATH = path.join(process.cwd(), 'docs', 'proofs', 'execution', 'execution-ledger.jsonl');
const AUTH_LEDGER_PATH = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'ops-up-fast-ledger.jsonl');

interface AuditResult {
  control_plane_healthy: boolean;
  supply_healthy: boolean;
  planner_active: boolean;
  executor_ready: boolean;
  execution_proven: boolean;
  learning_active: boolean;
  top_blocker?: string;
  readiness_score: 'YES' | 'NO';
}

function findLatestReport(pattern: string, dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter(f => f.includes(pattern) && (f.endsWith('.md') || f.endsWith('.jsonl')))
    .map(f => ({
      name: f,
      path: path.join(dir, f),
      mtime: fs.statSync(path.join(dir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? files[0].path : null;
}

function readLedger(ledgerPath: string): any[] {
  if (!fs.existsSync(ledgerPath)) {
    return [];
  }
  const lines = fs.readFileSync(ledgerPath, 'utf-8')
    .split('\n')
    .filter(line => line.trim().length > 0);
  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(entry => entry !== null);
}

async function checkRailwayHealth(service: string): Promise<{ healthy: boolean; sha?: string; executionMode?: string; error?: string }> {
  try {
    const url = service === 'xBOT' 
      ? 'https://xbot-production-844b.up.railway.app/healthz'
      : 'https://serene-cat-production.up.railway.app/healthz';
    
    const output = execSync(`curl -s ${url}`, { encoding: 'utf-8', timeout: 10000 });
    const health = JSON.parse(output);
    
    return {
      healthy: true,
      sha: health.sha,
      executionMode: health.executionMode,
    };
  } catch (e: any) {
    return {
      healthy: false,
      error: e.message,
    };
  }
}

async function checkSchedulerTicks(supabase: any): Promise<{
  posting_tick: boolean;
  reply_tick: boolean;
  learning_tick: boolean;
  missing_ticks: string[];
}> {
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: ticks } = await supabase
    .from('system_events')
    .select('event_type')
    .gte('created_at', sixtyMinutesAgo)
    .in('event_type', ['POSTING_QUEUE_TICK', 'REPLY_QUEUE_TICK', 'METRICS_SCRAPER_TICK', 'LEARNING_JOB_TICK']);
  
  const tickTypes = new Set(ticks?.map((t: any) => t.event_type) || []);
  
  const posting_tick = tickTypes.has('POSTING_QUEUE_TICK');
  const reply_tick = tickTypes.has('REPLY_QUEUE_TICK');
  const learning_tick = tickTypes.has('METRICS_SCRAPER_TICK') || tickTypes.has('LEARNING_JOB_TICK');
  
  const missing_ticks: string[] = [];
  if (!posting_tick) missing_ticks.push('POSTING_QUEUE_TICK');
  if (!reply_tick) missing_ticks.push('REPLY_QUEUE_TICK');
  if (!learning_tick) missing_ticks.push('LEARNING_TICK');
  
  return { posting_tick, reply_tick, learning_tick, missing_ticks };
}

async function checkSupplyHealth(supabase: any): Promise<{
  reply_opportunities_total: number;
  reply_opportunities_passed_filters: number;
  reply_opportunities_accessibility: Record<string, number>;
  reply_opportunities_freshness: Record<string, number>;
  content_candidates: any;
  can_self_supply: boolean;
}> {
  // Reply opportunities
  const { data: allOpps } = await supabase
    .from('reply_opportunities')
    .select('passed_hard_filters, accessibility_status, created_at, tweet_posted_at');
  
  const total = allOpps?.length || 0;
  const passedFilters = allOpps?.filter((o: any) => o.passed_hard_filters === true).length || 0;
  
  const accessibility: Record<string, number> = {};
  allOpps?.forEach((o: any) => {
    const status = o.accessibility_status || 'unknown';
    accessibility[status] = (accessibility[status] || 0) + 1;
  });
  
  // Freshness distribution (last 24h, 7d, 30d)
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  const freshness: Record<string, number> = {
    'last_24h': 0,
    'last_7d': 0,
    'last_30d': 0,
    'older': 0,
  };
  
  allOpps?.forEach((o: any) => {
    const created = new Date(o.created_at).getTime();
    if (created >= oneDayAgo) {
      freshness['last_24h']++;
    } else if (created >= sevenDaysAgo) {
      freshness['last_7d']++;
    } else if (created >= thirtyDaysAgo) {
      freshness['last_30d']++;
    } else {
      freshness['older']++;
    }
  });
  
  // Content candidates (check content_metadata or content_generation_metadata_comprehensive)
  let contentCandidates: any = { implemented: false };
  try {
    const { data: candidates } = await supabase
      .from('content_metadata')
      .select('status, created_at, decision_type')
      .limit(1000);
    
    if (candidates) {
      const byStatus: Record<string, number> = {};
      const byType: Record<string, number> = {};
      candidates.forEach((c: any) => {
        byStatus[c.status || 'unknown'] = (byStatus[c.status || 'unknown'] || 0) + 1;
        byType[c.decision_type || 'unknown'] = (byType[c.decision_type || 'unknown'] || 0) + 1;
      });
      
      contentCandidates = {
        implemented: true,
        total: candidates.length,
        by_status: byStatus,
        by_type: byType,
      };
    }
  } catch (e) {
    // Table might not exist or have different schema
    contentCandidates = { implemented: false, error: (e as Error).message };
  }
  
  const can_self_supply = passedFilters >= 10 && freshness['last_24h'] > 0;
  
  return {
    reply_opportunities_total: total,
    reply_opportunities_passed_filters: passedFilters,
    reply_opportunities_accessibility: accessibility,
    reply_opportunities_freshness: freshness,
    content_candidates: contentCandidates,
    can_self_supply,
  };
}

async function checkPlannerOutput(supabase: any): Promise<{
  decisions_last_24h: number;
  by_pipeline_source: Record<string, number>;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  starvation_reasons: string[];
}> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  let decisions: any[] = [];
  try {
    const { data } = await supabase
      .from('content_metadata')
      .select('pipeline_source, status, decision_type, created_at')
      .gte('created_at', twentyFourHoursAgo);
    decisions = data || [];
  } catch (e) {
    // Table might not exist
  }
  
  const byPipelineSource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  
  decisions.forEach((d: any) => {
    const source = d.pipeline_source || 'unknown';
    const status = d.status || 'unknown';
    const type = d.decision_type || 'unknown';
    
    byPipelineSource[source] = (byPipelineSource[source] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
    byType[type] = (byType[type] || 0) + 1;
  });
  
  // Check for starvation events
  const { data: starvationEvents } = await supabase
    .from('system_events')
    .select('event_type, event_data')
    .gte('created_at', twentyFourHoursAgo)
    .in('event_type', ['NO_ELIGIBLE_TARGETS', 'REPLY_QUEUE_BLOCKED', 'POSTING_QUEUE_BLOCKED']);
  
  const starvationReasons: string[] = [];
  starvationEvents?.forEach((e: any) => {
    starvationReasons.push(e.event_type);
  });
  
  return {
    decisions_last_24h: decisions.length,
    by_pipeline_source: byPipelineSource,
    by_status: byStatus,
    by_type: byType,
    starvation_reasons: [...new Set(starvationReasons)],
  };
}

async function checkExecutorReadiness(): Promise<{
  status_summary: string;
  auth_ok_age_minutes: number | null;
  auth_events_classification: Record<string, number>;
  auth_persistence_result: string;
}> {
  const paths = getRunnerPaths();
  const authOkPath = paths.auth_marker_path;
  
  let authOkAge: number | null = null;
  if (fs.existsSync(authOkPath)) {
    try {
      const content = fs.readFileSync(authOkPath, 'utf-8');
      const data = JSON.parse(content);
      const authTime = new Date(data.timestamp).getTime();
      authOkAge = Math.floor((Date.now() - authTime) / 1000 / 60);
    } catch (e) {
      // Ignore
    }
  }
  
  // Get executor status
  let statusSummary = 'unknown';
  try {
    const output = execSync('pnpm run ops:executor:status', { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 });
    statusSummary = output.split('\n').slice(0, 5).join(' | ');
  } catch (e) {
    statusSummary = 'executor_status_failed';
  }
  
  // Get last 20 auth events
  const supabase = getSupabaseClient();
  const { data: authEvents } = await supabase
    .from('system_events')
    .select('event_type')
    .in('event_type', ['EXECUTOR_AUTH_INVALID', 'EXECUTOR_AUTH_REQUIRED', 'EXECUTOR_AUTH_VERIFIED', 'EXECUTOR_AUTH_OK', 'EXECUTOR_AUTH_CHALLENGE_DETECTED'])
    .order('created_at', { ascending: false })
    .limit(20);
  
  const classification: Record<string, number> = {};
  authEvents?.forEach((e: any) => {
    classification[e.event_type] = (classification[e.event_type] || 0) + 1;
  });
  
  // Check latest auth persistence report
  const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
  const persistenceReport = findLatestReport('auth-persistence', reportsDir);
  let persistenceResult = 'no_report';
  if (persistenceReport && fs.existsSync(persistenceReport)) {
    try {
      const content = fs.readFileSync(persistenceReport, 'utf-8');
      if (content.includes('Status:** ✅ **PASS**')) {
        persistenceResult = 'PASS';
      } else if (content.includes('Status:** ❌ **FAIL**')) {
        persistenceResult = 'FAIL';
      } else {
        persistenceResult = 'incomplete';
      }
    } catch (e) {
      persistenceResult = 'unreadable';
    }
  }
  
  return {
    status_summary: statusSummary,
    auth_ok_age_minutes: authOkAge,
    auth_events_classification: classification,
    auth_persistence_result: persistenceResult,
  };
}

async function checkExecutionProofs(): Promise<{
  total_runs: number;
  success_rate: number;
  median_time_to_success: number | null;
  failure_classifications: Record<string, number>;
  by_proof_type: Record<string, any>;
}> {
  const runs = readLedger(LEDGER_PATH);
  const recentRuns = runs.slice(-20);
  
  const successfulRuns = recentRuns.filter((r: any) => r.passed === true);
  const successRate = recentRuns.length > 0 ? (successfulRuns.length / recentRuns.length) * 100 : 0;
  
  const timeToSuccessValues = successfulRuns
    .filter((r: any) => r.time_to_success_seconds !== undefined)
    .map((r: any) => r.time_to_success_seconds!)
    .sort((a, b) => a - b);
  
  const medianTimeToSuccess = timeToSuccessValues.length > 0
    ? timeToSuccessValues[Math.floor(timeToSuccessValues.length / 2)]
    : null;
  
  const failureClassifications: Record<string, number> = {};
  recentRuns.forEach((r: any) => {
    if (!r.passed && r.failure_classification) {
      failureClassifications[r.failure_classification] = (failureClassifications[r.failure_classification] || 0) + 1;
    }
  });
  
  const byProofType: Record<string, any> = {};
  recentRuns.forEach((r: any) => {
    const type = r.proof_type || 'unknown';
    if (!byProofType[type]) {
      byProofType[type] = { total: 0, passed: 0, failed: 0 };
    }
    byProofType[type].total++;
    if (r.passed) {
      byProofType[type].passed++;
    } else {
      byProofType[type].failed++;
    }
  });
  
  return {
    total_runs: recentRuns.length,
    success_rate: successRate,
    median_time_to_success: medianTimeToSuccess,
    failure_classifications: failureClassifications,
    by_proof_type: byProofType,
  };
}

async function checkLearning(supabase: any): Promise<{
  outcomes_last_24h: number;
  rewards_last_updated: string | null;
  top_strategies: any[];
  strategy_attribution_coverage: number;
}> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Outcomes count
  let outcomesCount = 0;
  try {
    const { count } = await supabase
      .from('outcomes')
      .select('*', { count: 'exact', head: true })
      .gte('collected_at', twentyFourHoursAgo);
    outcomesCount = count || 0;
  } catch (e) {
    // Table might not exist
  }
  
  // Rewards table
  let rewardsLastUpdated: string | null = null;
  let topStrategies: any[] = [];
  try {
    const { data: rewards } = await supabase
      .from('strategy_rewards')
      .select('strategy_id, mean_reward, updated_at')
      .order('mean_reward', { ascending: false })
      .limit(10);
    
    if (rewards && rewards.length > 0) {
      topStrategies = rewards;
      const latest = rewards.reduce((latest: any, r: any) => {
        return !latest || new Date(r.updated_at) > new Date(latest.updated_at) ? r : latest;
      }, null);
      rewardsLastUpdated = latest?.updated_at || null;
    }
  } catch (e) {
    // Table might not exist
  }
  
  // Strategy attribution coverage
  let strategyCoverage = 0;
  try {
    const { data: decisions } = await supabase
      .from('content_metadata')
      .select('strategy_id')
      .limit(1000);
    
    if (decisions && decisions.length > 0) {
      const withStrategy = decisions.filter((d: any) => d.strategy_id).length;
      strategyCoverage = (withStrategy / decisions.length) * 100;
    }
  } catch (e) {
    // Table might not exist
  }
  
  return {
    outcomes_last_24h: outcomesCount,
    rewards_last_updated: rewardsLastUpdated,
    top_strategies: topStrategies,
    strategy_attribution_coverage: strategyCoverage,
  };
}

function calculateReadinessScore(
  controlHealthy: boolean,
  authPersistence: string,
  authRuns: any[],
  executionRate: number,
  outcomesCount: number
): { ready: 'YES' | 'NO'; blocker?: string } {
  // Check auth persistence: >= 60 minutes with 0 failures OR last 3 runs PASS
  let authPersistenceOk = false;
  if (authPersistence === 'PASS') {
    authPersistenceOk = true;
  } else {
    const recentAuthRuns = authRuns.slice(-3);
    if (recentAuthRuns.length >= 3) {
      const allPassed = recentAuthRuns.every((r: any) => r.passed === true);
      if (allPassed) {
        authPersistenceOk = true;
      }
    }
  }
  
  if (!controlHealthy) {
    return { ready: 'NO', blocker: 'CONTROL_PLANE_DOWN' };
  }
  
  if (!authPersistenceOk) {
    return { ready: 'NO', blocker: 'AUTH_PERSISTENCE_FAILED' };
  }
  
  if (executionRate < 70) {
    return { ready: 'NO', blocker: 'EXECUTION_SUCCESS_RATE_LOW' };
  }
  
  if (outcomesCount === 0) {
    return { ready: 'NO', blocker: 'NO_OUTCOMES_COLLECTED' };
  }
  
  return { ready: 'YES' };
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 AUTONOMY READINESS AUDIT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  const timestamp = new Date().toISOString();
  
  // 1. Control-plane Health
  console.log('📋 Checking control-plane health...');
  const xbotHealth = await checkRailwayHealth('xBOT');
  const sereneHealth = await checkRailwayHealth('serene-cat');
  const schedulerTicks = await checkSchedulerTicks(supabase);
  
  // 2. Supply Health
  console.log('📋 Checking supply health...');
  const supplyHealth = await checkSupplyHealth(supabase);
  
  // 3. Planner Output
  console.log('📋 Checking planner output...');
  const plannerOutput = await checkPlannerOutput(supabase);
  
  // 4. Executor Readiness
  console.log('📋 Checking executor readiness...');
  const executorReadiness = await checkExecutorReadiness();
  
  // 5. Execution Proofs
  console.log('📋 Checking execution proofs...');
  const executionProofs = await checkExecutionProofs();
  
  // 6. Learning
  console.log('📋 Checking learning...');
  const learning = await checkLearning(supabase);
  
  // 7. Auth runs for persistence check
  const authRuns = readLedger(AUTH_LEDGER_PATH);
  
  // Calculate readiness score
  const controlHealthy = xbotHealth.healthy && sereneHealth.healthy && schedulerTicks.posting_tick && schedulerTicks.reply_tick;
  const readiness = calculateReadinessScore(
    controlHealthy,
    executorReadiness.auth_persistence_result,
    authRuns,
    executionProofs.success_rate,
    learning.outcomes_last_24h
  );
  
  // Generate report
  const report = `# Autonomy Readiness Audit

**Generated:** ${timestamp}
**Audit ID:** ${Date.now()}

## Control-plane Health

### Railway Services

**xBOT Service:**
- **Healthy:** ${xbotHealth.healthy ? '✅ YES' : '❌ NO'}
${xbotHealth.sha ? `- **SHA:** ${xbotHealth.sha}` : ''}
${xbotHealth.executionMode ? `- **Execution Mode:** ${xbotHealth.executionMode}` : ''}
${xbotHealth.error ? `- **Error:** ${xbotHealth.error}` : ''}

**serene-cat Service:**
- **Healthy:** ${sereneHealth.healthy ? '✅ YES' : '❌ NO'}
${sereneHealth.sha ? `- **SHA:** ${sereneHealth.sha}` : ''}
${sereneHealth.executionMode ? `- **Execution Mode:** ${sereneHealth.executionMode}` : ''}
${sereneHealth.error ? `- **Error:** ${sereneHealth.error}` : ''}

### Scheduler Ticks (Last 60 Minutes)

- **POSTING_QUEUE_TICK:** ${schedulerTicks.posting_tick ? '✅ Present' : '❌ Missing'}
- **REPLY_QUEUE_TICK:** ${schedulerTicks.reply_tick ? '✅ Present' : '❌ Missing'}
- **LEARNING_TICK:** ${schedulerTicks.learning_tick ? '✅ Present' : '❌ Missing'}

${schedulerTicks.missing_ticks.length > 0 ? `**Missing Ticks:** ${schedulerTicks.missing_ticks.join(', ')}` : ''}

---

## Supply Health

### Reply Opportunities

- **Total:** ${supplyHealth.reply_opportunities_total}
- **Passed Hard Filters:** ${supplyHealth.reply_opportunities_passed_filters}
- **Accessibility Status Distribution:**
${Object.entries(supplyHealth.reply_opportunities_accessibility).map(([status, count]) => `  - ${status}: ${count}`).join('\n')}
- **Freshness Distribution:**
  - Last 24h: ${supplyHealth.reply_opportunities_freshness['last_24h']}
  - Last 7d: ${supplyHealth.reply_opportunities_freshness['last_7d']}
  - Last 30d: ${supplyHealth.reply_opportunities_freshness['last_30d']}
  - Older: ${supplyHealth.reply_opportunities_freshness['older']}

### Content Candidates

${supplyHealth.content_candidates.implemented ? `
- **Total:** ${supplyHealth.content_candidates.total}
- **By Status:**
${Object.entries(supplyHealth.content_candidates.by_status || {}).map(([status, count]) => `  - ${status}: ${count}`).join('\n')}
- **By Type:**
${Object.entries(supplyHealth.content_candidates.by_type || {}).map(([type, count]) => `  - ${type}: ${count}`).join('\n')}
` : `
- **Status:** Not implemented or table not accessible
${supplyHealth.content_candidates.error ? `- **Error:** ${supplyHealth.content_candidates.error}` : ''}
`}

### Self-Supply Capability

- **Can Self-Supply:** ${supplyHealth.can_self_supply ? '✅ YES' : '❌ NO'}
  - Requires: >= 10 passed filters AND > 0 opportunities in last 24h

---

## Planner Output

### Decisions Created (Last 24h)

- **Total:** ${plannerOutput.decisions_last_24h}

**By Pipeline Source:**
${Object.entries(plannerOutput.by_pipeline_source).map(([source, count]) => `- ${source}: ${count}`).join('\n') || '- None'}

**By Status:**
${Object.entries(plannerOutput.by_status).map(([status, count]) => `- ${status}: ${count}`).join('\n') || '- None'}

**By Type:**
${Object.entries(plannerOutput.by_type).map(([type, count]) => `- ${type}: ${count}`).join('\n') || '- None'}

### Starvation Reasons

${plannerOutput.starvation_reasons.length > 0 
  ? plannerOutput.starvation_reasons.map(r => `- ${r}`).join('\n')
  : '- None detected'}

---

## Executor Readiness

### Status Summary

\`\`\`
${executorReadiness.status_summary}
\`\`\`

### Authentication

- **AUTH_OK Age:** ${executorReadiness.auth_ok_age_minutes !== null ? `${executorReadiness.auth_ok_age_minutes} minutes` : 'Marker missing'}
- **Last Auth Persistence Result:** ${executorReadiness.auth_persistence_result}
- **Last 20 Auth Events Classification:**
${Object.entries(executorReadiness.auth_events_classification).map(([type, count]) => `  - ${type}: ${count}`).join('\n') || '  - None'}

---

## Execution Proofs

### Summary (Last 20 Runs)

- **Total Runs:** ${executionProofs.total_runs}
- **Success Rate:** ${executionProofs.success_rate.toFixed(1)}%
- **Median Time-to-Success:** ${executionProofs.median_time_to_success !== null ? `${executionProofs.median_time_to_success}s` : 'N/A'}

### Failure Classifications

${Object.entries(executionProofs.failure_classifications).map(([classification, count]) => `- ${classification}: ${count}`).join('\n') || '- None'}

### By Proof Type

${Object.entries(executionProofs.by_proof_type).map(([type, stats]: [string, any]) => `
**${type}:**
- Total: ${stats.total}
- Passed: ${stats.passed}
- Failed: ${stats.failed}
- Success Rate: ${stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0}%
`).join('\n') || '- No proof data'}

---

## Measurement + Learning

### Outcomes

- **Outcomes Collected (Last 24h):** ${learning.outcomes_last_24h}

### Rewards

- **Last Updated:** ${learning.rewards_last_updated || 'N/A'}

**Top 10 Strategies by Mean Reward:**
${learning.top_strategies.length > 0
  ? learning.top_strategies.map((s: any, i: number) => `${i + 1}. ${s.strategy_id}: ${s.mean_reward?.toFixed(4) || 'N/A'}`).join('\n')
  : '- No strategy rewards data'}

### Strategy Attribution Coverage

- **Coverage:** ${learning.strategy_attribution_coverage.toFixed(1)}% of decisions have strategy_id

---

## Autonomy Readiness Score

**Readiness:** ${readiness.ready === 'YES' ? '✅ YES' : '❌ NO'}
${readiness.blocker ? `**Top Blocker:** ${readiness.blocker}` : ''}

### Requirements Met

- ✅ Control-plane ticks present: ${controlHealthy ? 'YES' : 'NO'}
- ✅ Auth persistence >= 60 min OR last 3 runs PASS: ${executorReadiness.auth_persistence_result === 'PASS' || (authRuns.slice(-3).length >= 3 && authRuns.slice(-3).every((r: any) => r.passed)) ? 'YES' : 'NO'}
- ✅ Execution success rate >= 70%: ${executionProofs.success_rate >= 70 ? 'YES' : 'NO'} (${executionProofs.success_rate.toFixed(1)}%)
- ✅ Outcomes collected in last 24h: ${learning.outcomes_last_24h > 0 ? 'YES' : 'NO'} (${learning.outcomes_last_24h} outcomes)

---

**AUTONOMY_READY=${readiness.ready}${readiness.blocker ? ` reason=${readiness.blocker}` : ''}
`;

  // Write report
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  fs.writeFileSync(REPORT_PATH, report, 'utf-8');
  
  console.log(`\n✅ Audit complete`);
  console.log(`📄 Report written: ${REPORT_PATH}`);
  console.log(`\n${readiness.ready === 'YES' ? '✅' : '❌'} AUTONOMY_READY=${readiness.ready}${readiness.blocker ? ` reason=${readiness.blocker}` : ''}\n`);
  
  process.exit(readiness.ready === 'YES' ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

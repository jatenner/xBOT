#!/usr/bin/env tsx
/**
 * 🔬 AUTH PERSISTENCE ROOT CAUSE ANALYZER
 * 
 * Analyzes matrix results and generates root cause determination
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const MATRIX_RESULTS_FILE = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'auth-persistence-matrix.jsonl');
const REPORTS_DIR = path.join(process.cwd(), 'docs', 'proofs', 'auth');
const ROOT_CAUSE_REPORT = path.join(process.cwd(), 'docs', 'proofs', 'auth', 'AUTH_PERSISTENCE_ROOT_CAUSE.md');

interface MatrixResult {
  ts: string;
  tick_seconds: number;
  jitter: boolean;
  duration: number;
  pass: boolean;
  first_failure_minute: number | null;
  reason: string | null;
  report_path: string;
}

interface ForensicsSnapshot {
  timestamp: string;
  minute: number;
  final_url: string;
  logged_in: boolean;
  reason: string;
  cookie_count_x_com: number;
  cookie_count_twitter_com: number;
  has_auth_token: boolean;
  has_ct0: boolean;
  has_twid: boolean;
  has_cf_clearance: boolean;
  auth_token_expiry: number | null;
  ct0_expiry: number | null;
  twid_expiry: number | null;
  cf_clearance_expiry: number | null;
  localStorage_keys_count: number;
  sessionStorage_keys_count: number;
  indexeddb_exists: boolean;
  indexeddb_count: number;
  redirect_chain?: string[];
}

function readMatrixResults(): MatrixResult[] {
  if (!fs.existsSync(MATRIX_RESULTS_FILE)) {
    return [];
  }
  
  const lines = fs.readFileSync(MATRIX_RESULTS_FILE, 'utf-8')
    .split('\n')
    .filter(line => line.trim().length > 0);
  
  return lines.map(line => {
    try {
      return JSON.parse(line) as MatrixResult;
    } catch {
      return null;
    }
  }).filter((r): r is MatrixResult => r !== null);
}

function findForensicsSnapshots(reportPath: string): { baseline: ForensicsSnapshot | null; failure: ForensicsSnapshot | null } {
  const reportDir = path.dirname(reportPath);
  const reportBase = path.basename(reportPath, '.md');
  
  // Find snapshots for this report
  const snapshots = fs.readdirSync(reportDir)
    .filter(f => f.includes('b64-auth-flip-snapshot') && f.endsWith('.json'))
    .map(f => {
      const fullPath = path.join(reportDir, f);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return JSON.parse(content) as ForensicsSnapshot;
      } catch {
        return null;
      }
    })
    .filter((s): s is ForensicsSnapshot => s !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  const baseline = snapshots.find(s => s.minute === 0) || snapshots[0] || null;
  const failure = snapshots.find(s => !s.logged_in && s.reason !== 'ok') || snapshots[snapshots.length - 1] || null;
  
  return { baseline, failure };
}

function determineRootCause(results: MatrixResult[]): {
  determination: 'EXPIRY/ROTATION' | 'REVOCATION_BY_PATTERN' | 'COOKIE_ONLY_INSUFFICIENT';
  explanation: string;
  smallestFix: string;
} {
  if (results.length === 0) {
    return {
      determination: 'COOKIE_ONLY_INSUFFICIENT',
      explanation: 'No matrix results available. Need to run persistence matrix.',
      smallestFix: 'Run: pnpm run ops:auth:persistence:matrix',
    };
  }
  
  // Check if any variant passed
  const passedVariants = results.filter(r => r.pass);
  if (passedVariants.length > 0) {
    const best = passedVariants[0];
    return {
      determination: 'REVOCATION_BY_PATTERN',
      explanation: `Variant with ${best.tick_seconds}s ticks${best.jitter ? ' + jitter' : ''} passed. Baseline (60s) failed, suggesting pattern detection.`,
      smallestFix: `Use tick interval of ${best.tick_seconds}s with jitter enabled. Adjust daemon cadence accordingly.`,
    };
  }
  
  // All failed - check failure patterns
  const failureMinutes = results.map(r => r.first_failure_minute).filter((m): m is number => m !== null);
  const avgFailureMinute = failureMinutes.length > 0 
    ? failureMinutes.reduce((a, b) => a + b, 0) / failureMinutes.length 
    : 0;
  
  // Check if B/C improved over A
  const variantA = results.find(r => r.tick_seconds === 60 && !r.jitter);
  const variantB = results.find(r => r.tick_seconds === 180 && r.jitter);
  const variantC = results.find(r => r.tick_seconds === 300 && r.jitter);
  
  if (variantB && variantA && variantB.first_failure_minute !== null && variantA.first_failure_minute !== null) {
    if (variantB.first_failure_minute > variantA.first_failure_minute) {
      return {
        determination: 'REVOCATION_BY_PATTERN',
        explanation: `Variant B (180s + jitter) failed later (min ${variantB.first_failure_minute}) than A (min ${variantA.first_failure_minute}), suggesting pattern detection.`,
        smallestFix: 'Adjust daemon cadence to 180s+ ticks with ±20% jitter. Stop aggressive /home polling.',
      };
    }
  }
  
  // Check forensics for cookie expiry/rotation
  if (variantA) {
    const forensics = findForensicsSnapshots(variantA.report_path);
    if (forensics.baseline && forensics.failure) {
      const authTokenDisappeared = forensics.baseline.has_auth_token && !forensics.failure.has_auth_token;
      const ct0Disappeared = forensics.baseline.has_ct0 && !forensics.failure.has_ct0;
      
      if (authTokenDisappeared || ct0Disappeared) {
        return {
          determination: 'EXPIRY/ROTATION',
          explanation: `Critical cookies (auth_token: ${authTokenDisappeared}, ct0: ${ct0Disappeared}) disappeared between baseline and failure.`,
          smallestFix: 'Implement cookie refresh strategy or migrate to storageState/persistent profile with userDataDir.',
        };
      }
    }
  }
  
  // Default: cookie-only insufficient
  return {
    determination: 'COOKIE_ONLY_INSUFFICIENT',
    explanation: `All variants failed. Cookies present but auth not persisting. May need storageState or persistent profile.`,
    smallestFix: 'Migrate from cookie-only injection to Playwright storageState or persistent userDataDir profile.',
  };
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        🔬 AUTH PERSISTENCE ROOT CAUSE ANALYZER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const results = readMatrixResults();
  
  if (results.length === 0) {
    console.log('⚠️  No matrix results found. Run: pnpm run ops:auth:persistence:matrix\n');
    process.exit(1);
  }
  
  console.log(`📊 Found ${results.length} matrix result(s):\n`);
  results.forEach((r, i) => {
    const variant = r.tick_seconds === 60 && !r.jitter ? 'A' : r.tick_seconds === 180 && r.jitter ? 'B' : r.tick_seconds === 300 && r.jitter ? 'C' : '?';
    console.log(`  Variant ${variant}: ${r.tick_seconds}s${r.jitter ? ' + jitter' : ''} - ${r.pass ? '✅ PASS' : `❌ FAIL (min ${r.first_failure_minute}, ${r.reason})`}`);
  });
  
  const determination = determineRootCause(results);
  
  // Generate report
  let report = `# Auth Persistence Root Cause Analysis

**Generated:** ${new Date().toISOString()}

## Matrix Results

| Variant | Tick Seconds | Jitter | Duration | Pass | First Failure Minute | Reason |
|---------|--------------|--------|----------|------|---------------------|--------|
`;
  
  results.forEach((r, i) => {
    const variant = r.tick_seconds === 60 && !r.jitter ? 'A' : r.tick_seconds === 180 && r.jitter ? 'B' : r.tick_seconds === 300 && r.jitter ? 'C' : '?';
    report += `| ${variant} | ${r.tick_seconds} | ${r.jitter ? 'Yes' : 'No'} | ${r.duration} min | ${r.pass ? '✅' : '❌'} | ${r.first_failure_minute ?? 'N/A'} | ${r.reason || 'N/A'} |\n`;
  });
  
  report += `\n## Forensics Comparison\n\n`;
  
  // Add forensics for variant A if available
  const variantA = results.find(r => r.tick_seconds === 60 && !r.jitter);
  if (variantA && fs.existsSync(variantA.report_path)) {
    const forensics = findForensicsSnapshots(variantA.report_path);
    
    if (forensics.baseline && forensics.failure) {
      report += `### Minute 0 (Baseline) vs Minute ${forensics.failure.minute} (Failure)\n\n`;
      report += `**Baseline:**\n`;
      report += `- Cookies (.x.com): ${forensics.baseline.cookie_count_x_com}\n`;
      report += `- Cookies (.twitter.com): ${forensics.baseline.cookie_count_twitter_com}\n`;
      report += `- auth_token: ${forensics.baseline.has_auth_token} (expiry: ${forensics.baseline.auth_token_expiry ? new Date(forensics.baseline.auth_token_expiry * 1000).toISOString() : 'session'})\n`;
      report += `- ct0: ${forensics.baseline.has_ct0} (expiry: ${forensics.baseline.ct0_expiry ? new Date(forensics.baseline.ct0_expiry * 1000).toISOString() : 'session'})\n`;
      report += `- twid: ${forensics.baseline.has_twid}\n`;
      report += `- localStorage: ${forensics.baseline.localStorage_keys_count} keys\n`;
      report += `- sessionStorage: ${forensics.baseline.sessionStorage_keys_count} keys\n`;
      report += `- IndexedDB: ${forensics.baseline.indexeddb_exists ? 'exists' : 'none'} (${forensics.baseline.indexeddb_count} DBs)\n\n`;
      
      report += `**Failure:**\n`;
      report += `- Cookies (.x.com): ${forensics.failure.cookie_count_x_com}\n`;
      report += `- Cookies (.twitter.com): ${forensics.failure.cookie_count_twitter_com}\n`;
      report += `- auth_token: ${forensics.failure.has_auth_token} (expiry: ${forensics.failure.auth_token_expiry ? new Date(forensics.failure.auth_token_expiry * 1000).toISOString() : 'session'})\n`;
      report += `- ct0: ${forensics.failure.has_ct0} (expiry: ${forensics.failure.ct0_expiry ? new Date(forensics.failure.ct0_expiry * 1000).toISOString() : 'session'})\n`;
      report += `- twid: ${forensics.failure.has_twid}\n`;
      report += `- localStorage: ${forensics.failure.localStorage_keys_count} keys\n`;
      report += `- sessionStorage: ${forensics.failure.sessionStorage_keys_count} keys\n`;
      report += `- IndexedDB: ${forensics.failure.indexeddb_exists ? 'exists' : 'none'} (${forensics.failure.indexeddb_count} DBs)\n\n`;
      
      report += `**Changes:**\n`;
      report += `- Cookie count change: ${(forensics.failure.cookie_count_x_com + forensics.failure.cookie_count_twitter_com) - (forensics.baseline.cookie_count_x_com + forensics.baseline.cookie_count_twitter_com)}\n`;
      report += `- auth_token disappeared: ${forensics.baseline.has_auth_token && !forensics.failure.has_auth_token ? 'YES ⚠️' : 'NO'}\n`;
      report += `- ct0 disappeared: ${forensics.baseline.has_ct0 && !forensics.failure.has_ct0 ? 'YES ⚠️' : 'NO'}\n`;
      report += `- twid disappeared: ${forensics.baseline.has_twid && !forensics.failure.has_twid ? 'YES ⚠️' : 'NO'}\n\n`;
    }
  }
  
  report += `## Determination\n\n`;
  report += `**Type:** \`${determination.determination}\`\n\n`;
  report += `**Explanation:**\n${determination.explanation}\n\n`;
  report += `## Smallest Fix\n\n${determination.smallestFix}\n`;
  
  fs.writeFileSync(ROOT_CAUSE_REPORT, report, 'utf-8');
  
  console.log(`\n✅ Root cause analysis written to: ${ROOT_CAUSE_REPORT}\n`);
  console.log(`**Determination:** ${determination.determination}`);
  console.log(`**Explanation:** ${determination.explanation}`);
  console.log(`**Smallest Fix:** ${determination.smallestFix}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

#!/usr/bin/env tsx
/**
 * 🔍 PROVE HOURLY EXECUTION
 * 
 * Runs hourly tick once (dry-run or real) and prints summary:
 * - Targets computed
 * - Attempts made
 * - Replies posted
 * - Skip reasons
 * 
 * Usage:
 *   DRY_RUN=true pnpm exec tsx scripts/ops/prove-hourly-execution.ts
 *   DRY_RUN=false pnpm exec tsx scripts/ops/prove-hourly-execution.ts
 */

import 'dotenv/config';
import { executeHourlyTick } from '../../src/rateController/hourlyTick';
import { getCurrentHourTargets } from '../../src/rateController/rateController';
import { getSupabaseClient } from '../../src/db/index';

const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default true

interface ExecutionSummary {
  targets: {
    mode: string;
    replies: number;
    posts: number;
    allow_search: boolean;
  };
  executed: {
    replies: number;
    posts: number;
  };
  attempts: number;
  skip_reasons: Record<string, number>;
  state_row: any;
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        🔍 PROVE HOURLY EXECUTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`[PROVE] Mode: ${DRY_RUN ? 'DRY_RUN' : 'REAL'}\n`);
  
  const supabase = getSupabaseClient();
  const summary: ExecutionSummary = {
    targets: {
      mode: '',
      replies: 0,
      posts: 0,
      allow_search: false,
    },
    executed: {
      replies: 0,
      posts: 0,
    },
    attempts: 0,
    skip_reasons: {},
    state_row: null,
  };
  
  // Get current targets
  const targets = await getCurrentHourTargets();
  summary.targets = {
    mode: targets.mode,
    replies: targets.target_replies_this_hour,
    posts: targets.target_posts_this_hour,
    allow_search: targets.allow_search,
  };
  
  console.log(`[PROVE] 📊 Current Targets:`);
  console.log(`   Mode: ${summary.targets.mode}`);
  console.log(`   Replies: ${summary.targets.replies}/hour`);
  console.log(`   Posts: ${summary.targets.posts}/hour`);
  console.log(`   Allow Search: ${summary.targets.allow_search}`);
  console.log(`   Risk Score: ${targets.risk_score.toFixed(3)}`);
  console.log(`   Yield Score: ${targets.yield_score.toFixed(3)}\n`);
  
  if (DRY_RUN) {
    console.log(`[PROVE] 🔒 DRY_RUN: Would execute hourly tick (skipping actual execution)`);
    console.log(`[PROVE] 💡 Set DRY_RUN=false to execute real hourly tick\n`);
  } else {
    console.log(`[PROVE] 🚀 Executing hourly tick...\n`);
    
    // Capture logs (we'll parse from console output)
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    
    try {
      await executeHourlyTick();
      
      // Parse execution summary from logs
      const attemptMatches = logs.filter(l => l.includes('Attempt')).length;
      const postedMatches = logs.filter(l => l.includes('posted successfully')).length;
      const skippedMatches = logs.filter(l => l.includes('skipped:'));
      
      summary.attempts = attemptMatches;
      summary.executed.replies = postedMatches;
      
      // Extract skip reasons
      skippedMatches.forEach(log => {
        const match = log.match(/skipped: (.+?)(?:\s|$)/);
        if (match) {
          const reason = match[1];
          summary.skip_reasons[reason] = (summary.skip_reasons[reason] || 0) + 1;
        }
      });
      
    } catch (error: any) {
      console.error(`[PROVE] ❌ Execution failed: ${error.message}`);
      throw error;
    } finally {
      console.log = originalLog;
    }
  }
  
  // Get final state row
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);
  
  const { data: stateRow } = await supabase
    .from('rate_controller_state')
    .select('*')
    .eq('hour_start', hourStart.toISOString())
    .maybeSingle();
  
  summary.state_row = stateRow;
  
  if (stateRow) {
    summary.executed.replies = stateRow.executed_replies || 0;
    summary.executed.posts = stateRow.executed_posts || 0;
  }
  
  console.log(`\n[PROVE] 📊 Execution Summary:`);
  console.log(`   Targets: ${summary.targets.replies} replies, ${summary.targets.posts} posts`);
  console.log(`   Executed: ${summary.executed.replies} replies, ${summary.executed.posts} posts`);
  console.log(`   Attempts: ${summary.attempts}`);
  
  if (Object.keys(summary.skip_reasons).length > 0) {
    console.log(`   Skip Reasons:`);
    Object.entries(summary.skip_reasons).forEach(([reason, count]) => {
      console.log(`     - ${reason}: ${count}`);
    });
  }
  
  if (stateRow) {
    console.log(`\n[PROVE] 📋 State Row:`);
    console.log(`   Hour Start: ${stateRow.hour_start}`);
    console.log(`   Mode: ${stateRow.mode}`);
    console.log(`   Target Replies: ${stateRow.target_replies_this_hour}`);
    console.log(`   Executed Replies: ${stateRow.executed_replies || 0}`);
    console.log(`   Ramp Reason: ${stateRow.ramp_reason || 'N/A'}`);
    console.log(`   Hours Since Start: ${stateRow.hours_since_start || 'N/A'}`);
    console.log(`   Has 24h Stability: ${stateRow.has_24h_stability || false}`);
    console.log(`   Success Rate (6h): ${stateRow.success_rate_6h ? stateRow.success_rate_6h.toFixed(2) : 'N/A'}`);
  }
  
  console.log(`\n[PROVE] ✅ Summary complete`);
  console.log(JSON.stringify(summary, null, 2));
  
  process.exit(0);
}

main().catch((error) => {
  console.error('[PROVE] ❌ Fatal error:', error);
  process.exit(1);
});

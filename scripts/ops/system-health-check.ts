#!/usr/bin/env tsx
/**
 * 🏥 SYSTEM HEALTH CHECK
 *
 * Quick verification that xBOT is operating correctly.
 * Usage: pnpm tsx scripts/ops/system-health-check.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import fs from 'fs';

async function main() {
  const s = getSupabaseClient();
  const now = Date.now();
  const issues: string[] = [];

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                 SYSTEM HEALTH CHECK                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Daemon status
  let daemonOk = false;
  if (fs.existsSync('.runner-profile/executor.pid')) {
    const pidContent = fs.readFileSync('.runner-profile/executor.pid', 'utf-8').trim();
    const pid = pidContent.split(':')[0];
    try {
      const { execSync } = await import('child_process');
      execSync(`ps -p ${pid} > /dev/null 2>&1`);
      daemonOk = true;
      console.log(`  Daemon:              ✅ Running (PID ${pid})`);
    } catch {
      console.log(`  Daemon:              ❌ Dead (stale PID ${pid})`);
      issues.push('Daemon PID file exists but process is dead');
    }
  } else {
    // Check PM2
    try {
      const { execSync } = await import('child_process');
      const pm2 = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf-8' });
      const procs = JSON.parse(pm2);
      const daemon = procs.find((p: any) => p.name === 'xbot-daemon');
      if (daemon && daemon.pm2_env?.status === 'online') {
        daemonOk = true;
        console.log(`  Daemon:              ✅ PM2 online (PID ${daemon.pid})`);
      } else if (daemon) {
        console.log(`  Daemon:              ❌ PM2 ${daemon.pm2_env?.status || 'unknown'}`);
        issues.push('PM2 daemon not online');
      } else {
        console.log(`  Daemon:              ❌ Not found in PM2`);
        issues.push('Daemon not running');
      }
    } catch {
      console.log(`  Daemon:              ❌ Cannot check (no PID file, PM2 unavailable)`);
      issues.push('Cannot verify daemon status');
    }
  }

  // 2. Auth status
  if (fs.existsSync('.runner-profile/AUTH_OK.json')) {
    const auth = JSON.parse(fs.readFileSync('.runner-profile/AUTH_OK.json', 'utf-8'));
    const age = Math.round((now - new Date(auth.timestamp).getTime()) / 3600000);
    const fresh = age < 24;
    console.log(`  Auth:                ${fresh ? '✅' : '⚠️'} @${auth.handle} (${age}h ago${fresh ? '' : ' — may need refresh'})`);
    if (!fresh) issues.push('Auth bootstrap is ' + age + 'h old — consider refreshing');
  } else {
    console.log('  Auth:                ❌ No AUTH_OK.json');
    issues.push('No auth marker — run bootstrap-auth.ts');
  }

  // 3. Crash-loop cooldown
  if (fs.existsSync('.xbot-restarts.json')) {
    const track = JSON.parse(fs.readFileSync('.xbot-restarts.json', 'utf-8'));
    if (track.cooldownUntil && new Date(track.cooldownUntil) > new Date()) {
      const remaining = Math.round((new Date(track.cooldownUntil).getTime() - now) / 60000);
      console.log(`  Cooldown:            ❌ Active (${remaining}min remaining)`);
      issues.push('Crash-loop cooldown active — rm .xbot-restarts.json to clear');
    } else {
      console.log('  Cooldown:            ✅ None');
    }
  } else {
    console.log('  Cooldown:            ✅ None');
  }

  // 4. Controller decision
  const { data: ctrl } = await s.from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'CENTRAL_CONTROLLER_DECISION')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ctrl) {
    const d = ctrl.event_data as any;
    const age = Math.round((now - new Date(ctrl.created_at).getTime()) / 60000);
    console.log(`  Controller:          ${age < 10 ? '✅' : '⚠️'} action=${d?.action} conf=${d?.confidence?.toFixed(2)} (${age}min ago)`);
    if (d?.input?.alloc_today) console.log(`  Allocation:          ${d.input.alloc_today} mix=${d.input.alloc_mix}`);
    if (age > 10) issues.push('Controller decision is ' + age + 'min old — daemon may be stuck');
  } else {
    console.log('  Controller:          ❌ No decisions found');
    issues.push('No controller decisions in DB');
  }

  // 5. Queue composition
  const { count: qThreads } = await s.from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true }).eq('status', 'queued').eq('decision_type', 'thread');
  const { count: qSingles } = await s.from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true }).eq('status', 'queued').eq('decision_type', 'single');
  const { count: qReplies } = await s.from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true }).eq('status', 'queued').eq('decision_type', 'reply');
  console.log(`  Queue:               replies=${qReplies || 0} singles=${qSingles || 0} threads=${qThreads || 0}`);

  // 6. Thread suppression
  const threadSuppressionOk = (ctrl?.event_data as any)?.scores?.thread <= ((ctrl?.event_data as any)?.scores?.reply * 0.2 || 5);
  console.log(`  Thread suppression:  ${threadSuppressionOk ? '✅' : '⚠️'} thread_score=${(ctrl?.event_data as any)?.scores?.thread || 0}`);

  // 7. Reply selection
  const replySelectionOk = (ctrl?.event_data as any)?.action === 'reply' || (ctrl?.event_data as any)?.action === 'wait';
  console.log(`  Reply priority:      ${replySelectionOk ? '✅' : '⚠️'} action=${(ctrl?.event_data as any)?.action || 'unknown'}`);

  // 8. Last post
  const { data: lastPost } = await s.from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'POST_SUCCESS')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastPost) {
    const d = lastPost.event_data as any;
    const age = Math.round((now - new Date(lastPost.created_at).getTime()) / 60000);
    console.log(`  Last post:           ${age < 120 ? '✅' : '⚠️'} ${age}min ago type=${d?.decision_type || '?'} tweet=${(d?.tweet_id || '?').slice(0, 15)}`);
  } else {
    console.log('  Last post:           ⚠️ None found');
  }

  // 9. Last failure
  const { data: lastFail } = await s.from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'REPLY_FAILED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastFail) {
    const d = lastFail.event_data as any;
    const age = Math.round((now - new Date(lastFail.created_at).getTime()) / 60000);
    console.log(`  Last failure:        ${age}min ago reason=${(d?.pipeline_error_reason || d?.error_code || '?').slice(0, 40)}`);
  }

  // 10. Railway posting disabled
  const { data: railwayBlock } = await s.from('system_events')
    .select('created_at')
    .eq('event_type', 'POSTING_QUEUE_BLOCK')
    .ilike('event_data->>reason', 'POSTING_DISABLED%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (railwayBlock) {
    const age = Math.round((now - new Date(railwayBlock.created_at).getTime()) / 60000);
    console.log(`  Railway posting:     ✅ Disabled (last block ${age}min ago)`);
  } else {
    console.log('  Railway posting:     ⚠️ No POSTING_DISABLED blocks seen');
  }

  // Summary
  console.log('\n' + '─'.repeat(60));
  if (issues.length === 0) {
    console.log('  🟢 ALL SYSTEMS HEALTHY');
  } else {
    console.log(`  🟡 ${issues.length} ISSUE${issues.length > 1 ? 'S' : ''} FOUND:`);
    issues.forEach(i => console.log('    ⚠️ ' + i));
  }
  console.log('─'.repeat(60));
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

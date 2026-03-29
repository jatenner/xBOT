#!/usr/bin/env tsx
/**
 * ACTION LOG — Detailed activity feed of what xBOT has done recently.
 *
 * Usage: npx tsx scripts/ops/action-log.ts [hours]
 *   hours — lookback window (default: 6)
 */

import './load-env';
import { getSupabaseClient } from '../../src/db/index';

const HOURS = Math.max(1, Number(process.argv[2]) || 6);
const since = new Date(Date.now() - HOURS * 3600_000).toISOString();
const now = Date.now();

function rel(ts: string): string {
  const ms = now - new Date(ts).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${(ms / 3600_000).toFixed(1)}h ago`;
}

function abs(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function trunc(s: string | null | undefined, n: number): string {
  if (!s) return '—';
  const clean = s.replace(/\n/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n) + '...' : clean;
}

async function main() {
  const s = getSupabaseClient();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║            ACTION LOG — last ${HOURS}h                            ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Window: ${since.replace('T', ' ').slice(0, 19)} → now\n`);

  // ── POSTED CONTENT ──────────────────────────────────────────────────
  const { data: posted } = await s
    .from('content_generation_metadata_comprehensive')
    .select('posted_at, decision_type, content, tweet_id, target_tweet_url, generator_name, hook_type, structure_type')
    .eq('status', 'posted')
    .gte('posted_at', since)
    .order('posted_at', { ascending: false });

  console.log('── POSTED CONTENT ──────────────────────────────────────────');
  if (posted && posted.length > 0) {
    for (const p of posted) {
      const ts = p.posted_at || '';
      const type = (p.decision_type || '?').toUpperCase().padEnd(7);
      console.log(`  ${rel(ts).padEnd(10)} ${abs(ts)}  ${type}  ${trunc(p.content, 120)}`);
      const meta: string[] = [];
      if (p.tweet_id) meta.push(`tweet=${p.tweet_id}`);
      if (p.target_tweet_url) meta.push(`target=${p.target_tweet_url}`);
      if (p.generator_name) meta.push(`gen=${p.generator_name}`);
      if (p.hook_type) meta.push(`hook=${p.hook_type}`);
      if (p.structure_type) meta.push(`struct=${p.structure_type}`);
      if (meta.length) console.log(`             ${meta.join('  ')}`);
    }
  } else {
    console.log('  (none)');
  }
  const postedCount = posted?.length || 0;
  console.log();

  // ── REPLY DECISIONS ─────────────────────────────────────────────────
  const { data: decisions } = await s
    .from('reply_decisions')
    .select('created_at, target_tweet_id, decision, status, deny_reason_code, deny_reason_detail, pipeline_source')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('── REPLY DECISIONS (last 20) ────────────────────────────────');
  if (decisions && decisions.length > 0) {
    for (const d of decisions) {
      const ts = d.created_at || '';
      const status = d.decision === 'ALLOW' ? 'ALLOW ' : d.decision === 'DENY' ? 'DENY  ' : (d.decision || '?').padEnd(6);
      const reason = d.decision === 'DENY' ? ` reason=${d.deny_reason_code || d.deny_reason_detail || '?'}` : '';
      const tweet = d.target_tweet_id ? ` tweet=${d.target_tweet_id}` : '';
      const src = d.pipeline_source ? ` via=${d.pipeline_source}` : '';
      console.log(`  ${rel(ts).padEnd(10)} ${abs(ts)}  ${status}${tweet}${reason}${src}`);
    }
  } else {
    console.log('  (none)');
  }
  const approvedCount = decisions?.filter(d => d.decision === 'ALLOW').length || 0;
  console.log();

  // ── FAILED ACTIONS ──────────────────────────────────────────────────
  const { data: failed } = await s
    .from('content_generation_metadata_comprehensive')
    .select('updated_at, decision_type, status, error_message')
    .or('status.eq.failed,status.eq.error')
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(15);

  console.log('── FAILED ACTIONS ──────────────────────────────────────────');
  if (failed && failed.length > 0) {
    for (const f of failed) {
      const ts = f.updated_at || '';
      const type = (f.decision_type || '?').toUpperCase().padEnd(7);
      const err = trunc(f.error_message, 80);
      console.log(`  ${rel(ts).padEnd(10)} ${abs(ts)}  ${type}  ${f.status}  ${err}`);
    }
  } else {
    console.log('  (none)');
  }
  const failedCount = failed?.length || 0;
  console.log();

  // ── METRICS RECEIVED ────────────────────────────────────────────────
  const { data: metrics } = await s
    .from('outcomes')
    .select('tweet_id, views, likes, retweets, engagement_rate, collected_at')
    .gte('collected_at', since)
    .not('views', 'is', null)
    .order('collected_at', { ascending: false })
    .limit(15);

  console.log('── METRICS RECEIVED ────────────────────────────────────────');
  if (metrics && metrics.length > 0) {
    for (const m of metrics) {
      const ts = m.collected_at || '';
      const tid = m.tweet_id ? `...${m.tweet_id.slice(-6)}` : '?';
      const er = m.engagement_rate != null ? `${(Number(m.engagement_rate) * 100).toFixed(2)}%` : '—';
      console.log(`  ${rel(ts).padEnd(10)} ${abs(ts)}  ${tid}  views=${m.views ?? '—'}  likes=${m.likes ?? '—'}  rt=${m.retweets ?? '—'}  ER=${er}`);
    }
  } else {
    console.log('  (none)');
  }
  const metricsCount = metrics?.length || 0;
  console.log();

  // ── SUMMARY ─────────────────────────────────────────────────────────
  console.log('─'.repeat(60));
  console.log(`  TOTAL: ${postedCount} posted, ${failedCount} failed, ${approvedCount} replies approved, ${metricsCount} metrics collected`);
  console.log('─'.repeat(60));
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

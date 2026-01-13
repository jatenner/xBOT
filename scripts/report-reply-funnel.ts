#!/usr/bin/env tsx
/**
 * 📊 REPLY FUNNEL REPORT
 * 
 * Reports on reply pipeline funnel metrics:
 * - Total candidates
 * - ALLOW count and rate
 * - DENY breakdown by deny_reason_code
 * - Stage progression counts
 * - Posting success rate
 * - Learnable count (posted and eligible for engagement tracking)
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  const supabase = getSupabaseClient();
  
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  
  console.log('═'.repeat(80));
  console.log('📊 REPLY FUNNEL REPORT');
  console.log('═'.repeat(80));
  console.log(`Generated at: ${now.toISOString()}\n`);
  
  // Query last 24h
  const { data: decisions24h, error: error24h } = await supabase
    .from('reply_decisions')
    .select('*')
    .gte('created_at', last24h)
    .order('created_at', { ascending: false });
  
  if (error24h) {
    console.error(`❌ Error querying 24h data: ${error24h.message}`);
    process.exit(1);
  }
  
  // Query last 1h
  const { data: decisions1h, error: error1h } = await supabase
    .from('reply_decisions')
    .select('*')
    .gte('created_at', last1h)
    .order('created_at', { ascending: false });
  
  if (error1h) {
    console.error(`❌ Error querying 1h data: ${error1h.message}`);
    process.exit(1);
  }
  
  // Process 24h data
  const total24h = decisions24h?.length || 0;
  const allow24h = decisions24h?.filter(d => d.decision === 'ALLOW').length || 0;
  const deny24h = decisions24h?.filter(d => d.decision === 'DENY').length || 0;
  const allowRate24h = total24h > 0 ? ((allow24h / total24h) * 100).toFixed(2) : '0.00';
  
  // DENY breakdown by reason code (24h)
  const denyBreakdown24h: Record<string, number> = {};
  (decisions24h || []).forEach(d => {
    if (d.decision === 'DENY') {
      const code = d.deny_reason_code || 'OTHER';
      denyBreakdown24h[code] = (denyBreakdown24h[code] || 0) + 1;
    }
  });
  
  // Stage progression (24h)
  const scored24h = (decisions24h || []).filter(d => d.scored_at).length;
  const templateSelected24h = (decisions24h || []).filter(d => d.template_selected_at).length;
  const generationCompleted24h = (decisions24h || []).filter(d => d.generation_completed_at).length;
  const postingCompleted24h = (decisions24h || []).filter(d => d.posting_completed_at).length;
  
  // Posting success (24h)
  const posted24h = (decisions24h || []).filter(d => d.posted_reply_tweet_id).length;
  const postingSuccessRate24h = allow24h > 0 ? ((posted24h / allow24h) * 100).toFixed(2) : '0.00';
  
  // Learnable count (24h) - posted and eligible for engagement tracking
  const learnable24h = (decisions24h || []).filter(d => 
    d.posted_reply_tweet_id && 
    d.decision === 'ALLOW' &&
    new Date(d.created_at).getTime() < now.getTime() - 24 * 60 * 60 * 1000 // Posted 24h+ ago
  ).length;
  
  // Process 1h data
  const total1h = decisions1h?.length || 0;
  const allow1h = decisions1h?.filter(d => d.decision === 'ALLOW').length || 0;
  const deny1h = decisions1h?.filter(d => d.decision === 'DENY').length || 0;
  const allowRate1h = total1h > 0 ? ((allow1h / total1h) * 100).toFixed(2) : '0.00';
  
  // DENY breakdown by reason code (1h)
  const denyBreakdown1h: Record<string, number> = {};
  (decisions1h || []).forEach(d => {
    if (d.decision === 'DENY') {
      const code = d.deny_reason_code || 'OTHER';
      denyBreakdown1h[code] = (denyBreakdown1h[code] || 0) + 1;
    }
  });
  
  // Stage progression (1h)
  const scored1h = (decisions1h || []).filter(d => d.scored_at).length;
  const templateSelected1h = (decisions1h || []).filter(d => d.template_selected_at).length;
  const generationCompleted1h = (decisions1h || []).filter(d => d.generation_completed_at).length;
  const postingCompleted1h = (decisions1h || []).filter(d => d.posting_completed_at).length;
  
  // Posting success (1h)
  const posted1h = (decisions1h || []).filter(d => d.posted_reply_tweet_id).length;
  const postingSuccessRate1h = allow1h > 0 ? ((posted1h / allow1h) * 100).toFixed(2) : '0.00';
  
  // Learnable count (1h) - posted and eligible for engagement tracking
  const learnable1h = (decisions1h || []).filter(d => 
    d.posted_reply_tweet_id && 
    d.decision === 'ALLOW' &&
    new Date(d.created_at).getTime() < now.getTime() - 24 * 60 * 60 * 1000 // Posted 24h+ ago
  ).length;
  
  // Print report
  console.log('═'.repeat(80));
  console.log('📈 LAST 24 HOURS');
  console.log('═'.repeat(80));
  console.log(`Total candidates:     ${total24h.toString().padStart(6)}`);
  console.log(`ALLOW:                 ${allow24h.toString().padStart(6)} (${allowRate24h}%)`);
  console.log(`DENY:                  ${deny24h.toString().padStart(6)}`);
  console.log('');
  console.log('DENY Breakdown:');
  const sortedDeny24h = Object.entries(denyBreakdown24h).sort((a, b) => b[1] - a[1]);
  for (const [code, count] of sortedDeny24h) {
    const pct = total24h > 0 ? ((count / total24h) * 100).toFixed(2) : '0.00';
    console.log(`  ${code.padEnd(35)} ${count.toString().padStart(6)} (${pct}%)`);
  }
  console.log('');
  console.log('Stage Progression:');
  console.log(`  scored_at:           ${scored24h.toString().padStart(6)}`);
  console.log(`  template_selected_at: ${templateSelected24h.toString().padStart(6)}`);
  console.log(`  generation_completed_at: ${generationCompleted24h.toString().padStart(6)}`);
  console.log(`  posting_completed_at: ${postingCompleted24h.toString().padStart(6)}`);
  console.log('');
  console.log('Posting Metrics:');
  console.log(`  Posted:              ${posted24h.toString().padStart(6)}`);
  console.log(`  Posting success rate: ${postingSuccessRate24h}%`);
  console.log(`  Learnable count:     ${learnable24h.toString().padStart(6)} (posted 24h+ ago)`);
  console.log('');
  
  console.log('═'.repeat(80));
  console.log('📈 LAST 1 HOUR');
  console.log('═'.repeat(80));
  console.log(`Total candidates:     ${total1h.toString().padStart(6)}`);
  console.log(`ALLOW:                 ${allow1h.toString().padStart(6)} (${allowRate1h}%)`);
  console.log(`DENY:                  ${deny1h.toString().padStart(6)}`);
  console.log('');
  console.log('DENY Breakdown:');
  const sortedDeny1h = Object.entries(denyBreakdown1h).sort((a, b) => b[1] - a[1]);
  for (const [code, count] of sortedDeny1h) {
    const pct = total1h > 0 ? ((count / total1h) * 100).toFixed(2) : '0.00';
    console.log(`  ${code.padEnd(35)} ${count.toString().padStart(6)} (${pct}%)`);
  }
  console.log('');
  console.log('Stage Progression:');
  console.log(`  scored_at:           ${scored1h.toString().padStart(6)}`);
  console.log(`  template_selected_at: ${templateSelected1h.toString().padStart(6)}`);
  console.log(`  generation_completed_at: ${generationCompleted1h.toString().padStart(6)}`);
  console.log(`  posting_completed_at: ${postingCompleted1h.toString().padStart(6)}`);
  console.log('');
  console.log('Posting Metrics:');
  console.log(`  Posted:              ${posted1h.toString().padStart(6)}`);
  console.log(`  Posting success rate: ${postingSuccessRate1h}%`);
  console.log(`  Learnable count:     ${learnable1h.toString().padStart(6)} (posted 24h+ ago)`);
  console.log('');
  
  console.log('═'.repeat(80));
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

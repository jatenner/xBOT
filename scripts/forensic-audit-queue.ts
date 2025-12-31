#!/usr/bin/env tsx
/**
 * 🔍 FORENSIC AUDIT - Queue Health
 */

import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 FORENSIC AUDIT - QUEUE HEALTH (Last 24h)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Count by status for posts
  console.log('1. POSTS (single/thread) BY STATUS (last 24h):');
  const statuses = ['queued', 'scheduled', 'posted', 'failed', 'posting'];
  for (const status of statuses) {
    const { count } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .eq('status', status)
      .gte('created_at', twentyFourHoursAgo);
    console.log(`   ${status}: ${count || 0}`);
  }

  // 2. Count by status for replies
  console.log('\n2. REPLIES BY STATUS (last 24h):');
  for (const status of statuses) {
    const { count } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', status)
      .gte('created_at', twentyFourHoursAgo);
    console.log(`   ${status}: ${count || 0}`);
  }

  // 3. Most recent queued decisions
  console.log('\n3. MOST RECENT QUEUED DECISIONS (10):');
  const { data: queued } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, scheduled_at, created_at, content')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(10);

  if (queued && queued.length > 0) {
    const now = new Date();
    queued.forEach((d, i) => {
      const scheduledAt = new Date(d.scheduled_at);
      const isFuture = scheduledAt > now;
      const hoursFromNow = ((scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60)).toFixed(1);
      console.log(`   ${i + 1}. [${d.decision_type}] ${d.decision_id}`);
      console.log(`      Created: ${d.created_at}`);
      console.log(`      Scheduled: ${d.scheduled_at} ${isFuture ? `(+${hoursFromNow}h from now)` : `(${Math.abs(Number(hoursFromNow))}h ago)`}`);
      console.log(`      Content: "${d.content?.substring(0, 50)}..."`);
    });
  } else {
    console.log('   ❌ NO QUEUED DECISIONS');
  }

  // 4. Check for timezone issues
  console.log('\n4. TIMEZONE CHECK:');
  console.log(`   Current time (UTC): ${new Date().toISOString()}`);
  console.log(`   Current time (local): ${new Date().toString()}`);
  
  const { data: futureScheduled } = await supabase
    .from('content_metadata')
    .select('decision_id, scheduled_at')
    .eq('status', 'queued')
    .gt('scheduled_at', new Date().toISOString());
  
  console.log(`   Decisions scheduled in future: ${futureScheduled?.length || 0}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);


#!/usr/bin/env tsx
/**
 * Diagnose why reply_candidate_queue is empty
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getSupabaseClient } from '../src/db';

async function main() {
  console.log('=== Queue Empty Diagnosis ===\n');
  
  const supabase = getSupabaseClient();
  
  // 1. Count by status (last 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: statusCounts } = await supabase
    .from('reply_candidate_queue')
    .select('status, created_at')
    .gte('created_at', oneDayAgo);
  
  const statusMap = new Map<string, number>();
  statusCounts?.forEach(row => {
    statusMap.set(row.status || 'null', (statusMap.get(row.status || 'null') || 0) + 1);
  });
  
  console.log('📊 Queue Status Breakdown (last 24h):');
  for (const [status, count] of Array.from(statusMap.entries()).sort()) {
    console.log(`   ${status}: ${count}`);
  }
  console.log(`   TOTAL: ${statusCounts?.length || 0}\n`);
  
  // 2. Count inserted last 1h
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: insertedLastHour } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);
  
  console.log(`📥 Inserted last 1h: ${insertedLastHour || 0}\n`);
  
  // 3. Exact query used by getNextCandidateFromQueue()
  const now = new Date().toISOString();
  const { data: availableCandidates, error: queryError } = await supabase
    .from('reply_candidate_queue')
    .select('candidate_tweet_id, evaluation_id, predicted_tier, overall_score')
    .eq('status', 'queued')
    .gt('expires_at', now)
    .order('predicted_tier', { ascending: true })
    .order('overall_score', { ascending: false })
    .limit(10);
  
  console.log(`🔍 Query Results (status='queued' AND expires_at > now):`);
  console.log(`   Found: ${availableCandidates?.length || 0} candidates`);
  if (queryError) {
    console.log(`   Error: ${queryError.message}`);
  }
  if (availableCandidates && availableCandidates.length > 0) {
    console.log(`   Sample candidates:`);
    availableCandidates.slice(0, 5).forEach((c, i) => {
      console.log(`     ${i + 1}. tweet_id=${c.candidate_tweet_id} tier=${c.predicted_tier} score=${c.overall_score}`);
    });
  }
  console.log();
  
  // 4. Check candidate_evaluations (source table)
  const { count: evaluationsLastHour } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo)
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3);
  
  console.log(`📋 Candidate Evaluations (last 1h, passed_filters=true, tier<=3):`);
  console.log(`   Count: ${evaluationsLastHour || 0}\n`);
  
  // 5. Check expired entries
  const { count: expiredCount } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .lt('expires_at', now)
    .eq('status', 'queued');
  
  console.log(`⏰ Expired but still 'queued' status: ${expiredCount || 0}\n`);
  
  // 6. Check if refreshCandidateQueue has run recently
  const { data: recentRefresh } = await supabase
    .from('system_events')
    .select('created_at, message')
    .ilike('message', '%queue%refresh%')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(`🔄 Recent queue refresh events:`);
  if (recentRefresh && recentRefresh.length > 0) {
    recentRefresh.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.created_at}: ${e.message?.substring(0, 80)}`);
    });
  } else {
    console.log(`   None found`);
  }
  console.log();
}

main().catch(console.error);

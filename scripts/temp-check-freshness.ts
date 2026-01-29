#!/usr/bin/env tsx
import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  console.log(`Current time: ${now.toISOString()}`);
  console.log(`2h ago: ${twoHoursAgo.toISOString()}`);
  console.log(`6h ago: ${sixHoursAgo.toISOString()}`);
  console.log(`24h ago: ${twentyFourHoursAgo.toISOString()}\n`);
  
  // Check what the refreshCandidateQueue query would return
  const { data: candidates2h, count: count2h } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact' })
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3)
    .in('status', ['evaluated', 'queued'])
    .gte('created_at', twoHoursAgo.toISOString())
    .order('overall_score', { ascending: false })
    .limit(50);
  
  console.log(`=== 2h window (refreshCandidateQueue default) ===`);
  console.log(`Count: ${count2h || 0}`);
  if (candidates2h && candidates2h.length > 0) {
    console.log(`First 5:`);
    candidates2h.slice(0, 5).forEach(c => {
      console.log(`  ${c.candidate_tweet_id?.substring(0, 8)}... | tier=${c.predicted_tier} status=${c.status} created=${c.created_at}`);
    });
  }
  
  const { data: candidates6h, count: count6h } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact' })
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3)
    .in('status', ['evaluated', 'queued'])
    .gte('created_at', sixHoursAgo.toISOString())
    .order('overall_score', { ascending: false })
    .limit(50);
  
  console.log(`\n=== 6h window ===`);
  console.log(`Count: ${count6h || 0}`);
  if (candidates6h && candidates6h.length > 0) {
    console.log(`First 5:`);
    candidates6h.slice(0, 5).forEach(c => {
      console.log(`  ${c.candidate_tweet_id?.substring(0, 8)}... | tier=${c.predicted_tier} status=${c.status} created=${c.created_at}`);
    });
  }
  
  const { data: candidates24h, count: count24h } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact' })
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3)
    .in('status', ['evaluated', 'queued'])
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .order('overall_score', { ascending: false })
    .limit(50);
  
  console.log(`\n=== 24h window ===`);
  console.log(`Count: ${count24h || 0}`);
  if (candidates24h && candidates24h.length > 0) {
    console.log(`First 5:`);
    candidates24h.slice(0, 5).forEach(c => {
      console.log(`  ${c.candidate_tweet_id?.substring(0, 8)}... | tier=${c.predicted_tier} status=${c.status} created=${c.created_at}`);
    });
  }
  
  // Check reply_candidate_queue
  console.log(`\n=== reply_candidate_queue (non-expired) ===`);
  const { data: queue, count: queueCount } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact' })
    .eq('status', 'queued')
    .gt('expires_at', now.toISOString());
  
  console.log(`Count: ${queueCount || 0}`);
  if (queue && queue.length > 0) {
    queue.slice(0, 5).forEach(q => {
      console.log(`  ${q.candidate_tweet_id?.substring(0, 8)}... | tier=${q.predicted_tier} expires=${q.expires_at}`);
    });
  }
}

main().catch(console.error);

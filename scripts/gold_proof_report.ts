#!/usr/bin/env tsx
import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function goldProofReport() {
  const supabase = getSupabaseClient();
  const decisionId = '7d3da8a6-9039-40af-94d7-19a145da0877';
  const unblockTimestamp = '2026-01-10T18:19:00.000Z';
  
  console.log('=== GOLD PROOF REPORT ===\n');
  
  const { data: permit } = await supabase
    .from('post_attempts')
    .select('permit_id, decision_id, status, actual_tweet_id, posted_tweet_id, used_at')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  console.log('A) POST_ATTEMPTS:');
  console.log('  Permit ID:', permit?.permit_id || 'NOT FOUND');
  console.log('  Status:', permit?.status || 'NOT FOUND');
  console.log('  Actual tweet ID:', permit?.actual_tweet_id || permit?.posted_tweet_id || 'NULL');
  console.log('  Used at:', permit?.used_at || 'NULL');
  
  const { data: postEvent } = await supabase
    .from('system_events')
    .select('event_type, event_data, created_at')
    .eq('event_type', 'posting_attempt_success')
    .eq('event_data->>decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  console.log('\nB) POSTING_ATTEMPT_SUCCESS:');
  console.log('  Event:', postEvent ? '✅ FOUND' : '❌ NOT FOUND');
  if (postEvent) {
    console.log('  Tweet ID:', postEvent.event_data?.tweet_id);
  }
  
  const { count: ghostCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .is('permit_id', null)
    .gte('posted_at', unblockTimestamp);
  
  console.log('\nC) GHOST CHECK:');
  console.log('  Ghosts:', ghostCount || 0);
  
  const { data: decision } = await supabase
    .from('content_metadata')
    .select('decision_id, status, tweet_id, permit_id, posted_at')
    .eq('decision_id', decisionId)
    .maybeSingle();
  
  console.log('\nD) TRACE CHAIN:');
  console.log('  Decision ID:', decision?.decision_id);
  console.log('  Status:', decision?.status);
  console.log('  Tweet ID:', decision?.tweet_id || 'NULL');
  console.log('  Permit ID:', decision?.permit_id || 'NULL');
  
  const permitUsed = permit?.status === 'USED';
  const hasTweetId = !!(permit?.actual_tweet_id || permit?.posted_tweet_id);
  const hasPostEvent = !!postEvent;
  const noGhosts = (ghostCount || 0) === 0;
  const traceComplete = !!(decision?.tweet_id && decision?.permit_id);
  
  console.log('\n=== GOLD PROOF SUMMARY ===');
  console.log('| Check | Status | Value |');
  console.log('|-------|--------|-------|');
  console.log(`| Permit USED | ${permitUsed ? '✅ PASS' : '❌ FAIL'} | ${permit?.status || 'NOT FOUND'} |`);
  console.log(`| Posted tweet ID | ${hasTweetId ? '✅ PASS' : '❌ FAIL'} | ${permit?.actual_tweet_id || permit?.posted_tweet_id || 'NULL'} |`);
  console.log(`| Post success event | ${hasPostEvent ? '✅ PASS' : '❌ FAIL'} | ${hasPostEvent ? 'FOUND' : 'NOT FOUND'} |`);
  console.log(`| Ghosts | ${noGhosts ? '✅ PASS' : '❌ FAIL'} | ${ghostCount || 0} |`);
  console.log(`| Trace chain | ${traceComplete ? '✅ PASS' : '❌ FAIL'} | Decision→Permit→Tweet |`);
  
  const allPass = permitUsed && hasTweetId && hasPostEvent && noGhosts && traceComplete;
  console.log(`\nOVERALL: ${allPass ? '✅ GOLD PROOF PASS' : '❌ GOLD PROOF FAIL'}`);
  
  process.exit(0);
}

goldProofReport();


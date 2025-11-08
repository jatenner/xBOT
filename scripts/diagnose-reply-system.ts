#!/usr/bin/env tsx

/**
 * Complete Reply System Diagnostic
 * Checks all components of the reply pipeline
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENABLE_REPLIES = process.env.ENABLE_REPLIES;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function diagnoseReplySystem() {
  console.log('🔍 REPLY SYSTEM DIAGNOSTIC\n');
  console.log('═'.repeat(60));
  
  // ============================================================
  // 1. CHECK ENVIRONMENT VARIABLES
  // ============================================================
  console.log('\n📋 STEP 1: Environment Variables');
  console.log('─'.repeat(60));
  
  const hasTwitterSession = !!process.env.TWITTER_SESSION_B64;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  
  console.log(`✓ ENABLE_REPLIES: ${ENABLE_REPLIES}`);
  console.log(`✓ TWITTER_SESSION_B64: ${hasTwitterSession ? '✅ Set' : '❌ Missing'}`);
  console.log(`✓ OPENAI_API_KEY: ${hasOpenAI ? '✅ Set' : '❌ Missing'}`);
  console.log(`✓ SUPABASE_URL: ${SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  
  if (ENABLE_REPLIES !== 'true') {
    console.log('\n⚠️  WARNING: ENABLE_REPLIES is not set to "true"');
    console.log('   Reply system will not run!');
  }
  
  if (!hasTwitterSession) {
    console.log('\n❌ CRITICAL: TWITTER_SESSION_B64 is missing!');
    console.log('   Harvester cannot authenticate to Twitter');
    return;
  }
  
  // ============================================================
  // 2. CHECK REPLY OPPORTUNITIES (Harvester output)
  // ============================================================
  console.log('\n\n🎯 STEP 2: Reply Opportunities');
  console.log('─'.repeat(60));
  
  const { data: totalOpps, error: oppsError } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true });
  
  if (oppsError) {
    console.log('❌ Error querying reply_opportunities:', oppsError.message);
    return;
  }
  
  const { data: recentOpps } = await supabase
    .from('reply_opportunities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  const { data: last24hOpps } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  console.log(`Total opportunities found: ${totalOpps || 0}`);
  console.log(`Opportunities last 24h: ${last24hOpps || 0}`);
  
  if (recentOpps && recentOpps.length > 0) {
    console.log('\n📝 Most recent opportunities:');
    recentOpps.forEach((opp: any, i: number) => {
      const age = Math.round((Date.now() - new Date(opp.created_at).getTime()) / 60000);
      console.log(`  ${i + 1}. ${opp.original_tweet_text?.substring(0, 60)}...`);
      console.log(`     Likes: ${opp.like_count} | Score: ${opp.health_relevance_score} | ${age}min ago`);
    });
  } else {
    console.log('\n⚠️  No reply opportunities found in database');
    console.log('   Possible causes:');
    console.log('   - Harvester has not run yet');
    console.log('   - Harvester failed to authenticate');
    console.log('   - No viral health tweets found');
  }
  
  // ============================================================
  // 3. CHECK REPLY GENERATION (Generated replies)
  // ============================================================
  console.log('\n\n💬 STEP 3: Reply Generation');
  console.log('─'.repeat(60));
  
  const { data: totalReplies } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply');
  
  const { data: queuedReplies } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'queued');
  
  const { data: postedReplies } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted');
  
  const { data: recentGenerated } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('decision_type', 'reply')
    .order('created_at', { ascending: false })
    .limit(3);
  
  console.log(`Total replies generated: ${totalReplies || 0}`);
  console.log(`Queued for posting: ${queuedReplies || 0}`);
  console.log(`Posted to Twitter: ${postedReplies || 0}`);
  
  if (recentGenerated && recentGenerated.length > 0) {
    console.log('\n📝 Most recent generated replies:');
    recentGenerated.forEach((reply: any, i: number) => {
      const age = Math.round((Date.now() - new Date(reply.created_at).getTime()) / 60000);
      console.log(`  ${i + 1}. Status: ${reply.status} | ${age}min ago`);
      console.log(`     ${reply.content_text?.substring(0, 70)}...`);
    });
  } else {
    console.log('\n⚠️  No replies generated yet');
    console.log('   Reply generation job may not have run');
  }
  
  // ============================================================
  // 4. CHECK POSTING STATUS
  // ============================================================
  console.log('\n\n🚀 STEP 4: Reply Posting');
  console.log('─'.repeat(60));
  
  const { data: last24hPosted } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const { data: lastHourPosted } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  
  const { data: recentPosted } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(3);
  
  console.log(`Posted last 24h: ${last24hPosted || 0}`);
  console.log(`Posted last hour: ${lastHourPosted || 0}`);
  
  if (recentPosted && recentPosted.length > 0) {
    console.log('\n📝 Most recently posted replies:');
    recentPosted.forEach((reply: any, i: number) => {
      const age = Math.round((Date.now() - new Date(reply.posted_at).getTime()) / 60000);
      console.log(`  ${i + 1}. ${age}min ago`);
      console.log(`     ${reply.content_text?.substring(0, 70)}...`);
    });
  } else {
    console.log('\n⚠️  No replies posted yet');
  }
  
  // ============================================================
  // 5. SYSTEM HEALTH ASSESSMENT
  // ============================================================
  console.log('\n\n🏥 STEP 5: System Health Assessment');
  console.log('─'.repeat(60));
  
  const issues: string[] = [];
  const warnings: string[] = [];
  
  if (ENABLE_REPLIES !== 'true') {
    issues.push('ENABLE_REPLIES is not set to "true"');
  }
  
  if (!hasTwitterSession) {
    issues.push('TWITTER_SESSION_B64 is missing - authentication will fail');
  }
  
  if (!totalOpps || totalOpps === 0) {
    issues.push('No reply opportunities found - harvester may not be working');
  }
  
  if (!last24hOpps || last24hOpps === 0) {
    warnings.push('No opportunities harvested in last 24h - harvester may need to run');
  }
  
  if (!totalReplies || totalReplies === 0) {
    issues.push('No replies generated - reply generation may not be working');
  }
  
  if (queuedReplies && queuedReplies > 0 && (!postedReplies || postedReplies === 0)) {
    warnings.push(`${queuedReplies} replies queued but none posted - posting system may be stuck`);
  }
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log('✅ System appears healthy!');
    if (totalOpps && totalReplies && postedReplies) {
      console.log(`\n📊 Pipeline metrics:`);
      console.log(`   Opportunities → Replies → Posted`);
      console.log(`   ${totalOpps} → ${totalReplies} → ${postedReplies}`);
      const conversionRate = ((totalReplies / totalOpps) * 100).toFixed(1);
      const postingRate = ((postedReplies / totalReplies) * 100).toFixed(1);
      console.log(`   Conversion: ${conversionRate}% | Posting: ${postingRate}%`);
    }
  } else {
    if (issues.length > 0) {
      console.log('❌ CRITICAL ISSUES:');
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
    }
  }
  
  // ============================================================
  // 6. RECOMMENDATIONS
  // ============================================================
  console.log('\n\n💡 STEP 6: Recommendations');
  console.log('─'.repeat(60));
  
  if (!hasTwitterSession) {
    console.log('1. Set TWITTER_SESSION_B64 environment variable in Railway');
    console.log('   Value: (base64 encoded session from bulletproof_session_b64.txt)');
  }
  
  if (ENABLE_REPLIES !== 'true') {
    console.log('2. Set ENABLE_REPLIES=true in Railway');
  }
  
  if ((!totalOpps || totalOpps === 0) && hasTwitterSession && ENABLE_REPLIES === 'true') {
    console.log('3. Manually test the harvester:');
    console.log('   railway run tsx scripts/test-harvester-manual.ts');
  }
  
  if (totalOpps && totalOpps > 0 && (!totalReplies || totalReplies === 0)) {
    console.log('4. Reply generation may be failing - check logs:');
    console.log('   railway logs --filter "REPLY_GEN"');
  }
  
  if (queuedReplies && queuedReplies > 0 && (!lastHourPosted || lastHourPosted === 0)) {
    console.log('5. Posting queue is stuck - check posting logs:');
    console.log('   railway logs --filter "POSTING"');
  }
  
  console.log('\n═'.repeat(60));
  console.log('✅ Diagnostic complete!\n');
}

diagnoseReplySystem().catch(console.error);


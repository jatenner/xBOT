#!/usr/bin/env tsx
/**
 * LIVE SYSTEM HEALTH CHECK
 * Hits internal endpoints to get real-time system status
 * NO RELIANCE on Railway CLI logs (which stall/fail)
 */

import dotenv from 'dotenv';
dotenv.config();

const RAILWAY_URL = 'https://xbot-production-844b.up.railway.app';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  data?: any;
  error?: string;
  duration_ms?: number;
}

async function fetchEndpoint(path: string): Promise<{ data: any; duration: number }> {
  const start = Date.now();
  const response = await fetch(`${RAILWAY_URL}${path}`);
  const duration = Date.now() - start;
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  return { data, duration };
}

async function runCheck(name: string, path: string): Promise<CheckResult> {
  try {
    const { data, duration } = await fetchEndpoint(path);
    return {
      name,
      status: 'pass',
      data,
      duration_ms: duration
    };
  } catch (error: any) {
    return {
      name,
      status: 'fail',
      error: error.message
    };
  }
}

async function main() {
  console.log('🔍 LIVE SYSTEM HEALTH CHECK');
  console.log('=' .repeat(80));
  console.log(`Target: ${RAILWAY_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const checks: CheckResult[] = [];

  // Check 1: Basic status
  console.log('1️⃣  Checking /status...');
  const statusCheck = await runCheck('Status Endpoint', '/status');
  checks.push(statusCheck);
  
  if (statusCheck.status === 'pass') {
    const data = statusCheck.data;
    console.log(`   ✅ System OK (${statusCheck.duration_ms}ms)`);
    console.log(`   Mode: ${data.mode}`);
    console.log(`   Posting: ${data.postingEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Jobs: plan=${data.timers.plan}, reply=${data.timers.reply}, posting=${data.timers.posting}`);
    console.log(`   Uptime: ${Math.floor(data.uptime_seconds / 60)}min`);
    
    if (data.jobStats) {
      console.log(`   Recent runs: plan=${data.jobStats.planRuns}, reply=${data.jobStats.replyRuns}, posting=${data.jobStats.postingRuns}`);
    }
  } else {
    console.log(`   ❌ FAILED: ${statusCheck.error}`);
  }

  // Check 2: System health
  console.log('\n2️⃣  Checking /api/system/health...');
  const healthCheck = await runCheck('System Health', '/api/system/health');
  checks.push(healthCheck);
  
  if (healthCheck.status === 'pass') {
    const data = healthCheck.data;
    console.log(`   ✅ Health OK (${healthCheck.duration_ms}ms)`);
    if (data.browserPool) {
      console.log(`   Browser: ${data.browserPool.available || 0} available, ${data.browserPool.active || 0} active`);
    }
    if (data.system) {
      console.log(`   Memory: ${data.system.memory.used}MB / ${data.system.memory.total}MB`);
    }
  } else {
    console.log(`   ❌ FAILED: ${healthCheck.error}`);
  }

  // Check 3: Queue status
  console.log('\n3️⃣  Checking queue depth...');
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { count: queuedCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');
    
    const { count: postedToday } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    console.log(`   ✅ Queue: ${queuedCount || 0} items queued`);
    console.log(`   ✅ Posted today: ${postedToday || 0} items`);
    
    checks.push({
      name: 'Queue Status',
      status: queuedCount && queuedCount > 0 ? 'pass' : 'warn',
      data: { queued: queuedCount, posted_today: postedToday }
    });
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    checks.push({
      name: 'Queue Status',
      status: 'fail',
      error: error.message
    });
  }

  // Check 4: Recent posts
  console.log('\n4️⃣  Checking recent posts...');
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: recentPosts } = await supabase
      .from('content_metadata')
      .select('tweet_id, posted_at, status')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(5);
    
    if (recentPosts && recentPosts.length > 0) {
      console.log(`   ✅ Found ${recentPosts.length} recent posts:`);
      recentPosts.forEach((post: any, i: number) => {
        const minAgo = Math.floor((Date.now() - new Date(post.posted_at).getTime()) / 60000);
        console.log(`      ${i + 1}. ${post.tweet_id} (${minAgo}min ago)`);
      });
      
      checks.push({
        name: 'Recent Posts',
        status: 'pass',
        data: { count: recentPosts.length }
      });
    } else {
      console.log(`   ⚠️  No recent posts found`);
      checks.push({
        name: 'Recent Posts',
        status: 'warn',
        data: { count: 0 }
      });
    }
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    checks.push({
      name: 'Recent Posts',
      status: 'fail',
      error: error.message
    });
  }

  // Check 5: Receipt integrity
  console.log('\n5️⃣  Checking receipt integrity...');
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Posts in last hour
    const { count: postsLastHour } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    // Receipts in last hour
    const { count: receiptsLastHour } = await supabase
      .from('post_receipts')
      .select('*', { count: 'exact', head: true })
      .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    console.log(`   Posts (last hour): ${postsLastHour || 0}`);
    console.log(`   Receipts (last hour): ${receiptsLastHour || 0}`);
    
    if ((postsLastHour || 0) > (receiptsLastHour || 0)) {
      console.log(`   ⚠️  INTEGRITY GAP: ${(postsLastHour || 0) - (receiptsLastHour || 0)} posts missing receipts`);
      checks.push({
        name: 'Receipt Integrity',
        status: 'warn',
        data: { posts: postsLastHour, receipts: receiptsLastHour, gap: (postsLastHour || 0) - (receiptsLastHour || 0) }
      });
    } else {
      console.log(`   ✅ Integrity OK`);
      checks.push({
        name: 'Receipt Integrity',
        status: 'pass',
        data: { posts: postsLastHour, receipts: receiptsLastHour }
      });
    }
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    checks.push({
      name: 'Receipt Integrity',
      status: 'fail',
      error: error.message
    });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY\n');
  
  const passed = checks.filter(c => c.status === 'pass').length;
  const warnings = checks.filter(c => c.status === 'warn').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n🚨 FAILED CHECKS:');
    checks.filter(c => c.status === 'fail').forEach(c => {
      console.log(`   - ${c.name}: ${c.error}`);
    });
  }
  
  if (warnings > 0) {
    console.log('\n⚠️  WARNINGS:');
    checks.filter(c => c.status === 'warn').forEach(c => {
      console.log(`   - ${c.name}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Exit code based on results
  if (failed > 0) {
    process.exit(1);
  } else if (warnings > 0) {
    process.exit(0);
  } else {
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ CRITICAL ERROR:', error.message);
  process.exit(1);
});


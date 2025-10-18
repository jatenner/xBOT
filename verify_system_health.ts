#!/usr/bin/env tsx
/**
 * 🔍 COMPREHENSIVE SYSTEM HEALTH CHECK
 * Verifies all fixes from Batch 1, 2, and 3 are working
 */

import * as dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

interface HealthCheckResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
  metric?: string;
}

const results: HealthCheckResult[] = [];

function addResult(component: string, status: 'pass' | 'fail' | 'warning', details: string, metric?: string) {
  results.push({ component, status, details, metric });
}

function printResults() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 SYSTEM HEALTH CHECK RESULTS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
  results.forEach(r => {
    const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${r.component}`);
    console.log(`   ${r.details}`);
    if (r.metric) console.log(`   ${r.metric}`);
    console.log();
  });
  
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Summary: ${passed} pass, ${failed} fail, ${warnings} warnings`);
  console.log('═══════════════════════════════════════════════════════\n');
}

async function main() {
  console.log('🔍 Starting comprehensive system health check...\n');
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables');
    console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // ═══════════════════════════════════════════════════════════
  // TEST 1: Database Connection
  // ═══════════════════════════════════════════════════════════
  console.log('[1/10] Testing database connection...');
  try {
    const { data, error } = await supabase.from('content_metadata').select('id').limit(1);
    if (error) throw error;
    addResult('Database Connection', 'pass', 'Successfully connected to Supabase');
  } catch (err: any) {
    addResult('Database Connection', 'fail', `Failed: ${err.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // TEST 2: Content Metadata Table (Batch 1 Fix)
  // ═══════════════════════════════════════════════════════════
  console.log('[2/10] Checking content_metadata table...');
  try {
    const { count, error } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    if (count === 0) {
      addResult('Content Metadata Table', 'warning', 'Table exists but has 0 rows', `Rows: ${count}`);
    } else {
      addResult('Content Metadata Table', 'pass', 'Table exists with content', `Rows: ${count}`);
    }
  } catch (err: any) {
    addResult('Content Metadata Table', 'fail', `Error: ${err.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // TEST 3: Recent Content Generation (Last 24h)
  // ═══════════════════════════════════════════════════════════
  console.log('[3/10] Checking recent content generation...');
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error, count } = await supabase
      .from('content_metadata')
      .select('id, content, status, quality_score, created_at', { count: 'exact' })
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    
    if (count === 0) {
      addResult('Content Generation (24h)', 'fail', 'No content generated in last 24 hours', `Count: 0`);
    } else {
      const preview = data && data[0] ? data[0].content.substring(0, 50) : '';
      addResult('Content Generation (24h)', 'pass', `Generated ${count} pieces of content`, `Latest: "${preview}..."`);
    }
  } catch (err: any) {
    addResult('Content Generation (24h)', 'fail', `Error: ${err.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // TEST 4: Content Quality Scores (Batch 1 Fix)
  // ═══════════════════════════════════════════════════════════
  console.log('[4/10] Checking content quality scores...');
  try {
    const { data, error } = await supabase
      .from('content_metadata')
      .select('quality_score')
      .not('quality_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      addResult('Content Quality', 'warning', 'No quality scores found');
    } else {
      const scores = data.map(d => d.quality_score).filter(s => s !== null);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const passThreshold = 72; // Our current threshold
      const passing = scores.filter(s => s >= passThreshold).length;
      
      if (avgScore >= passThreshold) {
        addResult('Content Quality', 'pass', `Average quality: ${avgScore.toFixed(1)}/100`, `${passing}/${scores.length} pass threshold (≥72)`);
      } else {
        addResult('Content Quality', 'warning', `Average quality: ${avgScore.toFixed(1)}/100 (below 72)`, `${passing}/${scores.length} pass threshold`);
      }
    }
  } catch (err: any) {
    addResult('Content Quality', 'fail', `Error: ${err.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // TEST 5: Posting Queue Status
  // ═══════════════════════════════════════════════════════════
  console.log('[5/10] Checking posting queue...');
  try {
    const { data: queuedData, error: queueError, count: queuedCount } = await supabase
      .from('content_metadata')
      .select('id, scheduled_at', { count: 'exact' })
      .eq('status', 'queued')
      .order('scheduled_at', { ascending: true });
    
    if (queueError) throw queueError;
    
    const { count: postedCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted');
    
    if (queuedCount === 0 && postedCount === 0) {
      addResult('Posting Queue', 'warning', 'Queue is empty and no posts made yet', 'System may be starting up');
    } else {
      addResult('Posting Queue', 'pass', `${queuedCount || 0} queued, ${postedCount || 0} posted`, 'Posting system active');
    }
  } catch (err: any) {
    addResult('Posting Queue', 'fail', `Error: ${err.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // TEST 6: Discovered Accounts Table (Batch 2 Fix)
  // ═══════════════════════════════════════════════════════════
  console.log('[6/10] Checking discovered_accounts table...');
  try {
    const { count, error } = await supabase
      .from('discovered_accounts')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    if (count === 0) {
      addResult('Discovered Accounts Table', 'warning', 'Table exists but empty (discovery not run yet)', `Rows: 0`);
    } else {
      addResult('Discovered Accounts Table', 'pass', 'Table exists with accounts', `Accounts: ${count}`);
    }
  } catch (err: any) {
    addResult('Discovered Accounts Table', 'fail', `Error: ${err.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // TEST 7: Account Discovery Quality
  // ═══════════════════════════════════════════════════════════
  console.log('[7/10] Checking discovered account quality...');
  try {
    const { data, error, count } = await supabase
      .from('discovered_accounts')
      .select('username, final_score', { count: 'exact' })
      .gte('final_score', 50)
      .order('final_score', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    
    if (count === 0) {
      addResult('Account Quality', 'warning', 'No high-quality accounts discovered yet', 'Discovery may not have run');
    } else {
      const topAccounts = data?.map(a => `@${a.username} (${a.final_score})`).join(', ') || '';
      addResult('Account Quality', 'pass', `${count} quality accounts found`, `Top: ${topAccounts}`);
    }
  } catch (err: any) {
    addResult('Account Quality', 'warning', `Discovery not yet active: ${err.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // TEST 8: Recent Metrics Collection
  // ═══════════════════════════════════════════════════════════
  console.log('[8/10] Checking metrics collection...');
  try {
    const { data, error } = await supabase
      .from('outcomes')
      .select('tweet_id, impressions, likes, retweets, collected_at')
      .not('impressions', 'is', null)
      .order('collected_at', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      addResult('Metrics Collection', 'warning', 'No metrics collected yet', 'May not have posted yet');
    } else {
      const latest = data[0];
      const hasRealMetrics = latest.impressions > 0 || latest.likes > 0 || latest.retweets > 0;
      
      if (hasRealMetrics) {
        addResult('Metrics Collection', 'pass', `Collecting real metrics`, `Latest: ${latest.impressions} views, ${latest.likes} likes`);
      } else {
        addResult('Metrics Collection', 'warning', 'Metrics recorded but all zeros', 'Scraping may need time to collect');
      }
    }
  } catch (err: any) {
    addResult('Metrics Collection', 'warning', `Not yet active: ${err.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // TEST 9: Generator Diversity
  // ═══════════════════════════════════════════════════════════
  console.log('[9/10] Checking generator diversity...');
  try {
    const { data, error } = await supabase
      .from('content_metadata')
      .select('generator_name')
      .not('generator_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      addResult('Generator Diversity', 'warning', 'No generator data yet');
    } else {
      const generators = [...new Set(data.map(d => d.generator_name))];
      const generatorCounts = generators.map(g => {
        const count = data.filter(d => d.generator_name === g).length;
        return `${g}: ${count}`;
      }).join(', ');
      
      if (generators.length >= 3) {
        addResult('Generator Diversity', 'pass', `${generators.length} different generators active`, generatorCounts);
      } else {
        addResult('Generator Diversity', 'warning', `Only ${generators.length} generators in use`, generatorCounts);
      }
    }
  } catch (err: any) {
    addResult('Generator Diversity', 'warning', `No generator data: ${err.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // TEST 10: System Activity (Last Hour)
  // ═══════════════════════════════════════════════════════════
  console.log('[10/10] Checking system activity (last hour)...');
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count: contentCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo);
    
    const { count: discoveryCount } = await supabase
      .from('discovered_accounts')
      .select('*', { count: 'exact', head: true })
      .gte('last_updated', oneHourAgo);
    
    if (contentCount === 0 && discoveryCount === 0) {
      addResult('System Activity', 'warning', 'No activity in last hour', 'System may be idle or just deployed');
    } else {
      addResult('System Activity', 'pass', 'System is active', `Content: ${contentCount}, Discovery: ${discoveryCount}`);
    }
  } catch (err: any) {
    addResult('System Activity', 'fail', `Error: ${err.message}`);
  }
  
  // Print all results
  printResults();
  
  // Exit code based on failures
  const hasCriticalFailures = results.some(r => 
    r.status === 'fail' && 
    ['Database Connection', 'Content Metadata Table', 'Discovered Accounts Table'].includes(r.component)
  );
  
  process.exit(hasCriticalFailures ? 1 : 0);
}

main().catch(err => {
  console.error('\n❌ Health check failed:', err.message);
  process.exit(1);
});


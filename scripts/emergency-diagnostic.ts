#!/usr/bin/env tsx
/**
 * Emergency System Diagnostic
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function emergencyCheck() {
  console.log('🚨 EMERGENCY SYSTEM DIAGNOSTIC\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Database connection
  console.log('1. DATABASE CONNECTION:');
  try {
    const { data, error } = await supabase.from('content_metadata').select('decision_id').limit(1);
    if (error) throw error;
    console.log('   ✅ Connected\n');
  } catch (err) {
    console.log('   ❌ FAILED:', err);
    console.log('\n');
    return;
  }

  // 2. Check if table is actually empty or query issue
  console.log('2. CHECKING TABLE DATA:\n');
  
  const { count: totalCount } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true });

  console.log(`   Total rows in table: ${totalCount || 0}`);
  
  if ((totalCount || 0) === 0) {
    console.log('   ⚠️  TABLE IS COMPLETELY EMPTY!\n');
    console.log('   This means planJob has NEVER run or table was cleared\n');
  } else {
    // Get most recent
    const { data: mostRecent } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, decision_type, status, created_at, posted_at')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('\n   Most recent 5 rows:\n');
    mostRecent?.forEach((row, i) => {
      const daysAgo = Math.round((Date.now() - new Date(row.created_at).getTime()) / 1000 / 60 / 60 / 24);
      console.log(`     ${i + 1}. ${row.decision_type} - ${row.status}`);
      console.log(`        Created: ${daysAgo} days ago`);
      console.log(`        Date: ${new Date(row.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
    });
  }

  // 3. Check job_heartbeats
  console.log('\n3. JOB HEARTBEATS (System activity):\n');
  
  const { data: heartbeats } = await supabase
    .from('job_heartbeats')
    .select('job_name, last_run, status')
    .order('last_run', { ascending: false })
    .limit(10);

  if (heartbeats && heartbeats.length > 0) {
    heartbeats.forEach((hb, i) => {
      const minutesAgo = Math.round((Date.now() - new Date(hb.last_run).getTime()) / 1000 / 60);
      console.log(`   ${i + 1}. ${hb.job_name}`);
      console.log(`      Last run: ${minutesAgo}m ago`);
      console.log(`      Status: ${hb.status}`);
    });
  } else {
    console.log('   ⚠️  No heartbeats found\n');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎯 DIAGNOSIS:\n');
  
  if ((totalCount || 0) === 0) {
    console.log('   ❌ CRITICAL: Table is empty, system never ran OR was wiped\n');
    console.log('   🔧 FIX: Need to restart service or trigger planJob manually\n');
  } else if (mostRecent && mostRecent[0]) {
    const daysSinceLastActivity = Math.round(
      (Date.now() - new Date(mostRecent[0].created_at).getTime()) / 1000 / 60 / 60 / 24
    );
    
    if (daysSinceLastActivity > 1) {
      console.log(`   ❌ CRITICAL: Last activity was ${daysSinceLastActivity} days ago\n`);
      console.log('   🔧 FIX: planJob is not running, need to restart service\n');
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

emergencyCheck();


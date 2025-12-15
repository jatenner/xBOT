#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function runReadinessCheck() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log('PHASE 4 READINESS ASSESSMENT');
  console.log('='.repeat(60));
  console.log('Time: ' + new Date().toISOString());
  console.log('');
  
  const results = {};
  
  try {
    // Query 1: v2 outcomes
    const q1Sql = `
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN followers_gained_weighted IS NOT NULL THEN 1 ELSE 0 END) AS with_v2
      FROM outcomes
      WHERE collected_at > NOW() - INTERVAL '3 days'
    `;
    const { data: q1Data, error: q1Error } = await supabase.rpc('exec_sql', { sql: q1Sql });
    const q1Result = q1Error ? { success: false, error: q1Error.message } : { success: true, data: q1Data };
    
    if (!q1Result.success) {
      console.log('1) v2 outcomes: ERROR -', q1Result.error);
      results.q1 = { error: q1Result.error };
    } else {
      const row = Array.isArray(q1Result.data) ? q1Result.data[0] : (q1Result.data?.rows?.[0] || q1Result.data);
      const total = parseInt(row?.total || 0);
      const withV2 = parseInt(row?.with_v2 || 0);
      const pct = total > 0 ? ((withV2 / total) * 100).toFixed(1) : '0.0';
      console.log('1) v2 outcomes (last 3 days):');
      console.log(`   Total: ${total}`);
      console.log(`   With v2: ${withV2}`);
      console.log(`   Percentage: ${pct}%`);
      results.q1 = { total, withV2, percentage: parseFloat(pct) };
    }
    console.log('');
    
    // Query 2: content_slot
    const q2Sql = `
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN content_slot IS NOT NULL THEN 1 ELSE 0 END) AS with_slot
      FROM content_metadata
      WHERE created_at > NOW() - INTERVAL '3 days'
    `;
    const { data: q2Data, error: q2Error } = await supabase.rpc('exec_sql', { sql: q2Sql });
    const q2Result = q2Error ? { success: false, error: q2Error.message } : { success: true, data: q2Data };
    
    if (!q2Result.success) {
      console.log('2) content_slot: ERROR -', q2Result.error);
      results.q2 = { error: q2Result.error };
    } else {
      const row = Array.isArray(q2Result.data) ? q2Result.data[0] : (q2Result.data?.rows?.[0] || q2Result.data);
      const total = parseInt(row?.total || 0);
      const withSlot = parseInt(row?.with_slot || 0);
      const pct = total > 0 ? ((withSlot / total) * 100).toFixed(1) : '0.0';
      console.log('2) content_slot (last 3 days):');
      console.log(`   Total: ${total}`);
      console.log(`   With slot: ${withSlot}`);
      console.log(`   Percentage: ${pct}%`);
      results.q2 = { total, withSlot, percentage: parseFloat(pct) };
    }
    console.log('');
    
    // Query 3: vw_learning
    const q3Sql = `
      SELECT COUNT(*) AS recent_learning_rows
      FROM vw_learning
      WHERE posted_at > NOW() - INTERVAL '3 days'
    `;
    const { data: q3Data, error: q3Error } = await supabase.rpc('exec_sql', { sql: q3Sql });
    const q3Result = q3Error ? { success: false, error: q3Error.message } : { success: true, data: q3Data };
    
    if (!q3Result.success) {
      console.log('3) vw_learning: ERROR -', q3Result.error);
      results.q3 = { error: q3Result.error };
    } else {
      const row = Array.isArray(q3Result.data) ? q3Result.data[0] : (q3Result.data?.rows?.[0] || q3Result.data);
      const count = parseInt(row?.recent_learning_rows || 0);
      console.log('3) vw_learning rows (last 3 days):');
      console.log(`   Rows: ${count}`);
      results.q3 = { count };
    }
    console.log('');
    
    // Query 4: weight maps
    const q4Sql = `
      SELECT COUNT(*) AS weight_maps_last_3d
      FROM learning_model_weights
      WHERE created_at > NOW() - INTERVAL '3 days'
    `;
    const { data: q4Data, error: q4Error } = await supabase.rpc('exec_sql', { sql: q4Sql });
    const q4Result = q4Error ? { success: false, error: q4Error.message } : { success: true, data: q4Data };
    
    if (!q4Result.success) {
      console.log('4) Weight maps: ERROR -', q4Result.error);
      results.q4 = { error: q4Result.error };
    } else {
      const row = Array.isArray(q4Result.data) ? q4Result.data[0] : (q4Result.data?.rows?.[0] || q4Result.data);
      const count = parseInt(row?.weight_maps_last_3d || 0);
      console.log('4) Weight maps (last 3 days):');
      console.log(`   Count: ${count}`);
      results.q4 = { count };
    }
    console.log('');
    
    // Query 5: reply priorities
    const q5Sql = `
      SELECT COUNT(*) AS total_accounts,
             SUM(CASE WHEN priority_score > 0 THEN 1 ELSE 0 END) AS non_zero_priority
      FROM discovered_accounts
    `;
    const { data: q5Data, error: q5Error } = await supabase.rpc('exec_sql', { sql: q5Sql });
    const q5Result = q5Error ? { success: false, error: q5Error.message } : { success: true, data: q5Data };
    
    if (!q5Result.success) {
      console.log('5) Reply priorities: ERROR -', q5Result.error);
      results.q5 = { error: q5Result.error };
    } else {
      const row = Array.isArray(q5Result.data) ? q5Result.data[0] : (q5Result.data?.rows?.[0] || q5Result.data);
      const total = parseInt(row?.total_accounts || 0);
      const nonZero = parseInt(row?.non_zero_priority || 0);
      const pct = total > 0 ? ((nonZero / total) * 100).toFixed(1) : '0.0';
      console.log('5) Reply priorities:');
      console.log(`   Total accounts: ${total}`);
      console.log(`   Non-zero priority: ${nonZero}`);
      console.log(`   Percentage: ${pct}%`);
      results.q5 = { total, nonZero, percentage: parseFloat(pct) };
    }
    console.log('');
    console.log('='.repeat(60));
    
    // Final verdict
    console.log('FINAL VERDICT:');
    console.log('='.repeat(60));
    
    const issues = [];
    
    if (results.q1?.error) {
      issues.push(`v2 outcomes query failed: ${results.q1.error}`);
    } else if (results.q1?.total === 0) {
      issues.push('No outcomes collected in last 3 days');
    } else if (results.q1?.withV2 === 0) {
      issues.push('v2 outcomes fields 0% populated');
    }
    
    if (results.q2?.error) {
      issues.push(`content_slot query failed: ${results.q2.error}`);
    } else if (results.q2?.total === 0) {
      issues.push('No content created in last 3 days');
    } else if (results.q2?.withSlot === 0) {
      issues.push('content_slot 0% populated');
    }
    
    if (results.q3?.error) {
      issues.push(`vw_learning query failed: ${results.q3.error}`);
    } else if (results.q3?.count === 0) {
      issues.push('vw_learning has no recent rows');
    }
    
    if (results.q4?.error) {
      issues.push(`Weight maps query failed: ${results.q4.error}`);
    } else if (results.q4?.count === 0) {
      issues.push('No weight maps generated in last 3 days');
    }
    
    if (results.q5?.error) {
      issues.push(`Reply priorities query failed: ${results.q5.error}`);
    } else if (results.q5?.nonZero === 0) {
      issues.push('All priority_score values are zero');
    }
    
    if (issues.length === 0) {
      console.log('✅ READY FOR PHASE 4');
      console.log('');
      console.log('All systems operational:');
      console.log('  - v2 outcomes are being populated');
      console.log('  - content_slot is being stored');
      console.log('  - vw_learning has recent data');
      console.log('  - Weight maps are being generated');
      console.log('  - Priority scores are being updated');
    } else {
      console.log('❌ NOT READY FOR PHASE 4');
      console.log('');
      console.log('Remaining blockers:');
      issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }
    
  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runReadinessCheck();
}


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
    const { data: q1, error: e1 } = await supabase
      .from('outcomes')
      .select('followers_gained_weighted, collected_at')
      .gte('collected_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .order('collected_at', { ascending: false });
    
    if (e1) {
      console.log('1) v2 outcomes: ERROR -', e1.message);
      results.q1 = { error: e1.message };
    } else {
      const total = q1?.length || 0;
      const withV2 = q1?.filter(o => o.followers_gained_weighted !== null && o.followers_gained_weighted !== undefined).length || 0;
      const pct = total > 0 ? ((withV2 / total) * 100).toFixed(1) : '0.0';
      console.log('1) v2 outcomes (last 3 days):');
      console.log(`   Total: ${total}`);
      console.log(`   With v2: ${withV2}`);
      console.log(`   Percentage: ${pct}%`);
      results.q1 = { total, withV2, percentage: parseFloat(pct) };
    }
    console.log('');
    
    // Query 2: content_slot
    const { data: q2, error: e2 } = await supabase
      .from('content_metadata')
      .select('content_slot, created_at')
      .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    if (e2) {
      console.log('2) content_slot: ERROR -', e2.message);
      results.q2 = { error: e2.message };
    } else {
      const total = q2?.length || 0;
      const withSlot = q2?.filter(c => c.content_slot !== null && c.content_slot !== undefined).length || 0;
      const pct = total > 0 ? ((withSlot / total) * 100).toFixed(1) : '0.0';
      console.log('2) content_slot (last 3 days):');
      console.log(`   Total: ${total}`);
      console.log(`   With slot: ${withSlot}`);
      console.log(`   Percentage: ${pct}%`);
      results.q2 = { total, withSlot, percentage: parseFloat(pct) };
    }
    console.log('');
    
    // Query 3: vw_learning - try direct query
    let q3Count = 0;
    let q3Error = null;
    try {
      const { data: q3, error: e3 } = await supabase
        .from('vw_learning')
        .select('decision_id', { count: 'exact', head: true })
        .gte('posted_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
      
      if (e3) {
        q3Error = e3.message;
      } else {
        // Try to get count via RPC if direct query doesn't work
        const { data: rpcResult, error: rpcError } = await supabase.rpc('exec_sql', {
          sql: `SELECT COUNT(*) AS count FROM vw_learning WHERE posted_at > NOW() - INTERVAL '3 days'`
        });
        if (!rpcError && rpcResult && rpcResult[0]) {
          q3Count = parseInt(rpcResult[0].count) || 0;
        } else if (!e3) {
          // Fallback: fetch all and count
          const { data: allRows } = await supabase
            .from('vw_learning')
            .select('decision_id')
            .gte('posted_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
          q3Count = allRows?.length || 0;
        }
      }
    } catch (err) {
      q3Error = err.message;
    }
    
    if (q3Error) {
      console.log('3) vw_learning: ERROR -', q3Error);
      results.q3 = { error: q3Error };
    } else {
      console.log('3) vw_learning rows (last 3 days):');
      console.log(`   Rows: ${q3Count}`);
      results.q3 = { count: q3Count };
    }
    console.log('');
    
    // Query 4: weight maps
    const { data: q4, error: e4 } = await supabase
      .from('learning_model_weights')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    if (e4) {
      console.log('4) Weight maps: ERROR -', e4.message);
      results.q4 = { error: e4.message };
    } else {
      const count = q4?.length || 0;
      console.log('4) Weight maps (last 3 days):');
      console.log(`   Count: ${count}`);
      results.q4 = { count };
    }
    console.log('');
    
    // Query 5: reply priorities
    const { data: q5, error: e5 } = await supabase
      .from('discovered_accounts')
      .select('priority_score');
    
    if (e5) {
      console.log('5) Reply priorities: ERROR -', e5.message);
      results.q5 = { error: e5.message };
    } else {
      const total = q5?.length || 0;
      const nonZero = q5?.filter(a => (a.priority_score || 0) > 0).length || 0;
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


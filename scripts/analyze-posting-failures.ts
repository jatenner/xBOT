/**
 * 🔍 Analyze Posting Failures
 * Shows what's actually causing failures and whether they're normal or problematic
 */

import { getSupabaseClient } from '../src/db';

async function analyzeFailures() {
  const supabase = getSupabaseClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  console.log('🔍 Analyzing posting failures from last 24 hours...\n');
  
  // Get all attempts
  const { data: attempts } = await supabase
    .from('posting_attempts')
    .select('status, error_message, decision_type, created_at')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false });
  
  if (!attempts || attempts.length === 0) {
    console.log('✅ No posting attempts found in last 24 hours');
    return;
  }
  
  // Filter to final statuses only
  const finalAttempts = attempts.filter(a => a.status !== 'attempting');
  const failed = finalAttempts.filter(a => a.status === 'failed');
  const success = finalAttempts.filter(a => a.status === 'success');
  
  console.log(`📊 Summary:`);
  console.log(`   Total final attempts: ${finalAttempts.length}`);
  console.log(`   ✅ Success: ${success.length} (${((success.length / finalAttempts.length) * 100).toFixed(1)}%)`);
  console.log(`   ❌ Failed: ${failed.length} (${((failed.length / finalAttempts.length) * 100).toFixed(1)}%)`);
  console.log('');
  
  if (failed.length === 0) {
    console.log('✅ No failures! System is working perfectly.');
    return;
  }
  
  // Analyze error messages
  console.log('🔍 Failure Analysis:\n');
  
  const errorPatterns: Record<string, { count: number; examples: string[] }> = {};
  
  failed.forEach(f => {
    const error = f.error_message || 'No error message';
    
    // Categorize errors
    let category = 'Other';
    if (/timeout|exceeded|waiting/i.test(error)) {
      category = 'Timeout';
    } else if (/session|auth|login|authenticated/i.test(error)) {
      category = 'Authentication';
    } else if (/rate.*limit|too.*many|429/i.test(error)) {
      category = 'Rate Limit';
    } else if (/network|connection|ECONNREFUSED/i.test(error)) {
      category = 'Network';
    } else if (/content|validation|invalid|too.*short/i.test(error)) {
      category = 'Content Validation';
    } else if (/browser|playwright|page.*not.*found/i.test(error)) {
      category = 'Browser/Playwright';
    } else if (/circuit.*breaker|blocked/i.test(error)) {
      category = 'Circuit Breaker';
    }
    
    if (!errorPatterns[category]) {
      errorPatterns[category] = { count: 0, examples: [] };
    }
    
    errorPatterns[category].count++;
    if (errorPatterns[category].examples.length < 3) {
      errorPatterns[category].examples.push(error.substring(0, 150));
    }
  });
  
  // Sort by count
  const sortedPatterns = Object.entries(errorPatterns).sort((a, b) => b[1].count - a[1].count);
  
  sortedPatterns.forEach(([category, data]) => {
    const percentage = ((data.count / failed.length) * 100).toFixed(1);
    console.log(`📌 ${category}: ${data.count} failures (${percentage}% of failures)`);
    data.examples.forEach((example, i) => {
      console.log(`   ${i + 1}. ${example}`);
    });
    console.log('');
  });
  
  // Determine if failures are normal
  console.log('🎯 Assessment:\n');
  
  const timeoutCount = errorPatterns['Timeout']?.count || 0;
  const authCount = errorPatterns['Authentication']?.count || 0;
  const networkCount = errorPatterns['Network']?.count || 0;
  
  const totalRecoverable = timeoutCount + authCount + networkCount;
  const recoverablePercentage = ((totalRecoverable / failed.length) * 100).toFixed(1);
  
  console.log(`   Recoverable failures (timeout/auth/network): ${totalRecoverable}/${failed.length} (${recoverablePercentage}%)`);
  console.log(`   These are NORMAL - system retries automatically\n`);
  
  if (recoverablePercentage > 80) {
    console.log('✅ MOST FAILURES ARE NORMAL:');
    console.log('   - Timeouts are common with browser automation');
    console.log('   - System has retry logic (3 retries + recovery)');
    console.log('   - Many "failures" are actually false alarms (tweet posted, verification timed out)');
    console.log('   - System verifies tweets before marking as failed\n');
  }
  
  const problematicCount = failed.length - totalRecoverable;
  if (problematicCount > 0) {
    console.log(`⚠️  POTENTIALLY PROBLEMATIC FAILURES: ${problematicCount}`);
    console.log('   - These might need investigation\n');
  }
  
  // Check retry success rate
  const { data: retried } = await supabase
    .from('content_metadata')
    .select('decision_id, status, features')
    .gte('created_at', oneDayAgo)
    .eq('status', 'posted');
  
  const retriedCount = retried?.filter(r => {
    const features = r.features as any;
    return features?.retry_count > 0 || features?.recovery_attempts > 0;
  }).length || 0;
  
  if (retriedCount > 0) {
    console.log(`🔄 Retry Success: ${retriedCount} posts succeeded after retry`);
    console.log('   This shows retry logic is working!\n');
  }
}

analyzeFailures().catch(console.error);


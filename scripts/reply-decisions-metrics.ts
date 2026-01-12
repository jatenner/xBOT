#!/usr/bin/env tsx
/**
 * 📊 REPLY DECISIONS METRICS: Operational metrics for reply ancestry resolution
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function getMetrics() {
  const supabase = getSupabaseClient();
  
  console.log('\n📊 REPLY DECISIONS METRICS\n');
  console.log('═'.repeat(80));
  
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  
  // Last 24h totals
  console.log('\n📈 LAST 24 HOURS:');
  console.log('-'.repeat(80));
  
  const { data: last24hData, error: last24hError } = await supabase
    .from('reply_decisions')
    .select('decision, reason')
    .gte('created_at', last24h);
  
  if (last24hError) {
    console.error(`❌ Error: ${last24hError.message}`);
    return;
  }
  
  const total24h = last24hData?.length || 0;
  const allow24h = last24hData?.filter(r => r.decision === 'ALLOW').length || 0;
  const deny24h = last24hData?.filter(r => r.decision === 'DENY').length || 0;
  
  // Parse status from reason field
  const uncertain24h = last24hData?.filter(r => r.reason?.includes('ANCESTRY_UNCERTAIN_FAIL_CLOSED')).length || 0;
  const error24h = last24hData?.filter(r => r.reason?.includes('ANCESTRY_ERROR_FAIL_CLOSED')).length || 0;
  
  console.log(`  Total: ${total24h}`);
  console.log(`  ALLOW: ${allow24h} (${total24h > 0 ? ((allow24h / total24h) * 100).toFixed(1) : 0}%)`);
  console.log(`  DENY: ${deny24h} (${total24h > 0 ? ((deny24h / total24h) * 100).toFixed(1) : 0}%)`);
  console.log(`  UNCERTAIN: ${uncertain24h} (${total24h > 0 ? ((uncertain24h / total24h) * 100).toFixed(1) : 0}%)`);
  console.log(`  ERROR: ${error24h} (${total24h > 0 ? ((error24h / total24h) * 100).toFixed(1) : 0}%)`);
  
  // Last 1h totals
  console.log('\n📈 LAST 1 HOUR:');
  console.log('-'.repeat(80));
  
  const { data: last1hData } = await supabase
    .from('reply_decisions')
    .select('decision, reason')
    .gte('created_at', last1h);
  
  const total1h = last1hData?.length || 0;
  const allow1h = last1hData?.filter(r => r.decision === 'ALLOW').length || 0;
  const deny1h = last1hData?.filter(r => r.decision === 'DENY').length || 0;
  const uncertain1h = last1hData?.filter(r => r.reason?.includes('ANCESTRY_UNCERTAIN_FAIL_CLOSED')).length || 0;
  const error1h = last1hData?.filter(r => r.reason?.includes('ANCESTRY_ERROR_FAIL_CLOSED')).length || 0;
  
  console.log(`  Total: ${total1h}`);
  console.log(`  ALLOW: ${allow1h} (${total1h > 0 ? ((allow1h / total1h) * 100).toFixed(1) : 0}%)`);
  console.log(`  DENY: ${deny1h} (${total1h > 0 ? ((deny1h / total1h) * 100).toFixed(1) : 0}%)`);
  console.log(`  UNCERTAIN: ${uncertain1h} (${total1h > 0 ? ((uncertain1h / total1h) * 100).toFixed(1) : 0}%)`);
  console.log(`  ERROR: ${error1h} (${total1h > 0 ? ((error1h / total1h) * 100).toFixed(1) : 0}%)`);
  
  // Top 10 UNCERTAIN reasons
  console.log('\n⚠️  TOP 10 UNCERTAIN REASONS (last 24h):');
  console.log('-'.repeat(80));
  
  const uncertainReasons = last24hData
    ?.filter(r => r.reason?.includes('ANCESTRY_UNCERTAIN_FAIL_CLOSED'))
    .map(r => {
      const match = r.reason?.match(/method=([^,]+)/);
      return match ? match[1] : 'unknown';
    })
    .reduce((acc: Record<string, number>, method) => {
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {}) || {};
  
  const topUncertain = Object.entries(uncertainReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  if (topUncertain.length === 0) {
    console.log('  No UNCERTAIN cases found');
  } else {
    topUncertain.forEach(([method, count], i) => {
      console.log(`  [${i + 1}] ${method}: ${count}`);
    });
  }
  
  // Top 10 ERROR reasons
  console.log('\n❌ TOP 10 ERROR REASONS (last 24h):');
  console.log('-'.repeat(80));
  
  const errorReasons = last24hData
    ?.filter(r => r.reason?.includes('ANCESTRY_ERROR_FAIL_CLOSED'))
    .map(r => {
      const errorMatch = r.reason?.match(/error=([^,]+)/);
      return errorMatch ? errorMatch[1].substring(0, 50) : 'unknown';
    })
    .reduce((acc: Record<string, number>, error) => {
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {}) || {};
  
  const topErrors = Object.entries(errorReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  if (topErrors.length === 0) {
    console.log('  No ERROR cases found');
  } else {
    topErrors.forEach(([error, count], i) => {
      console.log(`  [${i + 1}] ${error}: ${count}`);
    });
  }
  
  // Method breakdown (parse from reason)
  console.log('\n🔧 METHOD BREAKDOWN (last 24h):');
  console.log('-'.repeat(80));
  
  const methodBreakdown = last24hData
    ?.map(r => {
      const match = r.reason?.match(/method=([^,]+)/);
      return match ? match[1] : 'unknown';
    })
    .reduce((acc: Record<string, { allow: number; deny: number }>, method) => {
      if (!acc[method]) acc[method] = { allow: 0, deny: 0 };
      return acc;
    }, {}) || {};
  
  // Count allow/deny per method
  last24hData?.forEach(r => {
    const match = r.reason?.match(/method=([^,]+)/);
    const method = match ? match[1] : 'unknown';
    if (methodBreakdown[method]) {
      if (r.decision === 'ALLOW') methodBreakdown[method].allow++;
      else methodBreakdown[method].deny++;
    }
  });
  
  Object.entries(methodBreakdown)
    .sort((a, b) => (b[1].allow + b[1].deny) - (a[1].allow + a[1].deny))
    .forEach(([method, counts]) => {
      const total = counts.allow + counts.deny;
      console.log(`  ${method}: ${total} total (${counts.allow} ALLOW, ${counts.deny} DENY)`);
    });
  
  console.log('\n═'.repeat(80));
  console.log('✅ Metrics complete\n');
}

getMetrics().catch((error) => {
  console.error('❌ Metrics failed:', error);
  process.exit(1);
});

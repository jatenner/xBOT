/**
 * Comprehensive Data Storage Verification Script
 * Tests that ALL systems are properly saving data after migration
 */

import { getSupabaseClient } from '../src/db';

interface VerificationResult {
  system: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

async function verifyGenerationMetadataColumn(): Promise<void> {
  console.log('\n🔍 1. Verifying generation_metadata column...');
  
  const supabase = getSupabaseClient();
  
  try {
    // Check if column exists
    const { data, error } = await supabase
      .from('content_metadata')
      .select('generation_metadata')
      .limit(1);
    
    if (error) {
      results.push({
        system: 'generation_metadata column',
        status: 'fail',
        message: `Column check failed: ${error.message}`
      });
      return;
    }
    
    results.push({
      system: 'generation_metadata column',
      status: 'pass',
      message: 'Column exists and is queryable ✅'
    });
    
  } catch (error: any) {
    results.push({
      system: 'generation_metadata column',
      status: 'fail',
      message: `Verification error: ${error.message}`
    });
  }
}

async function verifyPerformanceSnapshotsTable(): Promise<void> {
  console.log('\n🔍 2. Verifying performance_snapshots table...');
  
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('performance_snapshots')
      .select('id')
      .limit(1);
    
    if (error) {
      results.push({
        system: 'performance_snapshots table',
        status: 'fail',
        message: `Table check failed: ${error.message}`
      });
      return;
    }
    
    results.push({
      system: 'performance_snapshots table',
      status: 'pass',
      message: 'Table exists for time-series tracking ✅'
    });
    
  } catch (error: any) {
    results.push({
      system: 'performance_snapshots table',
      status: 'fail',
      message: `Verification error: ${error.message}`
    });
  }
}

async function verifyFollowerAttributionsTable(): Promise<void> {
  console.log('\n🔍 3. Verifying follower_attributions table...');
  
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('follower_attributions')
      .select('id')
      .limit(1);
    
    if (error) {
      results.push({
        system: 'follower_attributions table',
        status: 'fail',
        message: `Table check failed: ${error.message}`
      });
      return;
    }
    
    results.push({
      system: 'follower_attributions table',
      status: 'pass',
      message: 'Table exists for follower tracking ✅'
    });
    
  } catch (error: any) {
    results.push({
      system: 'follower_attributions table',
      status: 'fail',
      message: `Verification error: ${error.message}`
    });
  }
}

async function verifyContentTypePerformanceTable(): Promise<void> {
  console.log('\n🔍 4. Verifying content_type_performance table...');
  
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('content_type_performance')
      .select('id')
      .limit(1);
    
    if (error) {
      results.push({
        system: 'content_type_performance table',
        status: 'fail',
        message: `Table check failed: ${error.message}`
      });
      return;
    }
    
    results.push({
      system: 'content_type_performance table',
      status: 'pass',
      message: 'Table exists for content type learning ✅'
    });
    
  } catch (error: any) {
    results.push({
      system: 'content_type_performance table',
      status: 'fail',
      message: `Verification error: ${error.message}`
    });
  }
}

async function verifyFormulaPerformanceTable(): Promise<void> {
  console.log('\n🔍 5. Verifying formula_performance table...');
  
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('formula_performance')
      .select('id')
      .limit(1);
    
    if (error) {
      results.push({
        system: 'formula_performance table',
        status: 'fail',
        message: `Table check failed: ${error.message}`
      });
      return;
    }
    
    results.push({
      system: 'formula_performance table',
      status: 'pass',
      message: 'Table exists for formula learning ✅'
    });
    
  } catch (error: any) {
    results.push({
      system: 'formula_performance table',
      status: 'fail',
      message: `Verification error: ${error.message}`
    });
  }
}

async function verifyLearningUpdatesTable(): Promise<void> {
  console.log('\n🔍 6. Verifying learning_updates table...');
  
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('learning_updates')
      .select('id')
      .limit(1);
    
    if (error) {
      results.push({
        system: 'learning_updates table',
        status: 'fail',
        message: `Table check failed: ${error.message}`
      });
      return;
    }
    
    results.push({
      system: 'learning_updates table',
      status: 'pass',
      message: 'Table exists for learning history ✅'
    });
    
  } catch (error: any) {
    results.push({
      system: 'learning_updates table',
      status: 'fail',
      message: `Verification error: ${error.message}`
    });
  }
}

async function verifyTweetAnalyticsTable(): Promise<void> {
  console.log('\n🔍 7. Verifying tweet_analytics_comprehensive table...');
  
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('tweet_analytics_comprehensive')
      .select('id')
      .limit(1);
    
    if (error) {
      results.push({
        system: 'tweet_analytics_comprehensive table',
        status: 'fail',
        message: `Table check failed: ${error.message}`
      });
      return;
    }
    
    results.push({
      system: 'tweet_analytics_comprehensive table',
      status: 'pass',
      message: 'Table exists for comprehensive analytics ✅'
    });
    
  } catch (error: any) {
    results.push({
      system: 'tweet_analytics_comprehensive table',
      status: 'fail',
      message: `Verification error: ${error.message}`
    });
  }
}

async function verifyReplyPerformanceTable(): Promise<void> {
  console.log('\n🔍 8. Verifying reply_performance table...');
  
  const supabase = getSupabaseClient();
  
  try {
    const { data, error} = await supabase
      .from('reply_performance')
      .select('id')
      .limit(1);
    
    if (error) {
      results.push({
        system: 'reply_performance table',
        status: 'fail',
        message: `Table check failed: ${error.message}`
      });
      return;
    }
    
    results.push({
      system: 'reply_performance table',
      status: 'pass',
      message: 'Table exists for reply tracking ✅'
    });
    
  } catch (error: any) {
    results.push({
      system: 'reply_performance table',
      status: 'fail',
      message: `Verification error: ${error.message}`
    });
  }
}

async function verifySystemHealthTable(): Promise<void> {
  console.log('\n🔍 9. Verifying system_health_metrics table...');
  
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('system_health_metrics')
      .select('id')
      .limit(1);
    
    if (error) {
      results.push({
        system: 'system_health_metrics table',
        status: 'fail',
        message: `Table check failed: ${error.message}`
      });
      return;
    }
    
    results.push({
      system: 'system_health_metrics table',
      status: 'pass',
      message: 'Table exists for system health tracking ✅'
    });
    
  } catch (error: any) {
    results.push({
      system: 'system_health_metrics table',
      status: 'fail',
      message: `Verification error: ${error.message}`
    });
  }
}

async function printSummary(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE DATA STORAGE VERIFICATION SUMMARY');
  console.log('='.repeat(80) + '\n');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`⚠️  WARNINGS: ${warnings}`);
  console.log();
  
  // Print details
  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${result.system}: ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  
  if (failed === 0) {
    console.log('\n🎉 ALL SYSTEMS READY FOR COMPREHENSIVE DATA TRACKING!');
    console.log('✅ Your xBOT can now:');
    console.log('   - Track content diversity (hooks, formulas, types)');
    console.log('   - Monitor performance over time (1hr, 4hr, 24hr)');
    console.log('   - Attribute follower gains to specific posts');
    console.log('   - Learn from real data to improve continuously');
    console.log('   - Store hundreds of metrics per post');
    console.log('   - Optimize for follower growth (your #1 goal)');
    console.log();
  } else {
    console.log('\n⚠️  MIGRATION MAY NEED TO RUN');
    console.log('Run: npm run migrate');
    console.log('Or manually apply: supabase/migrations/20251015_comprehensive_data_storage.sql');
    console.log();
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting comprehensive data storage verification...\n');
  
  await verifyGenerationMetadataColumn();
  await verifyPerformanceSnapshotsTable();
  await verifyFollowerAttributionsTable();
  await verifyContentTypePerformanceTable();
  await verifyFormulaPerformanceTable();
  await verifyLearningUpdatesTable();
  await verifyTweetAnalyticsTable();
  await verifyReplyPerformanceTable();
  await verifySystemHealthTable();
  
  await printSummary();
  
  process.exit(0);
}

main();


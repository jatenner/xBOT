#!/usr/bin/env tsx
/**
 * CLI tool to verify schema via Supabase Meta API and PostgREST
 * Usage: npm run verify:schema
 */

import { SupabaseMetaRunner } from '../src/lib/SupabaseMetaRunner';

async function main() {
  console.log('🔍 SCHEMA_VERIFY: Starting schema verification');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ SCHEMA_VERIFY: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  let hasErrors = false;

  try {
    // Test 1: Meta API connectivity
    console.log('🔗 SCHEMA_VERIFY: Testing Meta API connectivity...');
    const runner = new SupabaseMetaRunner();
    
    if (!runner.isAvailable()) {
      console.error('❌ SCHEMA_VERIFY: Meta API not available');
      hasErrors = true;
    } else {
      const testResult = await runner.testConnection();
      if (testResult.success) {
        console.log('✅ SCHEMA_VERIFY: Meta API connection OK');
      } else {
        console.error('❌ SCHEMA_VERIFY: Meta API test failed:', testResult.error);
        hasErrors = true;
      }
    }

    // Test 2: PostgREST tweet_metrics access
    console.log('🔍 SCHEMA_VERIFY: Testing PostgREST tweet_metrics...');
    const metricsResponse = await fetch(
      `${supabaseUrl}/rest/v1/tweet_metrics?select=tweet_id,impressions_count&limit=1`,
      {
        headers: {
          'apikey': serviceKey,
          'authorization': `Bearer ${serviceKey}`
        }
      }
    );

    if (metricsResponse.ok) {
      console.log('✅ SCHEMA_VERIFY: tweet_metrics PostgREST access OK');
    } else {
      const errorText = await metricsResponse.text().catch(() => '');
      console.error('❌ SCHEMA_VERIFY: tweet_metrics access failed:', metricsResponse.status, errorText);
      hasErrors = true;
    }

    // Test 3: PostgREST learning_posts access  
    console.log('🔍 SCHEMA_VERIFY: Testing PostgREST learning_posts...');
    const learningResponse = await fetch(
      `${supabaseUrl}/rest/v1/learning_posts?select=tweet_id,bookmarks_count,viral_potential_score&limit=1`,
      {
        headers: {
          'apikey': serviceKey,
          'authorization': `Bearer ${serviceKey}`
        }
      }
    );

    if (learningResponse.ok) {
      console.log('✅ SCHEMA_VERIFY: learning_posts PostgREST access OK');
    } else {
      const errorText = await learningResponse.text().catch(() => '');
      console.error('❌ SCHEMA_VERIFY: learning_posts access failed:', learningResponse.status, errorText);
      hasErrors = true;
    }

    // Summary
    if (hasErrors) {
      console.error('❌ SCHEMA_VERIFY: Verification failed - some tests failed');
      console.error('💡 Run: npm run migrate:meta');
      process.exit(1);
    } else {
      console.log('✅ SCHEMA_VERIFY: All schema verification tests passed');
      process.exit(0);
    }

  } catch (error: any) {
    console.error('❌ SCHEMA_VERIFY: Unexpected error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

#!/usr/bin/env tsx
/**
 * Schema Verification Script
 * Checks table/column existence and performs smoke tests
 */

import { getAdminClient } from '../src/lib/supabaseClients';

interface TableSpec {
  name: string;
  requiredColumns: string[];
}

const REQUIRED_TABLES: TableSpec[] = [
  {
    name: 'tweet_metrics',
    requiredColumns: [
      'tweet_id', 'collected_at', 'likes_count', 'retweets_count',
      'replies_count', 'bookmarks_count', 'impressions_count', 'content'
    ]
  },
  {
    name: 'learning_posts',
    requiredColumns: [
      'tweet_id', 'created_at', 'format', 'likes_count', 'retweets_count',
      'replies_count', 'bookmarks_count', 'impressions_count', 
      'viral_potential_score', 'content'
    ]
  }
];

async function verifySchema(): Promise<void> {
  console.log('🔍 SCHEMA_VERIFY: Starting comprehensive schema verification');
  
  try {
    const adminClient = await getAdminClient();
    let hasErrors = false;

    // Check each required table and its columns
    for (const table of REQUIRED_TABLES) {
      console.log(`\n📋 Checking table: ${table.name}`);
      
      // Check table existence by attempting to query it
      const { error: tableError } = await adminClient
        .from(table.name)
        .select('*')
        .limit(0);
      
      if (tableError) {
        console.error(`❌ Table ${table.name} not accessible:`, tableError.message);
        hasErrors = true;
        continue;
      }
      
      console.log(`✅ Table ${table.name} exists and is accessible`);
      
      // Verify columns by attempting to select them
      const { error: columnError } = await adminClient
        .from(table.name)
        .select(table.requiredColumns.join(','))
        .limit(1);
      
      if (columnError) {
        console.error(`❌ Column access failed for ${table.name}:`, columnError.message);
        hasErrors = true;
      } else {
        console.log(`✅ All required columns present in ${table.name}`);
      }
    }

    // Perform smoke tests (insert + delete)
    console.log('\n🧪 Performing smoke tests...');
    
    await performSmokeTest(adminClient, 'tweet_metrics', {
      tweet_id: 'test_' + Date.now(),
      collected_at: new Date().toISOString(),
      likes_count: 0,
      retweets_count: 0,
      replies_count: 0,
      bookmarks_count: 0,
      impressions_count: 0,
      content: 'Test tweet content'
    });

    await performSmokeTest(adminClient, 'learning_posts', {
      tweet_id: 'test_learning_' + Date.now(),
      created_at: new Date().toISOString(),
      format: 'single',
      likes_count: 0,
      retweets_count: 0,
      replies_count: 0,
      bookmarks_count: 0,
      impressions_count: 0,
      viral_potential_score: 0,
      content: 'Test learning post'
    });

    if (hasErrors) {
      console.error('\n❌ SCHEMA_VERIFY: Verification failed');
      console.error('💡 Run the migration SQL in Supabase SQL Editor');
      process.exit(1);
    } else {
      console.log('\n✅ SCHEMA_VERIFY: All checks passed');
      console.log('🎉 Database schema is ready for xBOT operations');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ SCHEMA_VERIFY: Unexpected error:', (error as Error).message);
    process.exit(1);
  }
}

async function performSmokeTest(client: any, tableName: string, testData: any): Promise<void> {
  try {
    // Insert test record
    const { error: insertError } = await client
      .from(tableName)
      .insert([testData]);
    
    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`);
    }
    
    // Delete test record
    const { error: deleteError } = await client
      .from(tableName)
      .delete()
      .eq('tweet_id', testData.tweet_id);
    
    if (deleteError) {
      throw new Error(`Delete failed: ${deleteError.message}`);
    }
    
    console.log(`✅ Smoke test passed for ${tableName}`);
    
  } catch (error) {
    console.error(`❌ Smoke test failed for ${tableName}:`, (error as Error).message);
    throw error;
  }
}

if (require.main === module) {
  verifySchema();
}
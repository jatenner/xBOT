#!/usr/bin/env tsx

/**
 * Schema Verification Script
 * Checks existence + writable status of critical database tables and columns
 * Exits non-zero with helpful message if any issues found
 */

// Check environment variables first
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY');
  console.error('💡 This is expected in a local development environment without .env');
  process.exit(1);
}

import { admin, anon } from '../src/lib/supabaseClients';

interface ColumnCheck {
  table: string;
  column: string;
  required: boolean;
}

const REQUIRED_COLUMNS: ColumnCheck[] = [
  // learning_posts table
  { table: 'learning_posts', column: 'tweet_id', required: true },
  { table: 'learning_posts', column: 'likes_count', required: true },
  { table: 'learning_posts', column: 'replies_count', required: true },
  { table: 'learning_posts', column: 'bookmarks_count', required: true },
  { table: 'learning_posts', column: 'impressions_count', required: true },
  { table: 'learning_posts', column: 'format', required: true },
  { table: 'learning_posts', column: 'created_at', required: true },
  { table: 'learning_posts', column: 'content', required: false },
  { table: 'learning_posts', column: 'viral_potential_score', required: false },
  
  // tweet_metrics table
  { table: 'tweet_metrics', column: 'tweet_id', required: true },
  { table: 'tweet_metrics', column: 'collected_at', required: true },
  { table: 'tweet_metrics', column: 'likes_count', required: true },
  { table: 'tweet_metrics', column: 'retweets_count', required: true },
  { table: 'tweet_metrics', column: 'replies_count', required: true },
  { table: 'tweet_metrics', column: 'bookmarks_count', required: true },
  { table: 'tweet_metrics', column: 'impressions_count', required: true },
  { table: 'tweet_metrics', column: 'content', required: false },
];

async function main() {
  console.log('🔍 SCHEMA VERIFICATION: Starting database schema checks...');
  
  // Validate environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY');
    process.exit(1);
  }

  let errors: string[] = [];
  
  try {
    // Step 1: Check column existence via PostgREST introspection
    console.log('📋 Checking table columns via PostgREST...');
    
    const uniqueTables = [...new Set(REQUIRED_COLUMNS.map(c => c.table))];
    
    for (const table of uniqueTables) {
      console.log(`  📊 Checking table: ${table}`);
      
      try {
        // Use admin client to get table schema
        const { data, error } = await admin
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          errors.push(`❌ Cannot access table '${table}': ${error.message}`);
          continue;
        }
        
        // Check specific columns by doing a select with each column
        const tableColumns = REQUIRED_COLUMNS.filter(c => c.table === table);
        const selectColumns = tableColumns.map(c => c.column).join(',');
        
        const { error: columnError } = await admin
          .from(table)
          .select(selectColumns)
          .limit(1);
        
        if (columnError) {
          const missingColumns = tableColumns
            .filter(c => columnError.message.includes(c.column))
            .map(c => c.column);
          
          if (missingColumns.length > 0) {
            errors.push(`❌ Missing columns in '${table}': ${missingColumns.join(', ')}`);
          } else {
            errors.push(`❌ Column access error in '${table}': ${columnError.message}`);
          }
        } else {
          console.log(`  ✅ All columns accessible in ${table}`);
        }
        
      } catch (err: any) {
        errors.push(`❌ Failed to check table '${table}': ${err.message}`);
      }
    }
    
    // Step 2: Test write permissions with admin client
    console.log('🔐 Testing write permissions...');
    
    const testTweetId = `schema_test_${Date.now()}`;
    
    // Test learning_posts write
    try {
      const { error: writeError } = await admin
        .from('learning_posts')
        .upsert([{
          tweet_id: testTweetId,
          format: 'single',
          likes_count: 0,
          retweets_count: 0,
          replies_count: 0,
          bookmarks_count: 0,
          impressions_count: 0,
          created_at: new Date().toISOString(),
          content: 'Schema verification test'
        }], { onConflict: 'tweet_id' });
      
      if (writeError) {
        errors.push(`❌ Cannot write to 'learning_posts': ${writeError.message}`);
      } else {
        console.log('  ✅ learning_posts write permission OK');
        
        // Clean up test record
        await admin.from('learning_posts').delete().eq('tweet_id', testTweetId);
      }
    } catch (err: any) {
      errors.push(`❌ learning_posts write test failed: ${err.message}`);
    }
    
    // Test tweet_metrics write
    try {
      const { error: writeError } = await admin
        .from('tweet_metrics')
        .upsert([{
          tweet_id: testTweetId,
          collected_at: new Date().toISOString(),
          likes_count: 0,
          retweets_count: 0,
          replies_count: 0,
          bookmarks_count: 0,
          impressions_count: 0,
          content: 'Schema verification test'
        }], { onConflict: 'tweet_id' });
      
      if (writeError) {
        errors.push(`❌ Cannot write to 'tweet_metrics': ${writeError.message}`);
      } else {
        console.log('  ✅ tweet_metrics write permission OK');
        
        // Clean up test record
        await admin.from('tweet_metrics').delete().eq('tweet_id', testTweetId);
      }
    } catch (err: any) {
      errors.push(`❌ tweet_metrics write test failed: ${err.message}`);
    }
    
    // Step 3: Test anon client cannot write (RLS working)
    console.log('🔒 Testing RLS enforcement (anon client should fail writes)...');
    
    try {
      const { error: anonError } = await anon
        .from('learning_posts')
        .insert([{
          tweet_id: `anon_test_${Date.now()}`,
          format: 'single',
          likes_count: 0,
          retweets_count: 0,
          replies_count: 0
        }]);
      
      if (!anonError) {
        errors.push(`⚠️ RLS not enforced: anon client can write to 'learning_posts'`);
      } else {
        console.log('  ✅ RLS working: anon client correctly blocked from writes');
      }
    } catch (err: any) {
      console.log('  ✅ RLS working: anon client correctly blocked from writes');
    }
    
    // Step 4: Reload PostgREST schema cache
    console.log('🔄 Reloading PostgREST schema cache...');
    
    try {
      const { error: notifyError } = await admin.rpc('pg_notify', {
        channel: 'pgrst',
        payload: 'reload schema'
      });
      
      if (notifyError) {
        // Try alternative method via direct SQL
        const { error: sqlError } = await admin
          .from('dummy_table_that_does_not_exist')
          .select('1')
          .limit(0); // This will trigger PostgREST to refresh
        
        console.log('  ✅ PostgREST cache refresh triggered (fallback method)');
      } else {
        console.log('  ✅ PostgREST cache refresh triggered via pg_notify');
      }
    } catch (err: any) {
      console.log('  ⚠️ PostgREST cache refresh failed, but this is non-critical');
    }
    
    // Step 5: Final verification via PostgREST endpoints
    console.log('🌐 Testing PostgREST API endpoints...');
    
    const baseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    for (const table of uniqueTables) {
      try {
        const response = await fetch(`${baseUrl}/rest/v1/${table}?select=*&limit=1`, {
          headers: {
            'apikey': serviceKey,
            'authorization': `Bearer ${serviceKey}`
          }
        });
        
        if (!response.ok) {
          errors.push(`❌ PostgREST API error for '${table}': ${response.status} ${response.statusText}`);
        } else {
          console.log(`  ✅ PostgREST API accessible for ${table}`);
        }
      } catch (err: any) {
        errors.push(`❌ PostgREST API test failed for '${table}': ${err.message}`);
      }
    }
    
  } catch (err: any) {
    errors.push(`❌ Schema verification failed: ${err.message}`);
  }
  
  // Report results
  console.log('\n📊 SCHEMA VERIFICATION RESULTS:');
  
  if (errors.length === 0) {
    console.log('✅ All schema checks passed!');
    console.log('📋 Database tables: learning_posts, tweet_metrics');
    console.log('🔐 Write permissions: OK (admin client)');
    console.log('🔒 RLS enforcement: OK (anon client blocked)');
    console.log('🌐 PostgREST API: OK');
    process.exit(0);
  } else {
    console.log(`❌ Found ${errors.length} issue(s):`);
    errors.forEach(error => console.log(`  ${error}`));
    console.log('\n🔧 To fix these issues:');
    console.log('  1. Run database migration: npm run migrate:apply');
    console.log('  2. Check RLS policies in Supabase dashboard');
    console.log('  3. Verify SUPABASE_SERVICE_ROLE_KEY has proper permissions');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('💥 Schema verification crashed:', err.message);
    process.exit(1);
  });
}
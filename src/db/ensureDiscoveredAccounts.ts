/**
 * 🛠️ Database Table Initialization
 * Ensures discovered_accounts table exists before reply system runs
 * 
 * This runs automatically on startup to handle cases where migrations
 * haven't been applied yet.
 */

import { getSupabaseClient } from './index';

export async function ensureDiscoveredAccountsTable(): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  console.log('[DB_INIT] 🔍 Checking discovered_accounts table...');
  
  try {
    // Quick check: try to query the table
    const { error: checkError } = await supabase
      .from('discovered_accounts')
      .select('id')
      .limit(1);
    
    if (!checkError) {
      console.log('[DB_INIT] ✅ discovered_accounts table exists');
      return true;
    }
    
    // Table doesn't exist, create it
    if (checkError.message.includes('does not exist') || 
        checkError.message.includes('Could not find')) {
      
      console.log('[DB_INIT] ⚠️ Table not found, creating now...');
      
      const createTableSQL = `
        -- Create discovered_accounts table
        CREATE TABLE IF NOT EXISTS discovered_accounts (
          id BIGSERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          follower_count INTEGER DEFAULT 0,
          following_count INTEGER DEFAULT 0,
          tweet_count INTEGER DEFAULT 0,
          bio TEXT,
          verified BOOLEAN DEFAULT false,
          discovery_method TEXT CHECK (discovery_method IN ('hashtag', 'network', 'content', 'follower_overlap')),
          discovery_date TIMESTAMP DEFAULT NOW(),
          
          quality_score INTEGER DEFAULT 0,
          engagement_score INTEGER DEFAULT 0,
          content_score INTEGER DEFAULT 0,
          audience_relevance INTEGER DEFAULT 0,
          growth_score INTEGER DEFAULT 0,
          final_score INTEGER DEFAULT 0,
          
          last_scored TIMESTAMP,
          last_updated TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_discovered_accounts_final_score 
        ON discovered_accounts(final_score DESC);

        CREATE INDEX IF NOT EXISTS idx_discovered_accounts_username 
        ON discovered_accounts(username);

        CREATE INDEX IF NOT EXISTS idx_discovered_accounts_last_updated
        ON discovered_accounts(last_updated);

        -- Create reply_learning_insights table
        CREATE TABLE IF NOT EXISTS reply_learning_insights (
          id BIGSERIAL PRIMARY KEY,
          insight_type TEXT CHECK (insight_type IN ('generator', 'timing', 'target', 'topic')),
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          confidence DECIMAL(3,2) DEFAULT 0.0,
          sample_size INTEGER DEFAULT 0,
          discovered_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(insight_type, key)
        );

        CREATE INDEX IF NOT EXISTS idx_reply_insights_type 
        ON reply_learning_insights(insight_type);

        CREATE INDEX IF NOT EXISTS idx_reply_insights_confidence 
        ON reply_learning_insights(confidence DESC);
      `;
      
      // Execute via raw SQL using Supabase's RPC function
      // Note: This assumes you have a function to execute raw SQL, or we use Supabase's admin API
      
      // ALTERNATIVE: Use Supabase REST API to execute SQL
      const { error: createError } = await supabase.rpc('exec_sql', { 
        sql: createTableSQL 
      }).single();
      
      if (createError) {
        console.error('[DB_INIT] ❌ Failed to create table via RPC:', createError.message);
        console.error('[DB_INIT] 💡 MANUAL ACTION REQUIRED:');
        console.error('[DB_INIT]    1. Go to Supabase Dashboard → SQL Editor');
        console.error('[DB_INIT]    2. Run: supabase/migrations/20251018_ai_driven_reply_system.sql');
        console.error('[DB_INIT]    OR copy/paste ensure_discovered_accounts_table.sql');
        return false;
      }
      
      console.log('[DB_INIT] ✅ discovered_accounts table created successfully!');
      return true;
      
    } else {
      // Some other error
      console.error('[DB_INIT] ❌ Unexpected error:', checkError.message);
      return false;
    }
    
  } catch (error: any) {
    console.error('[DB_INIT] ❌ Error checking table:', error.message);
    return false;
  }
}

/**
 * Wrapper that handles the table check gracefully
 */
export async function ensureTableOrSkip(context: string): Promise<boolean> {
  try {
    const exists = await ensureDiscoveredAccountsTable();
    
    if (!exists) {
      console.log(`[${context}] ⚠️ discovered_accounts table not available, skipping ${context}`);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.error(`[${context}] ❌ Table check failed:`, error.message);
    return false;
  }
}


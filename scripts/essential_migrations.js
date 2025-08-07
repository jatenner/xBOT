#!/usr/bin/env node

/**
 * 🗄️ ESSENTIAL MIGRATIONS ONLY
 * Runs only critical migrations to prevent startup delays
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('⚠️ No Supabase credentials, skipping migrations...');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const essentialTables = [
  {
    name: 'tweets',
    sql: `
      CREATE TABLE IF NOT EXISTS tweets (
        id SERIAL PRIMARY KEY,
        tweet_id VARCHAR(255) UNIQUE,
        content TEXT,
        author VARCHAR(255),
        posted_at TIMESTAMP DEFAULT NOW(),
        likes INTEGER DEFAULT 0,
        retweets INTEGER DEFAULT 0,
        replies INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `
  },
  {
    name: 'tweet_analytics',
    sql: `
      CREATE TABLE IF NOT EXISTS tweet_analytics (
        id SERIAL PRIMARY KEY,
        tweet_id VARCHAR(255),
        likes INTEGER DEFAULT 0,
        retweets INTEGER DEFAULT 0,
        replies INTEGER DEFAULT 0,
        quotes INTEGER DEFAULT 0,
        bookmarks INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        engagement_rate NUMERIC(12,4) DEFAULT 0,
        collected_at TIMESTAMP DEFAULT NOW()
      );
    `
  },
  {
    name: 'bot_config',
    sql: `
      CREATE TABLE IF NOT EXISTS bot_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(255) UNIQUE,
        config_value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `
  }
];

async function runEssentialMigrations() {
  console.log('🗄️ Running essential migrations...');
  
  for (const table of essentialTables) {
    try {
      console.log(`📋 Creating table: ${table.name}`);
      
      const { error } = await supabase.rpc('execute_sql', {
        sql: table.sql
      });
      
      if (error && !error.message.includes('already exists')) {
        console.error(`❌ Failed to create ${table.name}:`, error.message);
      } else {
        console.log(`✅ Table ${table.name} ready`);
      }
    } catch (error) {
      console.log(`⚠️ Migration warning for ${table.name}:`, error.message);
    }
  }
  
  console.log('✅ Essential migrations completed');
}

// Timeout the migration process
const migrationTimeout = setTimeout(() => {
  console.log('⚠️ Migration timeout, continuing anyway...');
  process.exit(0);
}, 30000); // 30 seconds max

runEssentialMigrations()
  .then(() => {
    clearTimeout(migrationTimeout);
    process.exit(0);
  })
  .catch((error) => {
    clearTimeout(migrationTimeout);
    console.error('❌ Essential migrations failed:', error);
    process.exit(0); // Continue anyway
  });
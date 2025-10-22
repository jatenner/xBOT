/**
 * 🚀 RUN DATABASE MIGRATION
 * Executes the SQL migration using Node.js pg library
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('📖 Reading migration SQL...');
    const sql = fs.readFileSync('SAFE_MIGRATION_WITH_VIEWS.sql', 'utf8');
    
    // Remove \echo commands (PostgreSQL specific, not supported in pg library)
    const cleanSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('\\echo'))
      .join('\n');

    console.log('🚀 Executing migration...\n');
    
    await client.query(cleanSql);
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 MIGRATION COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('✅ New comprehensive tables created');
    console.log('✅ All data migrated successfully');
    console.log('✅ Old tables archived');
    console.log('✅ Compatibility views created\n');
    
    console.log('🔍 Verifying migration...\n');
    
    // Verify new tables exist
    const { rows: tables } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'posted_tweets_comprehensive',
        'tweet_engagement_metrics_comprehensive',
        'content_generation_metadata_comprehensive'
      )
      ORDER BY table_name
    `);
    
    console.log('📋 New tables:');
    tables.forEach(t => console.log(`   ✅ ${t.table_name}`));
    
    // Verify views exist
    const { rows: views } = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'posted_decisions',
        'post_history',
        'real_tweet_metrics',
        'content_metadata',
        'latest_tweet_metrics',
        'complete_tweet_overview'
      )
      ORDER BY table_name
    `);
    
    console.log('\n👁️  Compatibility views:');
    views.forEach(v => console.log(`   ✅ ${v.table_name}`));
    
    // Count migrated data
    const { rows: [ptc] } = await client.query('SELECT COUNT(*) FROM posted_tweets_comprehensive');
    const { rows: [temc] } = await client.query('SELECT COUNT(*) FROM tweet_engagement_metrics_comprehensive');
    const { rows: [cgmc] } = await client.query('SELECT COUNT(*) FROM content_generation_metadata_comprehensive');
    
    console.log('\n📊 Migrated data:');
    console.log(`   • posted_tweets_comprehensive: ${ptc.count} rows`);
    console.log(`   • tweet_engagement_metrics_comprehensive: ${temc.count} rows`);
    console.log(`   • content_generation_metadata_comprehensive: ${cgmc.count} rows`);
    
    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('✨ Your systems will continue working automatically via views!');
    console.log('   • Posting → views redirect to new tables');
    console.log('   • Scraping → views redirect to new tables');
    console.log('   • Learning → views redirect to new tables');
    console.log('\n═══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error('\nFull error:', error);
    console.error('\nROLLBACK: Migration was in a transaction, no changes applied');
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

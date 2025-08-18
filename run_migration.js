const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🗄️ Running SQL migration for tweet_metrics and learning_posts schema...');
  
  // Read the migration file
  const migrationPath = path.join(__dirname, 'migrations', '0001_metrics_learning_schema.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }
  
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('📋 Migration SQL to execute:');
  console.log('=' * 50);
  console.log(migrationSQL);
  console.log('=' * 50);
  
  console.log('\n✅ NEXT STEPS:');
  console.log('1. Copy the SQL above');
  console.log('2. Go to your Supabase project dashboard');
  console.log('3. Navigate to SQL Editor');
  console.log('4. Paste and run the SQL');
  console.log('5. Verify no errors in the output');
  
  console.log('\n🔍 After running, verify with this query:');
  console.log(`
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('tweet_metrics', 'learning_posts')
ORDER BY table_name, ordinal_position;
  `);
  
  console.log('\n✅ Expected tables and columns:');
  console.log('tweet_metrics: tweet_id, collected_at, likes_count, retweets_count, replies_count, bookmarks_count, impressions_count, content');
  console.log('learning_posts: tweet_id, created_at, format, likes_count, retweets_count, replies_count, bookmarks_count, impressions_count, viral_potential_score, content');
}

runMigration().catch(console.error);

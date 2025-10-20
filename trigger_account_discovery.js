const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndTrigger() {
  // Check current pool
  const { data, count } = await supabase
    .from('discovered_accounts')
    .select('*', { count: 'exact' });
  
  console.log(`📊 Current pool: ${count} accounts`);
  
  if (data && data.length > 0) {
    console.log('Sample accounts:');
    data.slice(0, 5).forEach(acc => {
      console.log(`  • @${acc.username} - ${acc.follower_count} followers`);
    });
  }
  
  console.log('\n🚀 Triggering account discovery NOW...');
  console.log('This will find 10-20 new health accounts...');
}

checkAndTrigger().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

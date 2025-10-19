/**
 * Check outcomes table structure and data
 */

import { getSupabaseClient } from '../src/db/index';

async function checkOutcomesTable() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Checking outcomes table...\n');
  
  // Try different column names
  const attempts = [
    { name: 'Standard columns', query: supabase.from('outcomes').select('*').limit(5) },
    { name: 'Count only', query: supabase.from('outcomes').select('*', { count: 'exact', head: true }) }
  ];
  
  for (const attempt of attempts) {
    console.log(`Trying: ${attempt.name}`);
    const result = await attempt.query;
    
    if (result.error) {
      console.log(`❌ Error: ${result.error.message}`);
    } else {
      console.log(`✅ Success! Count: ${result.count || (result.data?.length || 0)}`);
      if (result.data) {
        console.log('Sample data:', JSON.stringify(result.data[0], null, 2));
      }
    }
    console.log('');
  }
  
  // Check posted_decisions table (might be the real source)
  console.log('Checking posted_decisions table...');
  const { data: posted, error: postedError, count } = await supabase
    .from('posted_decisions')
    .select('*', { count: 'exact' })
    .limit(5);
  
  if (postedError) {
    console.log(`❌ Error: ${postedError.message}`);
  } else {
    console.log(`✅ Found ${count} posted_decisions`);
    if (posted && posted.length > 0) {
      console.log('Sample:', JSON.stringify(posted[0], null, 2));
    }
  }
}

checkOutcomesTable().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});


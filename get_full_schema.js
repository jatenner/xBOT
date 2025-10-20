const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getSchema() {
  // Get discovered_accounts schema
  const { data: accounts } = await supabase
    .from('discovered_accounts')
    .select('*')
    .limit(1);
  
  console.log('discovered_accounts columns:', accounts ? Object.keys(accounts[0] || {}) : 'EMPTY');
  
  // Get outcomes schema
  const { data: outcomes } = await supabase
    .from('outcomes')
    .select('*')
    .limit(1);
  
  console.log('outcomes columns:', outcomes ? Object.keys(outcomes[0] || {}) : 'EMPTY');
}

getSchema().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

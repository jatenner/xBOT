const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE credentials');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, status, posted_at')
    .eq('decision_type', 'reply')
    .order('posted_at', { ascending: false })
    .limit(5);
  if (error) {
    console.error('Supabase error:', error);
  }
  console.log('Last replies:', data);
}

main().then(() => process.exit(0));

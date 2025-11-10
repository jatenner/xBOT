import { getSupabaseClient } from './src/db/index';

async function testDashboardData() {
  const supabase = getSupabaseClient();
  
  console.log('Testing dashboard data connections...\n');
  
  // Test 1: Queued items
  const { data: queued, error: queueError } = await supabase
    .from('content_metadata')
    .select('decision_type, status, scheduled_at')
    .eq('status', 'queued')
    .limit(5);
  
  console.log('1. QUEUED ITEMS:', queued?.length || 0);
  if (queueError) console.error('   Error:', queueError.message);
  
  // Test 2: Recent posts
  const lastHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: posts, error: postsError } = await supabase
    .from('content_metadata')
    .select('decision_type, posted_at')
    .eq('status', 'posted')
    .gte('posted_at', lastHour);
  
  console.log('2. POSTS LAST HOUR:', posts?.length || 0);
  if (postsError) console.error('   Error:', postsError.message);
  
  // Test 3: Reply opportunities
  const { data: opps, error: oppsError } = await supabase
    .from('reply_opportunities')
    .select('tier')
    .eq('replied_to', false)
    .limit(5);
  
  console.log('3. AVAILABLE OPPORTUNITIES:', opps?.length || 0);
  if (oppsError) console.error('   Error:', oppsError.message);
  
  // Test 4: Recent errors
  const { data: errors, error: errorsError } = await supabase
    .from('content_metadata')
    .select('error_message, updated_at')
    .eq('status', 'failed')
    .gte('updated_at', lastHour);
  
  console.log('4. ERRORS LAST HOUR:', errors?.length || 0);
  if (errorsError) console.error('   Error:', errorsError.message);
  
  // Test 5: Job status check
  const { data: lastJob } = await supabase
    .from('content_metadata')
    .select('created_at, decision_type')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (lastJob) {
    const minutesAgo = Math.round((Date.now() - new Date(lastJob.created_at).getTime()) / (1000 * 60));
    console.log('5. LAST CONTENT GENERATED:', minutesAgo, 'minutes ago');
  } else {
    console.log('5. LAST CONTENT GENERATED: Never');
  }
}

testDashboardData().then(() => process.exit(0)).catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});

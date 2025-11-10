const { createClient } = require('@supabase/supabase-js');

(async () => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log('🧹 Cleaning reply opportunities that already have posted replies...');

  const { data: repliedRows, error: repliedError } = await supabase
    .from('content_metadata')
    .select('target_tweet_id')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('target_tweet_id', 'is', null);

  if (repliedError) {
    console.error('❌ Failed to fetch replied tweet IDs:', repliedError.message);
    process.exit(1);
  }

  const repliedIds = (repliedRows || [])
    .map((row: any) => String(row.target_tweet_id || '').trim())
    .filter((id: string) => id.length > 0);

  if (repliedIds.length === 0) {
    console.log('✅ Nothing to clean (no replied tweet IDs found)');
    process.exit(0);
  }

  const chunkSize = 200;
  let deleted = 0;

  for (let i = 0; i < repliedIds.length; i += chunkSize) {
    const chunk = repliedIds.slice(i, i + chunkSize);
    const { error: deleteError } = await supabase
      .from('reply_opportunities')
      .delete()
      .in('target_tweet_id', chunk);

    if (deleteError) {
      console.error('❌ Failed to delete chunk:', deleteError.message);
      process.exit(1);
    }

    deleted += chunk.length;
  }

  console.log(`✅ Cleaned ${deleted} reply opportunities`);
  process.exit(0);
})();

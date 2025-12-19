import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check for ANY receipts in last 2 hours
  const { data, count } = await supabase
    .from('post_receipts')
    .select('*', { count: 'exact' })
    .gte('posted_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false })
    .limit(10);

  console.log(`\n🔍 RECEIPT TRUTH CHECK\n`);
  console.log(`Receipts in last 2 hours: ${count || 0}`);
  
  if (data && data.length > 0) {
    console.log('\nLast 5 receipts:');
    data.slice(0, 5).forEach((r, i) => {
      const ago = Math.round((Date.now() - new Date(r.posted_at).getTime()) / 60000);
      console.log(`  ${i+1}. ${r.post_type} - ${ago}m ago - tweet: ${r.root_tweet_id}`);
    });
  } else {
    console.log('\n🚨 NO RECEIPTS FOUND');
    console.log('This means:');
    console.log('  1. New code is NOT deployed to Railway yet, OR');
    console.log('  2. Receipt writer is failing silently');
    console.log('\nTo verify deployment:');
    console.log('  railway logs --service xBOT --lines 100 | grep "\\[STARTUP\\]"');
  }
}

main();


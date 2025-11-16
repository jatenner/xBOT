/* eslint-disable no-console */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function getEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} is required in environment`);
  return val;
}

async function main() {
  const decisionId = process.argv[2];
  if (!decisionId) {
    console.error('Usage: tsx scripts/get-tweet-link.ts <decision_id>');
    process.exit(1);
  }

  const supabase = createClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, thread_tweet_ids, posted_at, content, generator_name')
    .eq('decision_id', decisionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('ERROR_QUERY', error.message);
    process.exit(1);
  }

  if (!data) {
    console.error('NOT_FOUND');
    process.exit(1);
  }

  const tweetId: string | null = data.tweet_id as any || null;
  const threadIds: string[] | null = (data.thread_tweet_ids as any) || null;

  const idToUse = tweetId || (Array.isArray(threadIds) && threadIds.length > 0 ? threadIds[0] : null);

  const link = idToUse ? `https://x.com/i/status/${idToUse}` : null;

  console.log(
    JSON.stringify(
      {
        decision_id: data.decision_id,
        generator_name: data.generator_name,
        posted_at: data.posted_at,
        tweet_id: tweetId,
        thread_tweet_ids: threadIds,
        link,
        preview:
          Array.isArray(data.content)
            ? data.content.join(' | ').slice(0, 200)
            : String(data.content || '').slice(0, 200),
      },
      null,
      0
    )
  );
}

main().catch((e) => {
  console.error('ERROR_RUNTIME', e?.message || String(e));
  process.exit(1);
});



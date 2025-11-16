/* eslint-disable no-console */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function main() {
  const supabase = createClient(req('SUPABASE_URL'), req('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  // Buckets based on posted_at (tweet time) and scraped_at (ingest time)
  async function countAll() {
    const { count, error } = await supabase
      .from('health_news_scraped')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
  }
  async function countGte(column: 'posted_at' | 'scraped_at', hours: number) {
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const { count, error } = await supabase
      .from('health_news_scraped')
      .select('id', { count: 'exact', head: true })
      .gte(column, since);
    if (error) throw error;
    return count ?? 0;
  }

  const res: Record<string, number> = {};
  res.total = await countAll();
  res.last_24h_posted = await countGte('posted_at', 24);
  res.last_3d_posted = await countGte('posted_at', 72);
  res.last_7d_posted = await countGte('posted_at', 168);
  res.last_30d_posted = await countGte('posted_at', 720);
  res.last_24h_scraped = await countGte('scraped_at', 24);
  res.last_3d_scraped = await countGte('scraped_at', 72);
  res.last_7d_scraped = await countGte('scraped_at', 168);

  console.log(JSON.stringify(res));
}

main().catch((e) => {
  console.error('ERROR_RUNTIME', e?.message || String(e));
  process.exit(1);
});



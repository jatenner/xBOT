/* eslint-disable no-console */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function countTable(supabase: any, table: string) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
  } catch (e: any) {
    return { error: e.message as string };
  }
}

async function main() {
  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  const tables = [
    'health_news_scraped',
    'health_news_curated',
    'health_news_trending',
  ];

  const results: Record<string, any> = {};
  for (const t of tables) {
    results[t] = await countTable(supabase, t);
  }

  console.log(JSON.stringify(results));
}

main().catch((e) => {
  console.error('ERROR_RUNTIME', e?.message || String(e));
  process.exit(1);
});



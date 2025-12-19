import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('[DB_DOCTOR] Running health check...');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('[DB_DOCTOR] FAIL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  console.log(`[DB_DOCTOR] Target: ${projectRef}.supabase.co`);

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const required = ['content_metadata', 'system_events', 'post_receipts'];
  const found: string[] = [];
  const missing: string[] = [];

  for (const table of required) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error && error.message.includes('does not exist')) {
        missing.push(table);
      } else {
        found.push(table);
      }
    } catch {
      missing.push(table);
    }
  }

  console.log(`[DB_DOCTOR] Found: ${found.join(', ')}`);
  if (missing.length > 0) {
    console.log(`[DB_DOCTOR] Missing: ${missing.join(', ')}`);
    console.log('[DB_DOCTOR] FAIL - Run: pnpm db:migrate');
    process.exit(1);
  }

  console.log('[DB_DOCTOR] PASS');
  process.exit(0);
}

main();

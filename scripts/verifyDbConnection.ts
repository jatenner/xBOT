import 'dotenv/config';
import { Client } from 'pg';

async function verify() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[DB_VERIFY] ❌ Missing DATABASE_URL');
    process.exit(1);
  }

  const url = new URL(DATABASE_URL);
  console.log(`[DB_VERIFY] Target: host=${url.hostname} dbname=${url.pathname.substring(1)}`);

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[DB_VERIFY] ✅ Connection successful');

    // Column checks
    const columnChecks = [
      ['content_metadata', 'decision_id'],
      ['content_metadata', 'tweet_id'],
      ['content_metadata', 'thread_tweet_ids'],
      ['system_events', 'component'],
      ['system_events', 'message'],
      ['post_receipts', 'receipt_id'],
      ['post_receipts', 'tweet_ids'],
      ['post_receipts', 'post_type'],
      ['post_receipts', 'parent_tweet_id'],
      ['post_receipts', 'root_tweet_id'],
    ];

    let allPass = true;
    
    console.log('\n[DB_VERIFY] 📋 Checking required columns...\n');
    for (const [table, column] of columnChecks) {
      const res = await client.query(
        `SELECT COUNT(*) as exists FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2;`,
        [table, column]
      );
      const exists = parseInt(res.rows[0].exists) > 0;
      if (exists) {
        console.log(`[DB_VERIFY] ✅ ${table}.${column}`);
      } else {
        console.log(`[DB_VERIFY] ❌ ${table}.${column} MISSING`);
        allPass = false;
      }
    }

    // Function checks (advisory locks)
    console.log('\n[DB_VERIFY] 🔒 Checking advisory lock functions...\n');
    const functionChecks = [
      'pg_try_advisory_lock',
      'pg_advisory_unlock'
    ];

    for (const funcName of functionChecks) {
      const res = await client.query(
        `SELECT COUNT(*) as exists FROM pg_proc 
         WHERE proname = $1 AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');`,
        [funcName]
      );
      const exists = parseInt(res.rows[0].exists) > 0;
      if (exists) {
        console.log(`[DB_VERIFY] ✅ FUNCTION ${funcName}()`);
      } else {
        console.log(`[DB_VERIFY] ❌ FUNCTION ${funcName}() MISSING`);
        allPass = false;
      }
    }

    await client.end();

    if (allPass) {
      console.log('\n[DB_VERIFY] ✅ PASS - All required schema elements present\n');
      process.exit(0);
    } else {
      console.log('\n[DB_VERIFY] ❌ FAIL - Some schema elements missing');
      console.log('[DB_VERIFY] Run: pnpm db:migrate to apply migrations\n');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('[DB_VERIFY] ❌ Error:', err.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

verify();


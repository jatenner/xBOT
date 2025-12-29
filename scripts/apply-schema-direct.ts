import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

async function applySchema() {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[SCHEMA] Connected to database');

    const commands = [
      {
        sql: 'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS engagement_tier TEXT',
        desc: 'Add engagement_tier column'
      },
      {
        sql: 'CREATE INDEX IF NOT EXISTS idx_reply_opp_engagement_tier ON reply_opportunities(engagement_tier)',
        desc: 'Create engagement_tier index'
      },
      {
        sql: 'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS timing_window TEXT',
        desc: 'Add timing_window column'
      },
      {
        sql: 'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS account_size_tier TEXT',
        desc: 'Add account_size_tier column'
      },
      {
        sql: 'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS opportunity_score_v2 NUMERIC(10,2) DEFAULT 0',
        desc: 'Add opportunity_score_v2 column'
      },
      {
        sql: 'CREATE INDEX IF NOT EXISTS idx_reply_opp_score_v2 ON reply_opportunities(opportunity_score_v2 DESC)',
        desc: 'Create opportunity_score_v2 index'
      }
    ];

    for (const cmd of commands) {
      try {
        await client.query(cmd.sql);
        console.log(`[SCHEMA] ✅ ${cmd.desc}`);
      } catch (error: any) {
        if (error.code === '42701') {
          // Column already exists
          console.log(`[SCHEMA] ℹ️  ${cmd.desc} (already exists)`);
        } else if (error.code === '42P07') {
          // Index already exists
          console.log(`[SCHEMA] ℹ️  ${cmd.desc} (already exists)`);
        } else {
          console.error(`[SCHEMA] ❌ ${cmd.desc}:`, error.message);
        }
      }
    }

    // Verify
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'reply_opportunities' 
      AND column_name IN ('engagement_tier', 'timing_window', 'account_size_tier', 'opportunity_score_v2')
    `);

    console.log(`[SCHEMA] ✅ Verified ${result.rows.length}/4 columns exist`);
    result.rows.forEach((row) => {
      console.log(`[SCHEMA]   - ${row.column_name}`);
    });

  } catch (error) {
    console.error('[SCHEMA] Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }

  console.log('[SCHEMA] ✅ Schema migration complete');
  process.exit(0);
}

applySchema();


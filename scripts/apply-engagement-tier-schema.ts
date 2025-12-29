import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applySchema() {
  console.log('[SCHEMA] Applying engagement tier schema...');

  const sql = `
    -- Add engagement_tier column to reply_opportunities
    ALTER TABLE reply_opportunities 
    ADD COLUMN IF NOT EXISTS engagement_tier TEXT;

    -- Add index for performance
    CREATE INDEX IF NOT EXISTS idx_reply_opp_engagement_tier 
    ON reply_opportunities(engagement_tier);

    -- Add timing_window column for future timing analysis
    ALTER TABLE reply_opportunities 
    ADD COLUMN IF NOT EXISTS timing_window TEXT;

    -- Add account_size_tier column for future account analysis
    ALTER TABLE reply_opportunities 
    ADD COLUMN IF NOT EXISTS account_size_tier TEXT;

    -- Add opportunity_score_v2 for multi-dimensional scoring
    ALTER TABLE reply_opportunities 
    ADD COLUMN IF NOT EXISTS opportunity_score_v2 NUMERIC(10,2) DEFAULT 0;

    -- Create index for scoring
    CREATE INDEX IF NOT EXISTS idx_reply_opp_score_v2 
    ON reply_opportunities(opportunity_score_v2 DESC);
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql } as any);

  if (error) {
    console.error('[SCHEMA] Error:', error);
    
    // Try direct ALTER TABLE approach
    console.log('[SCHEMA] Trying direct approach...');
    
    const alterCommands = [
      'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS engagement_tier TEXT',
      'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS timing_window TEXT',
      'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS account_size_tier TEXT',
      'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS opportunity_score_v2 NUMERIC(10,2) DEFAULT 0'
    ];

    for (const cmd of alterCommands) {
      const { error: alterError } = await supabase.rpc('exec_sql', { sql_query: cmd } as any);
      if (alterError) {
        console.log(`[SCHEMA] ${cmd}: ${alterError.message}`);
      } else {
        console.log(`[SCHEMA] ✅ ${cmd}`);
      }
    }
  } else {
    console.log('[SCHEMA] ✅ All schema changes applied successfully');
  }

  // Verify columns exist
  const { data, error: queryError } = await supabase
    .from('reply_opportunities')
    .select('engagement_tier, timing_window, account_size_tier, opportunity_score_v2')
    .limit(1);

  if (queryError) {
    console.error('[SCHEMA] Verification failed:', queryError);
  } else {
    console.log('[SCHEMA] ✅ Columns verified - schema is ready');
  }

  process.exit(0);
}

applySchema();


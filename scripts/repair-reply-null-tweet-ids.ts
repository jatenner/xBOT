/**
 * Repair Script: Fix Reply Rows with status='posted' but tweet_id=NULL
 * 
 * Finds old bad rows and marks them as failed with reason.
 * This is a ONE-TIME cleanup script.
 * 
 * Usage:
 *   pnpm repair:reply-null-ids [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('🔧 REPLY NULL TWEET_ID REPAIR SCRIPT\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will update DB)'}\n`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Find reply rows with status='posted' but tweet_id is null
  const { data: badRows, error } = await supabase
    .from('content_metadata')
    .select('decision_id, created_at, posted_at, updated_at, target_tweet_id, target_username, content')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .or('tweet_id.is.null,tweet_id.eq.');
  
  if (error) {
    console.error(`❌ Error querying bad rows: ${error.message}`);
    process.exit(1);
  }
  
  if (!badRows || badRows.length === 0) {
    console.log('✅ No bad rows found (all posted replies have tweet_id)\n');
    process.exit(0);
  }
  
  console.log(`Found ${badRows.length} bad rows:\n`);
  
  // Show details
  for (let i = 0; i < Math.min(badRows.length, 20); i++) {
    const row = badRows[i];
    const createdAgo = Math.round((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60));
    const parent = row.target_tweet_id || 'NULL';
    const username = row.target_username || 'NULL';
    
    console.log(`${i+1}. ${row.decision_id.substring(0, 8)}... (created ${createdAgo}h ago)`);
    console.log(`   Target: @${username} (${parent})`);
    console.log(`   Content: "${row.content.substring(0, 80)}..."`);
    console.log('');
  }
  
  if (badRows.length > 20) {
    console.log(`... and ${badRows.length - 20} more\n`);
  }
  
  // Repair action
  if (DRY_RUN) {
    console.log('🔍 DRY RUN: Would mark these rows as failed\n');
    console.log('Run without --dry-run to apply changes\n');
  } else {
    console.log(`🔧 Repairing ${badRows.length} rows...\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const row of badRows) {
      try {
        const { error: updateError } = await supabase
          .from('content_metadata')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('decision_id', row.decision_id);
        
        if (updateError) {
          console.error(`   ❌ Failed to update ${row.decision_id.substring(0, 8)}: ${updateError.message}`);
          failCount++;
        } else {
          successCount++;
        }
      } catch (err: any) {
        console.error(`   ❌ Exception updating ${row.decision_id.substring(0, 8)}: ${err.message}`);
        failCount++;
      }
    }
    
    console.log(`\n✅ Repair complete:`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log(`\nThese rows are now marked as 'failed' and will not appear as posted replies.\n`);
  }
  
  // Verification query
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('📊 VERIFICATION QUERY (run in Supabase SQL editor):\n');
  console.log(`SELECT decision_id, created_at, status, tweet_id
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND (tweet_id IS NULL OR tweet_id = '')
ORDER BY created_at DESC
LIMIT 50;`);
  console.log('\nExpected result after repair: 0 rows\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


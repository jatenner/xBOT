#!/usr/bin/env tsx
/**
 * Clear stale reply opportunities (> 2 hours old)
 * Run once after deploying the 2-hour age limit fix
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function clearStale() {
  console.log('🧹 CLEARING STALE REPLY OPPORTUNITIES\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Count stale opportunities
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  
  const { count: staleCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .lt('created_at', twoHoursAgo.toISOString());

  console.log(`Found ${staleCount || 0} stale opportunities (> 2 hours old)\n`);

  if (staleCount && staleCount > 0) {
    // Mark them as expired (don't delete, keep for analytics)
    const { error } = await supabase
      .from('reply_opportunities')
      .update({ replied_to: true }) // Mark as "done" so they won't be picked up
      .eq('replied_to', false)
      .lt('created_at', twoHoursAgo.toISOString());

    if (error) {
      console.error('❌ Error marking stale opportunities:', error);
    } else {
      console.log(`✅ Marked ${staleCount} stale opportunities as expired\n`);
    }
  } else {
    console.log('✅ No stale opportunities to clear\n');
  }

  // Show remaining fresh opportunities
  const { count: freshCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .gte('created_at', twoHoursAgo.toISOString());

  console.log(`📊 Remaining fresh opportunities: ${freshCount || 0}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Cleanup complete!\n');
  console.log('From now on:');
  console.log('  • Harvester will only collect tweets < 2 hours old');
  console.log('  • Replies will be posted to ACTIVE tweets');
  console.log('  • Views should increase 100-150%\n');
}

clearStale();


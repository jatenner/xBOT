#!/usr/bin/env node
/**
 * PHASE 4.3: Clean Invalid Tweet IDs
 * Marks old verified_ and timestamp IDs as unscrappable
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanInvalidTweetIds() {
  console.log('🧹 PHASE 4.3: Cleaning invalid tweet IDs from database...\n');
  
  try {
    // Step 1: Find all posted decisions with invalid IDs
    console.log('📊 Step 1: Finding invalid tweet IDs...');
    const { data: postedDecisions, error: fetchError } = await supabase
      .from('posted_decisions')
      .select('decision_id, tweet_id, posted_at')
      .order('posted_at', { ascending: false })
      .limit(1000);
    
    if (fetchError) {
      console.error('❌ Error fetching decisions:', fetchError.message);
      return;
    }
    
    console.log(`   Found ${postedDecisions.length} total posted decisions`);
    
    // Identify invalid IDs
    const invalidIds = postedDecisions.filter(d => {
      const id = String(d.tweet_id);
      // Valid Twitter IDs are 19 digits, e.g., 1979483452962746502
      // Invalid: "verified_123456", "optimistic_123456", 13-digit timestamps
      return (
        id.startsWith('verified_') ||
        id.startsWith('optimistic_') ||
        id.startsWith('posted_') ||
        id.startsWith('FALLBACK_') ||
        id.length < 19  // Twitter IDs are 19 digits
      );
    });
    
    console.log(`   ⚠️ Found ${invalidIds.length} invalid tweet IDs\n`);
    
    if (invalidIds.length === 0) {
      console.log('✅ No invalid IDs found! Database is clean.');
      return;
    }
    
    // Show examples
    console.log('   Examples of invalid IDs:');
    invalidIds.slice(0, 5).forEach(d => {
      console.log(`      • ${d.tweet_id} (from ${d.posted_at})`);
    });
    console.log('');
    
    // Step 2: Mark them as unscrappable in outcomes table
    console.log('📝 Step 2: Marking as unscrappable in outcomes table...');
    
    let updated = 0;
    for (const decision of invalidIds) {
      const { error } = await supabase
        .from('outcomes')
        .upsert({
          decision_id: decision.decision_id,
          tweet_id: decision.tweet_id,
          likes: null,
          retweets: null,
          replies: null,
          views: null,
          data_source: 'invalid_id_cleanup',
          notes: 'Invalid tweet ID format - unscrappable',
          collected_at: new Date().toISOString()
        }, {
          onConflict: 'decision_id'
        });
      
      if (!error) updated++;
    }
    
    console.log(`   ✅ Marked ${updated} decisions as unscrappable\n`);
    
    // Step 3: Get count of valid IDs for comparison
    const validIds = postedDecisions.filter(d => {
      const id = String(d.tweet_id);
      return id.length === 19 && !id.includes('_') && !isNaN(Number(id));
    });
    
    console.log('📊 Summary:');
    console.log(`   • Total decisions: ${postedDecisions.length}`);
    console.log(`   • Valid IDs: ${validIds.length} ✅`);
    console.log(`   • Invalid IDs: ${invalidIds.length} ❌`);
    console.log(`   • Invalid rate: ${((invalidIds.length / postedDecisions.length) * 100).toFixed(1)}%`);
    console.log('');
    
    console.log('✅ CLEANUP COMPLETE!');
    console.log('   Future scraping will only attempt valid tweet IDs');
    console.log('   Learning system will ignore invalid IDs');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

cleanInvalidTweetIds();


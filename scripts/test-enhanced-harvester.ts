/**
 * Test script for enhanced reply harvester
 * Tests health-specific filtering and relevance scoring
 */

import { config } from 'dotenv';
config();

async function testEnhancedHarvester() {
  console.log('🧪 TESTING ENHANCED REPLY HARVESTER');
  console.log('=====================================\n');
  
  console.log('📋 Enhancement Summary:');
  console.log('  ✅ Health account verification (name/handle checking)');
  console.log('  ✅ Content relevance scoring (keyword density)');
  console.log('  ✅ Off-topic account filtering (politics, sports, entertainment)');
  console.log('  ✅ Multi-keyword search queries (more specific health terms)');
  console.log('  ✅ Lower engagement thresholds for quality health content\n');
  
  console.log('🔍 Running harvester...\n');
  
  const { replyOpportunityHarvester } = await import('../src/jobs/replyOpportunityHarvester');
  
  try {
    await replyOpportunityHarvester();
    console.log('\n✅ Harvester completed successfully!');
    
    // Check results
    console.log('\n📊 Checking harvested opportunities...\n');
    
    const { getSupabaseClient } = await import('../src/db');
    const supabase = getSupabaseClient();
    
    const { data: opportunities, error } = await supabase
      .from('reply_opportunities')
      .select('*')
      .eq('replied_to', false)
      .order('like_count', { ascending: false })
      .limit(30);
    
    if (error) {
      console.error('❌ Error fetching opportunities:', error.message);
      return;
    }
    
    if (!opportunities || opportunities.length === 0) {
      console.log('⚠️ No opportunities found. This could mean:');
      console.log('  - Search queries too specific (adjust in replyOpportunityHarvester.ts)');
      console.log('  - Health filtering too strict (adjust health score thresholds)');
      console.log('  - Twitter rate limiting (wait and try again)');
      return;
    }
    
    console.log(`✅ Found ${opportunities.length} health-focused opportunities:\n`);
    
    // Analyze quality
    const tierCounts = {
      golden: opportunities.filter(o => o.tier === 'golden').length,
      good: opportunities.filter(o => o.tier === 'good').length,
      acceptable: opportunities.filter(o => o.tier === 'acceptable').length
    };
    
    console.log('📈 Quality Breakdown:');
    console.log(`  🏆 Golden: ${tierCounts.golden}`);
    console.log(`  ✅ Good: ${tierCounts.good}`);
    console.log(`  📊 Acceptable: ${tierCounts.acceptable}\n`);
    
    console.log('🔝 Top 10 Opportunities:');
    console.log('─'.repeat(100));
    
    opportunities.slice(0, 10).forEach((opp, i) => {
      const healthScore = opp.health_relevance_score || 'N/A';
      console.log(`${i + 1}. @${opp.target_username} (${opp.tier || 'unknown'})`);
      console.log(`   Engagement: ${opp.like_count} likes, ${opp.reply_count} replies`);
      console.log(`   Health Score: ${healthScore}`);
      console.log(`   Tweet: ${(opp.target_tweet_content || '').substring(0, 100)}...`);
      console.log('');
    });
    
    // Check for off-topic accounts
    const offTopicKeywords = ['democrat', 'republican', 'maga', 'barcelona', 'bayern', 'soccer', 'football', 'nfl', 'nba'];
    const suspectAccounts = opportunities.filter(opp => {
      const username = (opp.target_username || '').toLowerCase();
      return offTopicKeywords.some(kw => username.includes(kw));
    });
    
    if (suspectAccounts.length > 0) {
      console.log('⚠️ WARNING: Found potentially off-topic accounts:');
      suspectAccounts.forEach(opp => {
        console.log(`  - @${opp.target_username}`);
      });
      console.log('\nConsider strengthening filters in realTwitterDiscovery.ts\n');
    } else {
      console.log('✅ No off-topic accounts detected - filtering working well!\n');
    }
    
    // Engagement analysis
    const avgLikes = opportunities.reduce((sum, opp) => sum + (opp.like_count || 0), 0) / opportunities.length;
    const avgReplies = opportunities.reduce((sum, opp) => sum + (opp.reply_count || 0), 0) / opportunities.length;
    
    console.log('📊 Average Engagement:');
    console.log(`  Likes: ${Math.round(avgLikes).toLocaleString()}`);
    console.log(`  Replies: ${Math.round(avgReplies)}`);
    console.log('');
    
    console.log('✅ ENHANCEMENT TEST COMPLETE!\n');
    console.log('Next steps:');
    console.log('  1. If results look good, commit and push changes');
    console.log('  2. Monitor reply engagement over next 24-48 hours');
    console.log('  3. Adjust health score thresholds if needed');
    console.log('  4. Track follower growth and reply impressions\n');
    
  } catch (error: any) {
    console.error('❌ Harvester test failed:', error.message);
    console.error(error.stack);
  }
}

testEnhancedHarvester();


#!/usr/bin/env tsx

/**
 * Test a single Twitter search to verify fix works
 */

import { config } from 'dotenv';
import { RealTwitterDiscovery } from '../src/ai/realTwitterDiscovery';

config();

async function testSingleSearch() {
  console.log('🧪 Testing single Twitter search...\n');
  
  const discovery = new RealTwitterDiscovery();
  
  try {
    console.log('🔍 Searching for tweets with 500+ likes...');
    const opportunities = await discovery.findViralTweetsViaSearch(
      500,  // min likes
      50,   // max replies
      'TEST_SEARCH',
      12    // max age hours
    );
    
    console.log(`\n✅ Search completed!`);
    console.log(`📊 Found ${opportunities.length} opportunities`);
    
    if (opportunities.length > 0) {
      console.log('\n📝 First few results:');
      opportunities.slice(0, 3).forEach((opp, i) => {
        console.log(`\n${i+1}. Tweet:`);
        console.log(`   Likes: ${opp.like_count}`);
        console.log(`   Score: ${opp.health_relevance_score}/10`);
        console.log(`   Text: ${opp.original_tweet_text?.substring(0, 100)}...`);
      });
      
      console.log('\n✅ HARVESTER FIX WORKING!');
    } else {
      console.log('\n⚠️  No tweets found - may need to adjust search parameters');
    }
    
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    if (error.message.includes('__name')) {
      console.error('   __name error still present - fix not deployed');
    }
  }
}

testSingleSearch().catch(console.error);


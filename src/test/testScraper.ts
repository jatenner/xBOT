/**
 * 🧪 SCRAPER TEST SUITE
 * 
 * Test file to verify Playwright scraping functionality and session persistence.
 * 
 * Usage: npm run build && node dist/test/testScraper.js
 */

import { StealthTweetScraper } from '../scraper/scrapeTweets';
import * as fs from 'fs';
import * as path from 'path';

class ScraperTestSuite {
  private scraper: StealthTweetScraper;
  private sessionPath = path.join(process.cwd(), 'twitter-auth.json');

  constructor() {
    this.scraper = new StealthTweetScraper();
  }

  /**
   * 🔍 Check if session file exists and is valid
   */
  checkSession(): boolean {
    console.log('🔍 Checking Twitter session...');
    
    if (!fs.existsSync(this.sessionPath)) {
      console.log('❌ No session file found at twitter-auth.json');
      console.log('💡 Run: npm run build && node dist/utils/initTwitterSession.js');
      return false;
    }

    try {
      const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
      console.log(`✅ Session file found with ${sessionData.cookies?.length || 0} cookies`);
      console.log(`🕐 Created: ${sessionData.createdAt || 'Unknown'}`);
      
      const ageMs = Date.now() - (sessionData.timestamp || 0);
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      console.log(`📅 Session age: ${ageDays} days`);
      
      if (ageDays > 30) {
        console.log('⚠️ Session is over 30 days old - may need refresh');
      }
      
      return true;
    } catch (error) {
      console.log('❌ Session file is corrupted:', error.message);
      return false;
    }
  }

  /**
   * 🧪 Test basic scraper initialization
   */
  async testInitialization(): Promise<boolean> {
    console.log('\n🧪 Testing scraper initialization...');
    
    try {
      const success = await this.scraper.initialize();
      if (success) {
        console.log('✅ Scraper initialized successfully');
        return true;
      } else {
        console.log('❌ Scraper initialization failed');
        return false;
      }
    } catch (error) {
      console.log('❌ Initialization error:', error.message);
      return false;
    }
  }

  /**
   * 🔍 Test AI health search (5 tweets)
   */
  async testAIHealthSearch(): Promise<boolean> {
    console.log('\n🔍 Testing AI health search...');
    
    try {
      const result = await this.scraper.testAIHealthSearch(5);
      
      if (result.success && result.tweets && result.tweets.length > 0) {
        console.log(`✅ Successfully scraped ${result.tweets.length} tweets`);
        console.log(`🔍 Search query: "${result.searchQuery}"`);
        return true;
      } else {
        console.log('❌ AI health search failed:', result.error);
        return false;
      }
    } catch (error) {
      console.log('❌ Search error:', error.message);
      return false;
    }
  }

  /**
   * 📊 Test different search queries
   */
  async testMultipleSearches(): Promise<boolean> {
    console.log('\n📊 Testing multiple search queries...');
    
    const queries = [
      'health tech',
      'AI medicine',
      'digital health'
    ];

    let successCount = 0;
    
    for (const query of queries) {
      try {
        console.log(`\n🔍 Testing query: "${query}"`);
        const result = await this.scraper.searchTweets(query, 3);
        
        if (result.success && result.tweets && result.tweets.length > 0) {
          console.log(`✅ Found ${result.tweets.length} tweets for "${query}"`);
          successCount++;
        } else {
          console.log(`❌ No results for "${query}": ${result.error}`);
        }
        
        // Small delay between searches
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.log(`❌ Error searching "${query}":`, error.message);
      }
    }
    
    console.log(`📊 Search success rate: ${successCount}/${queries.length}`);
    return successCount > 0;
  }

  /**
   * 🏷️ Test trending topics
   */
  async testTrendingTopics(): Promise<boolean> {
    console.log('\n🏷️ Testing trending topics...');
    
    try {
      const result = await this.scraper.getTrendingTweets('health ai', 3);
      
      if (result.success && result.tweets && result.tweets.length > 0) {
        console.log(`✅ Found ${result.tweets.length} trending tweets`);
        return true;
      } else {
        console.log('❌ Trending topics failed:', result.error);
        return false;
      }
    } catch (error) {
      console.log('❌ Trending error:', error.message);
      return false;
    }
  }

  /**
   * 🔧 Test scraper cleanup
   */
  async testCleanup(): Promise<boolean> {
    console.log('\n🔧 Testing scraper cleanup...');
    
    try {
      await this.scraper.close();
      console.log('✅ Scraper closed successfully');
      return true;
    } catch (error) {
      console.log('❌ Cleanup error:', error.message);
      return false;
    }
  }

  /**
   * 📋 Run full test suite
   */
  async runFullTestSuite(): Promise<void> {
    console.log('🚀 === SCRAPER TEST SUITE STARTING ===');
    console.log(`📁 Working directory: ${process.cwd()}`);
    console.log(`🕐 Started at: ${new Date().toISOString()}`);
    
    const results = {
      sessionCheck: false,
      initialization: false,
      aiHealthSearch: false,
      multipleSearches: false,
      trendingTopics: false,
      cleanup: false
    };

    try {
      // Test 1: Session check
      results.sessionCheck = this.checkSession();
      
      if (!results.sessionCheck) {
        console.log('\n❌ Cannot proceed without valid session');
        console.log('💡 Please run session initialization first');
        return;
      }

      // Test 2: Initialization
      results.initialization = await this.testInitialization();
      
      if (!results.initialization) {
        console.log('\n❌ Cannot proceed without successful initialization');
        return;
      }

      // Test 3: AI health search
      results.aiHealthSearch = await this.testAIHealthSearch();

      // Test 4: Multiple searches
      results.multipleSearches = await this.testMultipleSearches();

      // Test 5: Trending topics
      results.trendingTopics = await this.testTrendingTopics();

      // Test 6: Cleanup
      results.cleanup = await this.testCleanup();

    } catch (error) {
      console.error('💥 Test suite crashed:', error);
    }

    // Final report
    console.log('\n📋 === TEST RESULTS ===');
    console.log(`✅ Session Check: ${results.sessionCheck ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Initialization: ${results.initialization ? 'PASS' : 'FAIL'}`);
    console.log(`✅ AI Health Search: ${results.aiHealthSearch ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Multiple Searches: ${results.multipleSearches ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Trending Topics: ${results.trendingTopics ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Cleanup: ${results.cleanup ? 'PASS' : 'FAIL'}`);

    const passCount = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n📊 Overall: ${passCount}/${totalTests} tests passed`);
    
    if (passCount === totalTests) {
      console.log('🎉 All tests PASSED! Scraper is ready for deployment.');
    } else if (passCount >= 4) {
      console.log('⚠️ Most tests passed. Minor issues detected.');
    } else {
      console.log('❌ Multiple test failures. Check session and configuration.');
    }
    
    console.log(`🕐 Completed at: ${new Date().toISOString()}`);
  }
}

// Main execution
async function main() {
  const testSuite = new ScraperTestSuite();
  
  const args = process.argv.slice(2);
  const testType = args[0] || 'full';

  try {
    switch (testType) {
      case 'session':
        testSuite.checkSession();
        break;
      case 'init':
        await testSuite.testInitialization();
        await testSuite.testCleanup();
        break;
      case 'search':
        const scraper = new StealthTweetScraper();
        await scraper.initialize();
        await scraper.testAIHealthSearch(5);
        await scraper.close();
        break;
      case 'full':
      default:
        await testSuite.runFullTestSuite();
        break;
    }
  } catch (error) {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ScraperTestSuite }; 
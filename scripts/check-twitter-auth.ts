/**
 * 🔐 Twitter Authentication Checker
 * 
 * Verifies if the browser is logged into Twitter
 * and can access search functionality
 */

import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';

async function checkAuth() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  🔍 Twitter Authentication Diagnostic Tool  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  const pool = UnifiedBrowserPool.getInstance();
  let page;
  
  try {
    console.log('1️⃣  Acquiring browser page...');
    page = await pool.acquirePage('auth_test');
    console.log('   ✅ Browser page acquired');
    console.log('');
    
    console.log('2️⃣  Navigating to Twitter home...');
    await page.goto('https://x.com/home', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    await page.waitForTimeout(3000);
    console.log('   ✅ Navigation complete');
    console.log('');
    
    console.log('3️⃣  Checking authentication status...');
    const authCheck = await page.evaluate(() => {
      // Multiple indicators of being logged in
      const indicators = {
        hasPostButton: !!document.querySelector('[data-testid="SideNav_NewTweet_Button"]'),
        hasProfileLink: !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]'),
        hasHomeTimeline: !!document.querySelector('[aria-label="Timeline: Your Home Timeline"]'),
        noLoginPrompt: !document.body.textContent?.includes('Sign in to X'),
        noLoginButton: !document.querySelector('[href="/login"]')
      };
      
      const isLoggedIn = indicators.hasPostButton || 
                        (indicators.hasProfileLink && indicators.noLoginPrompt);
      
      return { isLoggedIn, indicators };
    });
    
    if (authCheck.isLoggedIn) {
      console.log('   ✅ AUTHENTICATED: Browser is logged into Twitter');
      console.log('');
      console.log('   Authentication indicators:');
      console.log(`      • Post button: ${authCheck.indicators.hasPostButton ? '✅' : '❌'}`);
      console.log(`      • Profile link: ${authCheck.indicators.hasProfileLink ? '✅' : '❌'}`);
      console.log(`      • Home timeline: ${authCheck.indicators.hasHomeTimeline ? '✅' : '❌'}`);
      console.log(`      • No login prompt: ${authCheck.indicators.noLoginPrompt ? '✅' : '❌'}`);
    } else {
      console.log('   ❌ NOT AUTHENTICATED: Browser needs to login');
      console.log('');
      console.log('   Authentication indicators:');
      console.log(`      • Post button: ${authCheck.indicators.hasPostButton ? '✅' : '❌'}`);
      console.log(`      • Profile link: ${authCheck.indicators.hasProfileLink ? '✅' : '❌'}`);
      console.log(`      • Login prompt: ${!authCheck.indicators.noLoginPrompt ? '❌ FOUND' : '✅'}`);
      console.log('');
      console.log('   🔧 FIX: Run authentication setup:');
      console.log('      npx tsx scripts/setup-twitter-session.ts');
    }
    console.log('');
    
    if (authCheck.isLoggedIn) {
      console.log('4️⃣  Testing Twitter search functionality...');
      const searchUrl = 'https://x.com/search?q=health&src=typed_query&f=live';
      await page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      await page.waitForTimeout(5000);
      
      const searchCheck = await page.evaluate(() => {
        const selectors = {
          'article[data-testid="tweet"]': document.querySelectorAll('article[data-testid="tweet"]').length,
          'article[data-testid="tweetCard"]': document.querySelectorAll('article[data-testid="tweetCard"]').length,
          'div[data-testid="cellInnerDiv"]': document.querySelectorAll('div[data-testid="cellInnerDiv"]').length,
          'article[role="article"]': document.querySelectorAll('article[role="article"]').length
        };
        
        const totalTweets = Object.values(selectors).reduce((sum, count) => sum + count, 0);
        
        return { selectors, totalTweets };
      });
      
      if (searchCheck.totalTweets > 0) {
        console.log('   ✅ Search functionality working!');
        console.log('');
        console.log('   Tweet element counts:');
        Object.entries(searchCheck.selectors).forEach(([selector, count]) => {
          if (count > 0) {
            console.log(`      • ${selector}: ${count} found`);
          }
        });
      } else {
        console.log('   ⚠️  WARNING: Search returned 0 tweets');
        console.log('      This could indicate:');
        console.log('      • Twitter DOM structure changed');
        console.log('      • Rate limiting active');
        console.log('      • Network issues');
      }
      console.log('');
    }
    
    console.log('╔══════════════════════════════════════════════╗');
    if (authCheck.isLoggedIn) {
      console.log('║            ✅ DIAGNOSIS COMPLETE             ║');
      console.log('║                                              ║');
      console.log('║  Result: Browser is properly authenticated  ║');
      console.log('║  Status: Ready for reply harvesting         ║');
    } else {
      console.log('║            ❌ DIAGNOSIS COMPLETE             ║');
      console.log('║                                              ║');
      console.log('║  Result: Browser is NOT authenticated       ║');
      console.log('║  Action: Re-run Twitter login setup         ║');
    }
    console.log('╚══════════════════════════════════════════════╝');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ Diagnostic check failed:');
    console.error(`   Error: ${error.message}`);
    console.error('');
    console.error('   Possible causes:');
    console.error('   • Browser pool not initialized');
    console.error('   • Network connectivity issues');
    console.error('   • Twitter is down');
  } finally {
    if (page) {
      await pool.releasePage(page);
    }
    process.exit(0);
  }
}

checkAuth().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


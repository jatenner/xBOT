/**
 * 🔥 SMOKE TEST: Feed Extraction
 * 
 * Tests one curated account feed to diagnose why feeds return empty arrays
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';
import { getSupabaseClient } from '../src/db/index';

async function smokeTestFeed() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔥 SMOKE TEST: Feed Extraction');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const supabase = getSupabaseClient();
  
  // Get one curated account
  const { data: account } = await supabase
    .from('curated_accounts')
    .select('username')
    .eq('enabled', true)
    .order('signal_score', { ascending: false })
    .limit(1)
    .single();
  
  if (!account) {
    console.error('❌ No curated accounts found');
    process.exit(1);
  }
  
  const username = account.username;
  console.log(`📋 Testing account: @${username}\n`);
  
  const pool = UnifiedBrowserPool.getInstance();
  const profileUrl = `https://x.com/${username}`;
  
  try {
    const result = await pool.withContext('smoke_test', async (context) => {
      const page = await context.newPage();
      
      try {
        console.log(`🌐 Navigating to: ${profileUrl}`);
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        
        // Check diagnostics
        console.log('\n🔍 Running diagnostics...');
        const diagnostics = await page.evaluate(() => {
          const hasComposeBox = !!document.querySelector('[data-testid="tweetTextarea_0"]');
          const hasAccountMenu = !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
          const bodyText = document.body.textContent || '';
          const hasLoginWall = bodyText.includes('Sign in') ||
                              bodyText.includes('Log in') ||
                              !!document.querySelector('a[href*="/i/flow/login"]');
          const hasConsentWall = bodyText.includes('Accept all cookies') ||
                                 bodyText.includes('Cookie');
          const hasErrorWall = bodyText.includes('Something went wrong') ||
                               bodyText.includes('Try again');
          const hasRateLimit = bodyText.includes('rate limit') ||
                              bodyText.includes('Too many requests');
          
          const tweetContainers = document.querySelectorAll('article[data-testid="tweet"]');
          
          return {
            logged_in: hasComposeBox || hasAccountMenu,
            wall_detected: hasLoginWall || hasConsentWall || hasErrorWall || hasRateLimit,
            wall_type: hasLoginWall ? 'login' : hasConsentWall ? 'consent' : hasErrorWall ? 'error' : hasRateLimit ? 'rate_limit' : 'none',
            tweet_containers_found: tweetContainers.length,
            page_title: document.title,
            body_text_preview: bodyText.substring(0, 200),
          };
        });
        
        console.log('📊 Diagnostics:', JSON.stringify(diagnostics, null, 2));
        
        // Determine issue
        if (!diagnostics.logged_in) {
          console.log('\n❌ ISSUE: Not logged in');
          const screenshotPath = `/tmp/smoke_test_not_logged_in_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`📸 Screenshot: ${screenshotPath}`);
          return { issue: 'not_logged_in', diagnostics, screenshot_path: screenshotPath };
        }
        
        if (diagnostics.wall_detected) {
          console.log(`\n❌ ISSUE: Wall detected (${diagnostics.wall_type})`);
          const screenshotPath = `/tmp/smoke_test_wall_${diagnostics.wall_type}_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`📸 Screenshot: ${screenshotPath}`);
          return { issue: 'wall_detected', wall_type: diagnostics.wall_type, diagnostics, screenshot_path: screenshotPath };
        }
        
        if (diagnostics.tweet_containers_found === 0) {
          console.log('\n❌ ISSUE: No tweet containers found');
          const screenshotPath = `/tmp/smoke_test_no_tweets_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`📸 Screenshot: ${screenshotPath}`);
          return { issue: 'no_tweet_containers', diagnostics, screenshot_path: screenshotPath };
        }
        
        // Wait for selector
        console.log('\n⏳ Waiting for tweet selector...');
        try {
          await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
        } catch (e) {
          console.log('⚠️ Selector timeout');
          const screenshotPath = `/tmp/smoke_test_selector_timeout_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`📸 Screenshot: ${screenshotPath}`);
          return { issue: 'selector_timeout', diagnostics, screenshot_path: screenshotPath };
        }
        
        // Scroll once
        console.log('📜 Scrolling...');
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(2000);
        
        // Extract first 5 tweets
        console.log('\n📝 Extracting tweets...');
        const tweets = await page.evaluate(() => {
          const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
          const results: any[] = [];
          
          for (let i = 0; i < Math.min(articles.length, 5); i++) {
            const article = articles[i];
            
            const tweetLink = article.querySelector('a[href*="/status/"]');
            if (!tweetLink) continue;
            
            const href = tweetLink.getAttribute('href') || '';
            const match = href.match(/\/status\/(\d+)/);
            if (!match) continue;
            
            const tweet_id = match[1];
            const tweetText = article.querySelector('[data-testid="tweetText"]');
            const content = tweetText?.textContent?.trim() || '';
            
            results.push({
              tweet_id,
              content: content.substring(0, 100),
            });
          }
          
          return results;
        });
        
        console.log(`\n✅ Successfully extracted ${tweets.length} tweets:`);
        tweets.forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.tweet_id}: ${t.content.substring(0, 50)}...`);
        });
        
        return { issue: 'none', diagnostics, tweets };
        
      } finally {
        await page.close();
      }
    }, 1);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 SMOKE TEST RESULT');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(JSON.stringify(result, null, 2));
    
    // Log to system_events
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_smoke_test',
      severity: result.issue === 'none' ? 'info' : 'warning',
      message: `Smoke test result: ${result.issue}`,
      event_data: result,
      created_at: new Date().toISOString(),
    });
    
    process.exit(result.issue === 'none' ? 0 : 1);
    
  } catch (error: any) {
    console.error('\n❌ Smoke test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

smokeTestFeed().catch(console.error);


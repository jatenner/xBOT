const { chromium } = require('playwright');
const fs = require('fs');

async function testTwitterPostFixed() {
  console.log('🧪 TESTING: Fixed Twitter posting...');
  
  // Load session
  const sessionData = JSON.parse(fs.readFileSync('./data/twitter_session.json', 'utf8'));
  console.log(`📋 SESSION: Loaded ${sessionData.cookies.length} cookies`);
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  // Add cookies
  await context.addCookies(sessionData.cookies);
  
  const page = await context.newPage();
  
  try {
    // Go to Twitter
    console.log('🌐 NAVIGATING: Going to Twitter...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Check if logged in
    const isLoggedIn = await page.locator('[data-testid="SideNav_NewTweet_Button"]').isVisible();
    console.log(`🔐 LOGIN_STATUS: ${isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`);
    
    if (!isLoggedIn) {
      console.log('❌ FAILED: Not logged in to Twitter');
      await browser.close();
      return;
    }
    
    // Try to open composer
    console.log('📝 COMPOSER: Opening tweet composer...');
    await page.click('[data-testid="SideNav_NewTweet_Button"]');
    await page.waitForTimeout(2000);
    
    // Find text areas (handle multiple)
    const textAreas = page.locator('[data-testid="tweetTextarea_0"]');
    const count = await textAreas.count();
    console.log(`📝 TEXTAREAS: Found ${count} text areas`);
    
    if (count > 0) {
      // Use the first visible one
      const textArea = textAreas.first();
      
      // Type test content
      const testContent = 'TEST POST - Please ignore, testing bot functionality';
      await textArea.fill(testContent);
      console.log('✅ TYPED: Test content entered');
      
      await page.waitForTimeout(1000);
      
      // Look for post button
      const postButton = page.locator('[data-testid="tweetButtonInline"]');
      const isPostButtonVisible = await postButton.isVisible();
      const isPostButtonEnabled = await postButton.isEnabled();
      
      console.log(`🔘 POST_BUTTON: Visible=${isPostButtonVisible}, Enabled=${isPostButtonEnabled}`);
      
      if (isPostButtonVisible && isPostButtonEnabled) {
        console.log('🚀 READY_TO_POST: Everything looks good!');
        console.log('⚠️ STOPPING: Test complete - not actually posting');
        
        // Uncomment the next line to actually post:
        // await postButton.click();
        // console.log('✅ POSTED: Test tweet posted!');
      } else {
        console.log('❌ CANNOT_POST: Post button not ready');
      }
    }
    
    await page.waitForTimeout(5000); // Wait so you can see the browser
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    await browser.close();
  }
}

testTwitterPostFixed().catch(console.error);

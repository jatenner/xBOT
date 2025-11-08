#!/usr/bin/env tsx

/**
 * Detailed Twitter authentication test
 */

import { config } from 'dotenv';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';

config();

async function testAuth() {
  console.log('🧪 Testing Twitter Authentication\n');
  console.log('═'.repeat(60));
  
  // Check env var
  const hasSession = !!process.env.TWITTER_SESSION_B64;
  console.log(`\n📋 TWITTER_SESSION_B64: ${hasSession ? '✅ Set' : '❌ Missing'}`);
  if (hasSession) {
    console.log(`   Length: ${process.env.TWITTER_SESSION_B64?.length} characters`);
  }
  
  if (!hasSession) {
    console.log('\n❌ Cannot test - TWITTER_SESSION_B64 not set');
    process.exit(1);
  }
  
  const pool = UnifiedBrowserPool.getInstance();
  
  try {
    console.log('\n🌐 Acquiring browser page...');
    const page = await pool.acquirePage('auth_test');
    
    console.log('\n🔍 Testing authentication...');
    console.log('   Navigating to Twitter home...');
    
    await page.goto('https://x.com/home', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    console.log('   ✓ Loaded Twitter home');
    
    // Wait a bit for page to settle
    await page.waitForTimeout(3000);
    
    // Try to find the "New Tweet" button
    console.log('\n🔍 Looking for authenticated elements...');
    
    try {
      const newTweetButton = await page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { 
        timeout: 10000 
      });
      
      if (newTweetButton) {
        console.log('   ✅ Found "New Tweet" button - AUTHENTICATED!');
      }
    } catch (error) {
      console.log('   ❌ "New Tweet" button not found - NOT AUTHENTICATED');
      
      // Check what page we're on
      const url = page.url();
      console.log(`   Current URL: ${url}`);
      
      // Check for login page elements
      const hasLoginForm = await page.$('input[name="text"]') !== null;
      if (hasLoginForm) {
        console.log('   ⚠️  On login page - session expired or invalid');
      }
      
      // Take screenshot for debugging
      console.log('\n📸 Taking screenshot...');
      await page.screenshot({ path: 'artifacts/auth-test-failed.png', fullPage: true });
      console.log('   Saved to: artifacts/auth-test-failed.png');
    }
    
    // Check cookies
    const cookies = await page.context().cookies();
    console.log(`\n🍪 Cookies loaded: ${cookies.length}`);
    const authCookie = cookies.find(c => c.name === 'auth_token');
    console.log(`   auth_token: ${authCookie ? '✅ Present' : '❌ Missing'}`);
    
    await pool.releasePage(page);
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    await pool.shutdown();
  }
  
  console.log('\n═'.repeat(60));
  console.log('✅ Test complete\n');
}

testAuth().catch(console.error);


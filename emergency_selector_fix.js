#!/usr/bin/env node

/**
 * 🚨 EMERGENCY X.COM SELECTOR FIX
 * ===============================
 * Immediate fix for posting issues based on current X.com structure
 */

const fs = require('fs');
const path = require('path');

function emergencyPostButtonFix() {
    console.log('🚨 Applying emergency post button selector fix...');
    
    const browserPosterPath = path.join(process.cwd(), 'src/utils/browserTweetPoster.ts');
    
    if (fs.existsSync(browserPosterPath)) {
        let content = fs.readFileSync(browserPosterPath, 'utf8');
        
        // Replace the problematic post button selector with current working one
        const oldPostButtonSearch = `'button[aria-label="Post"]',
            'button[role="button"]:has-text("Post")',
            'button[role="button"]:has-text("Tweet")',
            'div[role="button"]:has-text("Post")'`;
            
        const newPostButtonSelector = `'[data-testid="tweetButton"]',
            '[data-testid="tweetButtonInline"]', 
            'button[data-testid="tweetButton"]',
            'div[data-testid="tweetButton"]',
            'button[role="button"]',
            '[role="button"][aria-label*="Post"]'`;
            
        content = content.replace(oldPostButtonSearch, newPostButtonSelector);
        
        // Also update the timeout for post button to be more aggressive
        content = content.replace(/timeout:\s*20000/g, 'timeout: 30000');
        content = content.replace(/waitForTimeout\(8000\)/g, 'waitForTimeout(12000)');
        
        // Add more robust post button detection
        const findPostButtonFunction = `
  /**
   * 🎯 EMERGENCY POST BUTTON FINDER
   */
  async findPostButtonAggressive(): Promise<any> {
    const selectors = [
      '[data-testid="tweetButton"]',
      '[data-testid="tweetButtonInline"]',
      'button[data-testid="tweetButton"]',
      'div[data-testid="tweetButton"]',
      'button[role="button"]:not([aria-label*="Close"])',
      '[role="button"]:not([aria-label*="Close"]):not([aria-label*="Back"])',
      'button:has-text("Post")',
      'div:has-text("Post")[role="button"]'
    ];
    
    for (const selector of selectors) {
      try {
        console.log(\`🔍 Trying post button selector: \${selector}\`);
        const element = await this.page!.waitForSelector(selector, { 
          timeout: 15000,
          state: 'attached'
        });
        
        if (element) {
          // Verify it's actually clickable and not disabled
          const isVisible = await element.isVisible();
          const isEnabled = await element.isEnabled();
          
          if (isVisible && isEnabled) {
            console.log(\`✅ Found working post button: \${selector}\`);
            return element;
          }
        }
      } catch (error) {
        console.log(\`⚠️  Post button selector failed: \${selector}\`);
      }
    }
    
    throw new Error('Could not find any working post button selector');
  }`;
        
        // Insert the emergency function
        if (!content.includes('findPostButtonAggressive')) {
            content = content.replace(
                'async findAndClickPostButton():',
                findPostButtonFunction + '\n\n  async findAndClickPostButton():'
            );
        }
        
        fs.writeFileSync(browserPosterPath, content);
        console.log('✅ Applied emergency post button fix');
    }
}

function updateRoboticPoster() {
    console.log('🤖 Updating robotic poster selectors...');
    
    const roboticPosterPath = path.join(process.cwd(), 'src/utils/roboticBrowserTweetPoster.ts');
    
    if (fs.existsSync(roboticPosterPath)) {
        let content = fs.readFileSync(roboticPosterPath, 'utf8');
        
        // Update the post button selector in the SELECTORS object
        const oldPostButtonBlock = `postButton: {
            primary: '[data-testid="tweetButtonInline"]',
            fallbacks: [
                '[data-testid="tweetButton"]',
                'button[role="button"]:has-text("Post")',
                'button[role="button"]:has-text("Tweet")',
                'div[role="button"]:has-text("Post")'
            ],
            description: 'Post/Tweet button'
        }`;
        
        const newPostButtonBlock = `postButton: {
            primary: '[data-testid="tweetButton"]',
            fallbacks: [
                '[data-testid="tweetButtonInline"]',
                'button[data-testid="tweetButton"]',
                'div[data-testid="tweetButton"]',
                'button[role="button"]',
                '[role="button"][aria-label*="Post"]',
                'button:has-text("Post")'
            ],
            description: 'Post/Tweet button'
        }`;
        
        content = content.replace(oldPostButtonBlock, newPostButtonBlock);
        
        fs.writeFileSync(roboticPosterPath, content);
        console.log('✅ Updated robotic poster selectors');
    }
}

function main() {
    console.log('🚨 Applying emergency X.com selector fixes...');
    
    emergencyPostButtonFix();
    updateRoboticPoster();
    
    console.log('🎉 Emergency fixes applied!');
    console.log('🚀 This should resolve the posting timeout issues');
}

if (require.main === module) {
    main();
}

module.exports = { emergencyPostButtonFix, updateRoboticPoster };
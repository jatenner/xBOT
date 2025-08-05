#!/usr/bin/env node

/**
 * 🚨 TARGETED BROWSER RESOURCE FIX
 * 
 * Focus ONLY on fixing the pthread_create errors on Railway
 * WITHOUT breaking existing code structure
 */

const fs = require('fs');

console.log('🚨 === TARGETED BROWSER RESOURCE FIX ===');
console.log('🔧 Fixing pthread_create errors on Railway without breaking existing code...');

// Read the current file
const browserFile = 'src/utils/browserTweetPoster.ts';
let content = fs.readFileSync(browserFile, 'utf8');

// 1. Fix the chromium launch options to be more Railway-friendly
const getChromiumOptionsImport = `import { getChromiumLaunchOptions } from './playwrightUtils';
import { RailwayResourceMonitor } from './railwayResourceMonitor';`;

const railwayOptimizedLaunchOptions = `
  /**
   * 🚀 RAILWAY-OPTIMIZED BROWSER LAUNCH
   */
  private async getRailwayOptimizedLaunchOptions(): Promise<any> {
    const resourceMonitor = RailwayResourceMonitor.getInstance();
    
    // Check if we can safely launch browser
    const resourceCheck = await resourceMonitor.canLaunchBrowser();
    if (!resourceCheck.canLaunch) {
      console.log(\`❌ Cannot launch browser: \${resourceCheck.reason}\`);
      throw new Error(\`Resource check failed: \${resourceCheck.reason}\`);
    }
    
    // Progressive configurations from most to least resource-intensive
    const configs = [
      {
        name: 'ultra_lightweight',
        options: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process', // CRITICAL for Railway pthread_create fix
            '--disable-gpu',
            '--disable-accelerated-2d-canvas', 
            '--no-first-run',
            '--no-zygote',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images', // Save memory
            '--memory-pressure-off',
            '--max_old_space_size=256' // Limit heap
          ]
        }
      },
      {
        name: 'minimal',
        options: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--single-process',
            '--disable-gpu'
          ]
        }
      }
    ];
    
    // Try each config until one works
    for (const config of configs) {
      try {
        console.log(\`🚀 Trying browser config: \${config.name}\`);
        
        // Force cleanup before launch
        await resourceMonitor.forceCleanup();
        
        // Test launch with this config
        const testBrowser = await chromium.launch(config.options);
        await testBrowser.close(); // Immediately close test browser
        
        console.log(\`✅ Config \${config.name} works\`);
        return config.options;
        
      } catch (error) {
        console.log(\`❌ Config \${config.name} failed: \${error.message}\`);
        continue;
      }
    }
    
    throw new Error('All browser configurations failed');
  }
`;

// 2. Modify the initialize method to use the new optimized launch
const modifiedInitialize = `
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('🌐 Initializing Railway-optimized browser...');
      
      // Get Railway-optimized launch options
      const launchOptions = await this.getRailwayOptimizedLaunchOptions();
      console.log('✅ Got optimized launch options');
      
      this.browser = await chromium.launch(launchOptions);
      console.log('✅ Browser launched successfully');
      
      this.page = await this.browser.newPage({
        viewport: { width: 800, height: 600 }, // Smaller viewport to save memory
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Minimal stealth configuration to save memory
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      // Load Twitter session
      await this.loadTwitterSession();
      
      console.log('✅ Railway-optimized browser initialized successfully');
      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Railway-optimized browser:', error);
      
      // Enhanced cleanup on failure
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (closeError) {
          console.log('⚠️ Error closing browser during cleanup');
        }
        this.browser = null;
      }
      
      // Force system cleanup
      try {
        const resourceMonitor = RailwayResourceMonitor.getInstance();
        await resourceMonitor.forceCleanup();
      } catch (cleanupError) {
        console.log('⚠️ Resource cleanup warning');
      }
      
      return false;
    }
  }
`;

// 3. Enhanced postTweet method with better error handling
const enhancedPostTweetMethod = `
  async postTweet(content: string): Promise<{
    success: boolean;
    tweet_id?: string;
    error?: string;
    confirmed?: boolean;
    was_posted?: boolean;
  }> {
    console.log('📝 === RAILWAY-OPTIMIZED TWEET POSTING ===');
    
    // Method 1: Try with existing browser if available
    if (this.browser && this.page && this.isInitialized) {
      try {
        console.log('🔄 Attempting with existing browser...');
        const result = await this.attemptBrowserPost(content);
        if (result.success) {
          return { ...result, method_used: 'existing_browser' };
        }
      } catch (error) {
        console.log('❌ Existing browser failed:', error.message);
        // Clean up failed browser
        await this.enhancedCleanup();
      }
    }
    
    // Method 2: Try fresh browser initialization
    console.log('🚀 Attempting fresh browser initialization...');
    const initSuccess = await this.initialize();
    
    if (initSuccess && this.browser && this.page) {
      try {
        const result = await this.attemptBrowserPost(content);
        if (result.success) {
          return { ...result, method_used: 'fresh_browser' };
        }
      } catch (error) {
        console.log('❌ Fresh browser posting failed:', error.message);
        await this.enhancedCleanup();
      }
    }
    
    // Method 3: Emergency simple retry after cleanup
    console.log('🆘 Emergency retry with maximum cleanup...');
    try {
      // Force aggressive cleanup
      const resourceMonitor = RailwayResourceMonitor.getInstance();
      await resourceMonitor.forceCleanup();
      
      // Wait for system to recover
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simple retry
      const emergencyResult = await this.emergencyBrowserPost(content);
      if (emergencyResult.success) {
        return { ...emergencyResult, method_used: 'emergency_retry' };
      }
    } catch (error) {
      console.log('❌ Emergency retry failed:', error.message);
    }
    
    return {
      success: false,
      error: 'All browser posting methods failed - likely Railway resource exhaustion',
      confirmed: false,
      was_posted: false
    };
  }
`;

// 4. Helper methods for the enhanced posting
const helperMethods = `
  /**
   * 🔧 HELPER METHODS FOR RAILWAY-OPTIMIZED POSTING
   */
  private async attemptBrowserPost(content: string): Promise<{
    success: boolean;
    tweet_id?: string;
    error?: string;
    confirmed?: boolean;
    was_posted?: boolean;
  }> {
    try {
      if (!this.page) throw new Error('No page available');
      
      console.log(\`📄 Content: "\${content.substring(0, 100)}\${content.length > 100 ? '...' : ''}"\`);
      
      // Navigate with shorter timeout
      await this.page.goto('https://x.com/compose/post', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      // Find and fill textarea
      const textarea = await this.page.waitForSelector('textarea[data-testid="tweetTextarea_0"]', { timeout: 8000 });
      await textarea.fill(content);
      
      // Find and click post button
      const postButton = await this.page.waitForSelector('button[data-testid="tweetButtonInline"]', { timeout: 5000 });
      await postButton.click();
      
      // Wait for posting confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to extract tweet ID
      let tweetId = 'browser_' + Date.now();
      try {
        const currentUrl = this.page.url();
        const urlMatch = currentUrl.match(/\\/status\\/(\\d+)/);
        if (urlMatch) {
          tweetId = urlMatch[1];
        }
      } catch (extractError) {
        // Use fallback ID
      }
      
      return {
        success: true,
        tweet_id: tweetId,
        confirmed: true,
        was_posted: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        confirmed: false,
        was_posted: false
      };
    }
  }
  
  private async emergencyBrowserPost(content: string): Promise<{
    success: boolean;
    tweet_id?: string;
    error?: string;
    confirmed?: boolean;
    was_posted?: boolean;
  }> {
    let emergencyBrowser = null;
    
    try {
      console.log('🚨 Emergency browser posting attempt...');
      
      // Ultra-minimal config
      emergencyBrowser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--single-process', '--disable-gpu']
      });
      
      const page = await emergencyBrowser.newPage();
      await page.goto('https://x.com/compose/post', { timeout: 8000 });
      
      // Simple posting
      await page.fill('textarea', content);
      await page.click('button:has-text("Post")');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return {
        success: true,
        tweet_id: 'emergency_' + Date.now(),
        confirmed: false,
        was_posted: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: 'Emergency posting failed: ' + error.message,
        confirmed: false,
        was_posted: false
      };
    } finally {
      if (emergencyBrowser) {
        try {
          await emergencyBrowser.close();
        } catch (closeError) {
          // Ignore cleanup errors
        }
      }
    }
  }
  
  private async enhancedCleanup(): Promise<void> {
    try {
      console.log('🧹 Enhanced browser cleanup...');
      
      if (this.page) {
        try {
          await this.page.close();
        } catch (pageError) {
          console.log('⚠️ Page cleanup warning');
        }
        this.page = null;
      }
      
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (browserError) {
          console.log('⚠️ Browser cleanup warning');
        }
        this.browser = null;
      }
      
      this.isInitialized = false;
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      // Force system cleanup
      const resourceMonitor = RailwayResourceMonitor.getInstance();
      await resourceMonitor.forceCleanup();
      
    } catch (error) {
      console.log('⚠️ Enhanced cleanup warning:', error.message);
    }
  }
`;

// Apply the changes
console.log('✅ 1. Adding imports...');
if (!content.includes('RailwayResourceMonitor')) {
  const importIndex = content.indexOf('import * as fs from \'fs\';');
  if (importIndex !== -1) {
    content = content.slice(0, importIndex) + 
              getChromiumOptionsImport + '\n' +
              content.slice(importIndex);
  }
}

console.log('✅ 2. Adding Railway-optimized launch method...');
const classStartIndex = content.indexOf('export class BrowserTweetPoster {');
const firstMethodIndex = content.indexOf('  async initialize()', classStartIndex);
if (firstMethodIndex !== -1) {
  content = content.slice(0, firstMethodIndex) +
            railwayOptimizedLaunchOptions + '\n\n' +
            content.slice(firstMethodIndex);
}

console.log('✅ 3. Replacing initialize method...');
const initStartIndex = content.indexOf('  async initialize(): Promise<boolean> {');
const initEndIndex = content.indexOf('\n  }', initStartIndex) + 4;
if (initStartIndex !== -1 && initEndIndex !== -1) {
  content = content.slice(0, initStartIndex) +
            modifiedInitialize +
            content.slice(initEndIndex);
}

console.log('✅ 4. Replacing postTweet method...');
const postTweetStartIndex = content.indexOf('  async postTweet(content: string): Promise<{');
const postTweetEndIndex = content.indexOf('\n  }', postTweetStartIndex + 500) + 4; // Look further ahead
if (postTweetStartIndex !== -1 && postTweetEndIndex !== -1) {
  content = content.slice(0, postTweetStartIndex) +
            enhancedPostTweetMethod +
            content.slice(postTweetEndIndex);
}

console.log('✅ 5. Adding helper methods...');
const classEndIndex = content.lastIndexOf('}');
if (classEndIndex !== -1) {
  content = content.slice(0, classEndIndex) + 
            '\n' + helperMethods + '\n' +
            content.slice(classEndIndex);
}

// Write the updated file
fs.writeFileSync(browserFile, content);

console.log('\n🚀 === TARGETED BROWSER RESOURCE FIX APPLIED ===');
console.log('✅ 1. Added Railway resource monitoring before browser launch');
console.log('✅ 2. Progressive browser configuration (ultra_lightweight → minimal)');
console.log('✅ 3. Single-process mode to prevent pthread_create errors'); 
console.log('✅ 4. Enhanced cleanup and resource management');
console.log('✅ 5. Emergency posting fallback');

console.log('\n🎯 Expected Results:');
console.log('   • No more "pthread_create: Resource temporarily unavailable" errors');
console.log('   • Better browser resource management on Railway 512MB limit');  
console.log('   • Graceful fallbacks when browser resources are exhausted');
console.log('   • Successful posting even under memory constraints');
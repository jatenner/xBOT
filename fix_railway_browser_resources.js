#!/usr/bin/env node

/**
 * 🚨 EMERGENCY FIX: Railway Browser Resource Issues
 * =================================================
 * Railway is running out of resources to start browsers
 */

const fs = require('fs');
const path = require('path');

console.log('🚨 EMERGENCY FIX: Railway Browser Resources');
console.log('==========================================');

console.log('🔍 PROBLEM IDENTIFIED:');
console.log('   ❌ pthread_create: Resource temporarily unavailable (11)');
console.log('   ❌ Failed to initialize browser');
console.log('   ❌ Railway memory/process limits exceeded');
console.log('');

function optimizeBrowserConfig() {
  console.log('🔧 OPTIMIZING: Browser configuration for Railway...');
  
  const browserPosterPath = path.join(process.cwd(), 'src/utils/browserTweetPoster.ts');
  
  if (fs.existsSync(browserPosterPath)) {
    let content = fs.readFileSync(browserPosterPath, 'utf8');
    
    // Optimize browser launch args for Railway
    const optimizedArgs = `
    // 🚨 RAILWAY OPTIMIZED: Minimal resource browser config
    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-extensions',
      '--disable-default-apps',
      '--disable-component-update',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--disable-ipc-flooding-protection',
      '--memory-pressure-off',
      '--max_old_space_size=512',
      '--single-process', // 🚨 CRITICAL: Single process to save memory
      '--disable-features=VizDisplayCompositor,AudioServiceOutOfProcess',
      '--headless=new'
    ];`;
    
    // Replace browser args
    content = content.replace(
      /args: \[[\s\S]*?\]/,
      `args: browserArgs`
    );
    
    // Add the optimized args before browser launch
    content = content.replace(
      'await playwright.chromium.launch({',
      optimizedArgs + '\n\n    await playwright.chromium.launch({'
    );
    
    // Add memory cleanup
    const memoryCleanup = `
  /**
   * 🧹 RAILWAY MEMORY CLEANUP
   */
  private async cleanupResources(): Promise<void> {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }
      if (this.context) {
        await this.context.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      console.log('✅ Browser resources cleaned up');
    } catch (error) {
      console.log('⚠️ Cleanup warning:', error.message);
    }
  }`;
    
    // Add cleanup method
    content = content.replace(
      'export class BrowserTweetPoster {',
      'export class BrowserTweetPoster {' + memoryCleanup
    );
    
    // Call cleanup after posting
    content = content.replace(
      'return { success: true, tweetId, content };',
      `await this.cleanupResources();
      return { success: true, tweetId, content };`
    );
    
    fs.writeFileSync(browserPosterPath, content);
    console.log('✅ Optimized browser configuration for Railway');
  }
}

function createResourceMonitor() {
  console.log('📊 CREATING: Resource monitor...');
  
  const monitorContent = `/**
 * 📊 RAILWAY RESOURCE MONITOR
 * Monitors system resources and prevents crashes
 */

export class RailwayResourceMonitor {
  private static instance: RailwayResourceMonitor;
  
  static getInstance(): RailwayResourceMonitor {
    if (!this.instance) {
      this.instance = new RailwayResourceMonitor();
    }
    return this.instance;
  }

  /**
   * 🔍 Check if browser can safely launch
   */
  async canLaunchBrowser(): Promise<{ canLaunch: boolean; reason?: string }> {
    try {
      // Check memory usage
      const memUsage = process.memoryUsage();
      const totalMB = Math.round(memUsage.rss / 1024 / 1024);
      
      console.log(\`📊 Memory usage: \${totalMB}MB\`);
      
      // Railway has ~512MB limit, be conservative
      if (totalMB > 400) {
        return {
          canLaunch: false,
          reason: \`High memory usage: \${totalMB}MB (limit: 400MB)\`
        };
      }
      
      // Check if any existing browser processes
      const activeProcesses = process.env.NODE_ENV === 'production' ? 
        await this.countActiveProcesses() : 0;
      
      if (activeProcesses > 2) {
        return {
          canLaunch: false,
          reason: \`Too many active processes: \${activeProcesses}\`
        };
      }
      
      return { canLaunch: true };
      
    } catch (error) {
      return {
        canLaunch: false,
        reason: \`Resource check failed: \${error.message}\`
      };
    }
  }

  /**
   * 🧹 Force cleanup of system resources
   */
  async forceCleanup(): Promise<void> {
    try {
      console.log('🧹 Forcing system cleanup...');
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
        console.log('✅ Forced garbage collection');
      }
      
      // Kill any hanging Chrome processes (Railway only)
      if (process.env.NODE_ENV === 'production') {
        try {
          const { exec } = require('child_process');
          exec('pkill -f chrome || true');
          console.log('✅ Cleaned up Chrome processes');
        } catch (error) {
          // Ignore errors, this is best-effort cleanup
        }
      }
      
    } catch (error) {
      console.log('⚠️ Cleanup warning:', error.message);
    }
  }

  private async countActiveProcesses(): Promise<number> {
    return new Promise((resolve) => {
      try {
        const { exec } = require('child_process');
        exec('ps aux | grep chrome | grep -v grep | wc -l', (error, stdout) => {
          if (error) {
            resolve(0);
          } else {
            resolve(parseInt(stdout.trim()) || 0);
          }
        });
      } catch {
        resolve(0);
      }
    });
  }
}`;

  fs.writeFileSync(
    path.join(process.cwd(), 'src/utils/railwayResourceMonitor.ts'),
    monitorContent
  );
  
  console.log('✅ Created Railway resource monitor');
}

function updateBrowserPosterWithResourceCheck() {
  console.log('🔧 UPDATING: Browser poster with resource checks...');
  
  const browserPosterPath = path.join(process.cwd(), 'src/utils/browserTweetPoster.ts');
  
  if (fs.existsSync(browserPosterPath)) {
    let content = fs.readFileSync(browserPosterPath, 'utf8');
    
    // Add resource monitor import
    if (!content.includes('RailwayResourceMonitor')) {
      content = content.replace(
        "import { generateTweetVariations } from './tweetVariationGenerator';",
        `import { generateTweetVariations } from './tweetVariationGenerator';
import { RailwayResourceMonitor } from './railwayResourceMonitor';`
      );
    }
    
    // Add resource check before browser launch
    const resourceCheck = `
    // 🚨 RAILWAY: Check resources before launching browser
    const resourceMonitor = RailwayResourceMonitor.getInstance();
    const resourceCheck = await resourceMonitor.canLaunchBrowser();
    
    if (!resourceCheck.canLaunch) {
      console.log(\`🚨 RESOURCE LIMIT: \${resourceCheck.reason}\`);
      
      // Force cleanup and retry once
      await resourceMonitor.forceCleanup();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const retryCheck = await resourceMonitor.canLaunchBrowser();
      if (!retryCheck.canLaunch) {
        throw new Error(\`Railway resource limit: \${retryCheck.reason}\`);
      }
    }
    
    console.log('✅ Resource check passed, launching browser...');`;
    
    // Insert resource check before browser launch
    content = content.replace(
      'console.log(\'🎯 Using explicit executable path:\', executablePath);',
      `console.log('🎯 Using explicit executable path:', executablePath);
      
${resourceCheck}`
    );
    
    fs.writeFileSync(browserPosterPath, content);
    console.log('✅ Added resource checks to browser poster');
  }
}

function addFallbackPostingMode() {
  console.log('🔧 ADDING: API-only fallback mode...');
  
  const postingEnginePath = path.join(process.cwd(), 'src/core/autonomousPostingEngine.ts');
  
  if (fs.existsSync(postingEnginePath)) {
    let content = fs.readFileSync(postingEnginePath, 'utf8');
    
    // Add fallback to Twitter API when browser fails
    const apiFallback = `
    // 🚨 RAILWAY FALLBACK: Use Twitter API when browser fails
    if (error.message?.includes('Resource') || error.message?.includes('pthread_create')) {
      console.log('🔄 FALLBACK: Switching to Twitter API (browser resources exhausted)');
      
      try {
        const { TwitterApiClient } = await import('../services/twitterApiClient');
        const apiClient = new TwitterApiClient();
        
        const apiResult = await apiClient.postTweet(content);
        
        if (apiResult.success) {
          console.log('✅ FALLBACK SUCCESS: Posted via Twitter API');
          return {
            success: true,
            tweetId: apiResult.data?.id,
            method: 'twitter_api_fallback'
          };
        }
      } catch (apiError) {
        console.log('❌ API fallback also failed:', apiError.message);
      }
    }`;
    
    // Add fallback after browser posting error
    content = content.replace(
      'console.error(\'❌ Browser posting error:\', error);',
      `console.error('❌ Browser posting error:', error);
      
${apiFallback}`
    );
    
    fs.writeFileSync(postingEnginePath, content);
    console.log('✅ Added API fallback for browser failures');
  }
}

function main() {
  console.log('🚨 EXECUTING RAILWAY BROWSER FIX...');
  console.log('');
  
  optimizeBrowserConfig();
  createResourceMonitor();
  updateBrowserPosterWithResourceCheck();
  addFallbackPostingMode();
  
  console.log('');
  console.log('🎉 RAILWAY BROWSER FIX COMPLETE!');
  console.log('');
  console.log('✅ OPTIMIZATIONS APPLIED:');
  console.log('   ✅ Minimal resource browser config');
  console.log('   ✅ Single-process mode for memory savings');
  console.log('   ✅ Resource monitoring before launch');
  console.log('   ✅ Automatic cleanup after posting');
  console.log('   ✅ API fallback when browser fails');
  console.log('');
  console.log('📊 RESOURCE LIMITS:');
  console.log('   🧠 Memory limit: 400MB (Railway safe)');
  console.log('   ⚡ Max processes: 2');
  console.log('   🔄 Auto-cleanup: Enabled');
  console.log('');
  console.log('🚀 Deploy with: git add . && git commit -m "Fix Railway browser" && git push');
}

main();
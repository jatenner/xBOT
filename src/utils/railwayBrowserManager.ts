/**
 * 🚀 RAILWAY BROWSER MANAGER
 * Centralized browser lifecycle management for Railway deployment
 * Prevents resource exhaustion and ensures proper cleanup
 */

import { Browser, Page, chromium } from 'playwright';
import { RailwayResourceMonitor } from './railwayResourceMonitor';

export class RailwayBrowserManager {
  private static instance: RailwayBrowserManager;
  private activeBrowsers: Map<string, Browser> = new Map();
  private resourceMonitor: RailwayResourceMonitor;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.resourceMonitor = RailwayResourceMonitor.getInstance();
    this.startPeriodicCleanup();
  }

  static getInstance(): RailwayBrowserManager {
    if (!RailwayBrowserManager.instance) {
      RailwayBrowserManager.instance = new RailwayBrowserManager();
    }
    return RailwayBrowserManager.instance;
  }

  /**
   * 🚀 Launch a managed browser instance with EAGAIN handling
   */
  async launchBrowser(id: string = 'default'): Promise<{ browser: Browser; page: Page } | null> {
    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        console.log(`🚀 Launching managed browser: ${id} (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Aggressive pre-launch cleanup on retries
        if (retryCount > 0) {
          console.log(`🧹 Pre-launch cleanup (attempt ${retryCount + 1})`);
          await this.forceResourceCleanup();
          
          // Progressive wait on retries to let Railway recover
          const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`⏱️ Waiting ${waitTime}ms for Railway resource recovery...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Check if we can safely launch
        const canLaunch = await this.resourceMonitor.canLaunchBrowser();
        if (!canLaunch.canLaunch) {
          console.log(`❌ Cannot launch browser: ${canLaunch.reason}`);
          
          // Force cleanup and try again
          await this.forceResourceCleanup();
          retryCount++;
          continue;
        }

        // Close existing browser with same ID if exists
        await this.closeBrowser(id);

        // Railway-specific browser configuration to handle EAGAIN
        const browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-web-security',
            '--memory-pressure-off',
            '--max_old_space_size=256', // Reduced from 384
            '--single-process',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images', // Disable images to save resources
            '--disable-javascript', // Will re-enable after navigation
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-default-apps',
            '--disable-background-networking',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--no-zygote', // Critical for Railway
            '--disable-ipc-flooding-protection'
          ],
          chromiumSandbox: false,
          timeout: 45000, // Increased timeout for Railway
          // Use system Chromium if available
          executablePath: process.env.NODE_ENV === 'production' ? undefined : undefined
        });

        // Create page with ultra-minimal resource usage
        const page = await browser.newPage({
          viewport: { width: 800, height: 600 },
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          // Disable unnecessary features
          javaScriptEnabled: false, // Will enable when needed
          extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });

        // Store reference for cleanup
        this.activeBrowsers.set(id, browser);

        console.log(`✅ Browser launched successfully: ${id} on attempt ${retryCount + 1}`);
        return { browser, page };

      } catch (error) {
        retryCount++;
        const isEAGAIN = error.message.includes('EAGAIN') || error.message.includes('spawn');
        
        console.error(`❌ Browser launch attempt ${retryCount} failed:`, {
          error: error.message,
          isEAGAIN,
          willRetry: retryCount < maxRetries
        });

        if (isEAGAIN && retryCount < maxRetries) {
          console.log(`🔄 EAGAIN detected - performing aggressive cleanup before retry...`);
          await this.forceResourceCleanup();
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
            await new Promise(resolve => setTimeout(resolve, 100));
            global.gc();
          }
        } else if (retryCount >= maxRetries) {
          console.error(`💥 All browser launch attempts exhausted for ${id}`);
          return null;
        }
      }
    }

    return null;
  }

  /**
   * 🧹 Close a specific browser
   */
  async closeBrowser(id: string): Promise<void> {
    try {
      const browser = this.activeBrowsers.get(id);
      if (browser) {
        await browser.close();
        this.activeBrowsers.delete(id);
        console.log(`✅ Closed browser: ${id}`);
      }
    } catch (error) {
      console.log(`⚠️ Error closing browser ${id}`);
      this.activeBrowsers.delete(id); // Remove reference anyway
    }
  }

  /**
   * 🧹 Close all browsers
   */
  async closeAllBrowsers(): Promise<void> {
    console.log('🧹 Closing all managed browsers...');
    
    const closurePromises = Array.from(this.activeBrowsers.keys()).map(id => 
      this.closeBrowser(id)
    );
    
    await Promise.allSettled(closurePromises);
    this.activeBrowsers.clear();
    
    // Force cleanup
    await this.resourceMonitor.forceCleanup();
    console.log('✅ All browsers closed and cleaned up');
  }

  /**
   * 🔥 Force aggressive resource cleanup for EAGAIN recovery
   */
  private async forceResourceCleanup(): Promise<void> {
    try {
      console.log('🔥 Force resource cleanup initiated...');
      
      // Close all active browsers
      for (const [id, browser] of this.activeBrowsers.entries()) {
        try {
          await browser.close();
          console.log(`🧹 Force closed browser: ${id}`);
        } catch (error) {
          console.log(`⚠️ Error force-closing browser ${id}:`, error.message);
        }
      }
      this.activeBrowsers.clear();

      // Aggressive OS-level cleanup
      await this.resourceMonitor.aggressiveCleanup();
      
      // Give Railway time to recover file descriptors and processes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ Force resource cleanup completed');
    } catch (error) {
      console.error('❌ Error during force resource cleanup:', error);
    }
  }

  /**
   * 📊 Get browser status
   */
  getStatus(): { activeBrowsers: number; browserIds: string[] } {
    return {
      activeBrowsers: this.activeBrowsers.size,
      browserIds: Array.from(this.activeBrowsers.keys())
    };
  }

  /**
   * 🔄 Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        console.log('🧹 Periodic browser cleanup...');
        
        // Check for dead browsers and remove them
        for (const [id, browser] of this.activeBrowsers.entries()) {
          try {
            // Test if browser is still alive
            await browser.version();
          } catch (error) {
            console.log(`🧹 Removing dead browser: ${id}`);
            this.activeBrowsers.delete(id);
          }
        }
        
        // Force system cleanup if too many browsers
        if (this.activeBrowsers.size > 3) {
          console.log('🧹 Too many browsers, forcing cleanup...');
          await this.resourceMonitor.forceCleanup();
        }
        
      } catch (error) {
        console.log('⚠️ Periodic cleanup error');
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * 💣 Emergency shutdown
   */
  async emergencyShutdown(): Promise<void> {
    console.log('💣 EMERGENCY BROWSER SHUTDOWN');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    await this.closeAllBrowsers();
    await this.resourceMonitor.aggressiveCleanup();
  }

  /**
   * 🚀 Launch browser with automatic cleanup
   */
  async withManagedBrowser<T>(
    operation: (browser: Browser, page: Page) => Promise<T>,
    id: string = `temp_${Date.now()}`
  ): Promise<T | null> {
    let result: T | null = null;
    
    try {
      const browserData = await this.launchBrowser(id);
      if (!browserData) {
        return null;
      }
      
      const { browser, page } = browserData;
      result = await operation(browser, page);
      
    } catch (error) {
      console.error(`❌ Managed browser operation failed:`, error);
    } finally {
      // Always cleanup
      await this.closeBrowser(id);
    }
    
    return result;
  }
}

// Export singleton instance
export const railwayBrowserManager = RailwayBrowserManager.getInstance();
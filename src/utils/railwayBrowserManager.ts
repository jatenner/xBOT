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
   * 🚀 Launch a managed browser instance
   */
  async launchBrowser(id: string = 'default'): Promise<{ browser: Browser; page: Page } | null> {
    try {
      console.log(`🚀 Launching managed browser: ${id}`);
      
      // Check if we can safely launch
      const canLaunch = await this.resourceMonitor.canLaunchBrowser();
      if (!canLaunch.canLaunch) {
        console.log(`❌ Cannot launch browser: ${canLaunch.reason}`);
        return null;
      }

      // Close existing browser with same ID if exists
      await this.closeBrowser(id);

      // Launch new browser with Railway-optimized settings
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
          '--max_old_space_size=384',
          '--single-process'
        ],
        chromiumSandbox: false,
        timeout: 30000
      });

      // Create page with minimal resource usage
      const page = await browser.newPage({
        viewport: { width: 800, height: 600 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Store reference for cleanup
      this.activeBrowsers.set(id, browser);

      console.log(`✅ Browser launched successfully: ${id}`);
      return { browser, page };

    } catch (error) {
      console.error(`❌ Failed to launch browser ${id}:`, error);
      await this.resourceMonitor.aggressiveCleanup();
      return null;
    }
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
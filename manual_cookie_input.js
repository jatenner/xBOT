const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🍪 MANUAL COOKIE INPUT');
console.log('=====================');

const cookies = {};

function askForCookie(name, description) {
    return new Promise(resolve => {
        rl.question(`Enter ${name} cookie (${description}): `, (value) => {
            cookies[name] = value.trim();
            resolve();
        });
    });
}

async function collectCookies() {
    await askForCookie('auth_token', 'long authentication token');
    await askForCookie('ct0', 'CSRF token');
    await askForCookie('twid', 'Twitter ID');
    
    rl.close();
    
    // Create session
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
            }
        ],
        timestamp: new Date().toISOString(),
        method: 'manual_emergency',
        stealth: true
    };
    
    const base64Session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    
    fs.writeFileSync('manual_emergency_session_b64.txt', base64Session);
    
    console.log('');
    console.log('✅ EMERGENCY SESSION CREATED!');
    console.log(`   Length: ${base64Session.length} chars`);
    console.log(`   File: manual_emergency_session_b64.txt`);
    console.log('');
    console.log('🚂 DEPLOYING TO RAILWAY...');
    
    // Deploy to Railway
    const { execSync } = require('child_process');
    try {
        execSync(`railway variables set TWITTER_SESSION_B64="${base64Session}"`);
        execSync('railway variables set STEALTH_MODE="true"');
        execSync('railway variables set MANUAL_SESSION="true"');
        execSync('railway deploy');
        
        console.log('🎉 DEPLOYMENT SUCCESSFUL!');
        console.log('   Your bot should be working within 3 minutes');
        console.log('   Check: railway logs');
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        console.log('   Manual deployment required via Railway dashboard');
    }
}

collectCookies();

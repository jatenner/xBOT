const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🔐 AUTH_TOKEN ADDITION TOOL');
console.log('===========================');
console.log('');
console.log('Current session has 3 cookies but is missing auth_token');
console.log('');

rl.question('Paste your auth_token value here: ', (authToken) => {
    if (!authToken || authToken.length < 20) {
        console.log('❌ Invalid auth_token. Must be at least 20 characters.');
        rl.close();
        return;
    }
    
    try {
        // Load existing session
        const existingSession = fs.readFileSync('working_session_manual.txt', 'utf8').trim();
        const sessionData = JSON.parse(Buffer.from(existingSession, 'base64').toString());
        
        // Add auth_token cookie
        sessionData.cookies.push({
            name: 'auth_token',
            value: authToken,
            domain: '.x.com',
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Lax'
        });
        
        // Update metadata
        sessionData.timestamp = new Date().toISOString();
        sessionData.method = 'manual_with_auth_token';
        sessionData.complete = true;
        
        // Save complete session
        const completeBase64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        fs.writeFileSync('complete_working_session.txt', completeBase64);
        
        console.log('');
        console.log('✅ COMPLETE SESSION CREATED!');
        console.log(`   Length: ${completeBase64.length} chars`);
        console.log(`   Cookies: ${sessionData.cookies.length} (including auth_token)`);
        console.log('   File: complete_working_session.txt');
        console.log('');
        console.log('🚂 DEPLOYING TO RAILWAY...');
        
        // Deploy immediately
        const { execSync } = require('child_process');
        execSync(`railway variables --set "TWITTER_SESSION_B64=${completeBase64}"`);
        execSync('railway redeploy');
        
        console.log('🎉 DEPLOYMENT COMPLETE!');
        console.log('   Your bot should start posting within 2 minutes');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    rl.close();
});

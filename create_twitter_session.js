#!/usr/bin/env node

/**
 * 🔑 TWITTER SESSION CREATOR
 * Interactive script to create and upload Twitter session to Railway
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔑 === TWITTER SESSION CREATOR ===\n');

async function checkLocalSession() {
    const sessionPath = './data/twitter_session.json';
    
    console.log('📋 Step 1: Checking for existing local session...');
    
    if (fs.existsSync(sessionPath)) {
        try {
            const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
            const cookieCount = sessionData.cookies ? sessionData.cookies.length : 0;
            const hasTimestamp = !!sessionData.timestamp;
            const ageHours = hasTimestamp ? (Date.now() - sessionData.timestamp) / (1000 * 60 * 60) : 999;
            
            console.log(`✅ Local session found!`);
            console.log(`   📊 Cookies: ${cookieCount}`);
            console.log(`   ⏰ Age: ${Math.floor(ageHours)} hours`);
            console.log(`   📍 Path: ${sessionPath}\n`);
            
            if (cookieCount > 10 && ageHours < 24) {
                console.log('✅ Session appears fresh and ready for upload!\n');
                return { exists: true, valid: true, path: sessionPath };
            } else if (cookieCount > 10 && ageHours >= 24) {
                console.log('⚠️ Session exists but is over 24 hours old\n');
                console.log('💡 Recommendation: Generate a fresh session\n');
                return { exists: true, valid: false, reason: 'aged', path: sessionPath };
            } else {
                console.log('❌ Session exists but appears invalid (too few cookies)\n');
                return { exists: true, valid: false, reason: 'invalid', path: sessionPath };
            }
            
        } catch (error) {
            console.log(`❌ Session file exists but has invalid JSON format`);
            console.log(`   Error: ${error.message}\n`);
            return { exists: true, valid: false, reason: 'corrupt', path: sessionPath };
        }
    } else {
        console.log('❌ No local session found\n');
        return { exists: false, valid: false, path: sessionPath };
    }
}

async function generateNewSession() {
    console.log('🔄 Step 2: Generating new Twitter session...\n');
    
    console.log('🚀 Running: npm run init-session');
    console.log('💡 This will open a browser window for Twitter login\n');
    
    return new Promise((resolve, reject) => {
        const process = spawn('npm', ['run', 'init-session'], {
            stdio: 'inherit',
            shell: true
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                console.log('\n✅ Session generation completed!');
                resolve(true);
            } else {
                console.log(`\n❌ Session generation failed with code ${code}`);
                reject(new Error(`Process exited with code ${code}`));
            }
        });
        
        process.on('error', (error) => {
            console.log(`\n❌ Session generation error: ${error.message}`);
            reject(error);
        });
    });
}

async function uploadToRailway(sessionPath) {
    console.log('\n📤 Step 3: Upload to Railway...\n');
    
    console.log('📋 UPLOAD OPTIONS:\n');
    
    console.log('🔧 OPTION A: Environment Variable (Recommended)');
    console.log('   1. Copy the content below:');
    
    try {
        const sessionContent = fs.readFileSync(sessionPath, 'utf8');
        const compactJson = JSON.stringify(JSON.parse(sessionContent));
        
        console.log('\n   📋 COPY THIS EXACT TEXT:');
        console.log('   ┌─────────────────────────────────────');
        console.log(`   │ ${compactJson}`);
        console.log('   └─────────────────────────────────────\n');
        
        console.log('   2. In Railway dashboard:');
        console.log('      - Go to your project');
        console.log('      - Click "Variables" tab');
        console.log('      - Click "New Variable"');
        console.log('      - Name: TWITTER_SESSION_DATA');
        console.log('      - Value: [paste the JSON above]');
        console.log('      - Click "Add"');
        console.log('      - Click "Deploy" to restart\n');
        
    } catch (error) {
        console.log(`   ❌ Error reading session file: ${error.message}\n`);
        return false;
    }
    
    console.log('🔧 OPTION B: File Upload (Alternative)');
    console.log('   1. Use Railway CLI:');
    console.log(`      railway run cp ${sessionPath} /app/data/twitter_session.json`);
    console.log('   2. Or use Railway dashboard file manager\n');
    
    console.log('✅ After upload, the bot should automatically detect the session!');
    console.log('📊 Monitor with: npm run logs\n');
    
    return true;
}

async function verifyUpload() {
    console.log('🔍 Step 4: Verification...\n');
    
    console.log('After uploading to Railway, you should see in the logs:');
    console.log('   ✅ Twitter session loaded successfully');
    console.log('   ✅ Session is fresh (X hours old)');
    console.log('   ✅ Loaded X session cookies\n');
    
    console.log('If posting still fails:');
    console.log('   1. Check session age (should be < 24 hours)');
    console.log('   2. Verify JSON format is correct');
    console.log('   3. Try generating a new session\n');
    
    console.log('🔧 Helpful commands:');
    console.log('   npm run logs         # Monitor Railway');
    console.log('   node session_health_check.js  # Check session status');
    console.log('   node trigger_immediate_post.js # Test posting\n');
}

async function main() {
    try {
        // Step 1: Check existing session
        const sessionStatus = await checkLocalSession();
        
        // Step 2: Generate if needed
        if (!sessionStatus.exists || !sessionStatus.valid) {
            console.log('🔄 Generating new session...\n');
            await generateNewSession();
            
            // Recheck after generation
            const newSessionStatus = await checkLocalSession();
            if (!newSessionStatus.valid) {
                console.log('❌ Session generation may have failed');
                console.log('💡 Try running manually: npm run init-session\n');
                process.exit(1);
            }
        }
        
        // Step 3: Upload instructions
        await uploadToRailway(sessionStatus.path);
        
        // Step 4: Verification guide
        await verifyUpload();
        
        console.log('🏁 Session creation process complete!');
        console.log('🚀 Your Twitter bot should now be able to post successfully!');
        
    } catch (error) {
        console.error('❌ Session creation failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Ensure Twitter credentials are correct');
        console.log('   2. Try clearing browser cache and retry');
        console.log('   3. Check for 2FA or account restrictions');
        process.exit(1);
    }
}

main();
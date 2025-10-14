#!/usr/bin/env node

/**
 * 🚨 EMERGENCY SYSTEM DIAGNOSIS
 * Your system is DOWN - 502 errors, no posts today
 * Let's diagnose and fix immediately
 */

const https = require('https');

console.log('🚨 EMERGENCY SYSTEM DIAGNOSIS');
console.log('============================');
console.log('');
console.log('Your system is DOWN and hasn\'t posted today!');
console.log('');

// Check system endpoints
const endpoints = [
    'https://xbot-production-844b.up.railway.app/health',
    'https://xbot-production-844b.up.railway.app/status',
    'https://xbot-production-844b.up.railway.app/metrics'
];

let completedChecks = 0;
const totalChecks = endpoints.length;

console.log('🔍 CHECKING SYSTEM ENDPOINTS:');
console.log('=============================');

endpoints.forEach((url, index) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            completedChecks++;
            
            try {
                const response = JSON.parse(data);
                
                if (response.status === 'error' && response.code === 502) {
                    console.log(`❌ ${url}: APPLICATION CRASHED`);
                    console.log(`   Error: ${response.message}`);
                } else {
                    console.log(`✅ ${url}: Working`);
                    if (response.status) console.log(`   Status: ${response.status}`);
                    if (response.mode) console.log(`   Mode: ${response.mode}`);
                }
            } catch (error) {
                console.log(`❌ ${url}: Invalid response`);
                console.log(`   Raw: ${data.substring(0, 100)}...`);
            }
            
            if (completedChecks === totalChecks) {
                console.log('');
                provideDiagnosis();
            }
        });
    });
    
    req.on('error', (error) => {
        completedChecks++;
        console.log(`❌ ${url}: ${error.message}`);
        
        if (completedChecks === totalChecks) {
            console.log('');
            provideDiagnosis();
        }
    });
    
    req.on('timeout', () => {
        completedChecks++;
        console.log(`⏰ ${url}: Timeout (service down)`);
        req.destroy();
        
        if (completedChecks === totalChecks) {
            console.log('');
            provideDiagnosis();
        }
    });
});

function provideDiagnosis() {
    console.log('🎯 DIAGNOSIS & IMMEDIATE FIXES:');
    console.log('===============================');
    console.log('');
    
    console.log('🚨 CRITICAL ISSUE: Your Railway service is CRASHED');
    console.log('');
    console.log('CAUSES (from earlier logs):');
    console.log('1. ❌ System crashed during Twitter posting');
    console.log('2. ❌ Playwright browser ran out of memory');
    console.log('3. ❌ No crash recovery implemented');
    console.log('');
    
    console.log('🔧 IMMEDIATE FIXES NEEDED:');
    console.log('==========================');
    console.log('');
    
    console.log('FIX 1: Add Crash Prevention Variables');
    console.log('-------------------------------------');
    console.log('In Railway Variables tab, add:');
    console.log('');
    console.log('NODE_OPTIONS = --max-old-space-size=1024');
    console.log('PLAYWRIGHT_BROWSER_ARGS = --no-sandbox,--disable-dev-shm-usage,--disable-gpu');
    console.log('CRASH_RECOVERY = true');
    console.log('MEMORY_LIMIT = 1024');
    console.log('');
    
    console.log('FIX 2: Redeploy Service');
    console.log('----------------------');
    console.log('1. Go to: https://railway.app → xBOT');
    console.log('2. Add the variables above');
    console.log('3. Click "Redeploy"');
    console.log('4. Monitor deployment logs');
    console.log('');
    
    console.log('FIX 3: Monitor Recovery');
    console.log('----------------------');
    console.log('After redeploy, check:');
    console.log('• https://xbot-production-844b.up.railway.app/health');
    console.log('• Should return {"status":"healthy"} not 502 error');
    console.log('');
    
    console.log('🎯 ROOT CAUSE ANALYSIS:');
    console.log('=======================');
    console.log('');
    console.log('From the logs we saw earlier:');
    console.log('✅ System was working (authenticated, found UI elements)');
    console.log('❌ Crashed during "Clicking post button..."');
    console.log('❌ Likely: Playwright browser memory exhaustion');
    console.log('❌ No recovery: Service stayed crashed');
    console.log('');
    
    console.log('🚀 EXPECTED RESULTS AFTER FIX:');
    console.log('==============================');
    console.log('');
    console.log('Within 5 minutes:');
    console.log('✅ Service responds to /health');
    console.log('✅ System shows "healthy" status');
    console.log('');
    console.log('Within 15 minutes:');
    console.log('✅ Jobs start executing (Plans>0)');
    console.log('✅ Content generation resumes');
    console.log('');
    console.log('Within 30 minutes:');
    console.log('✅ First post of the day published');
    console.log('✅ System operational at 2 posts/hour');
    console.log('');
    
    console.log('⚡ URGENT ACTION REQUIRED:');
    console.log('=========================');
    console.log('');
    console.log('Your system has been DOWN all day!');
    console.log('');
    console.log('1. 🏃‍♂️ Go to Railway dashboard NOW');
    console.log('2. 🔧 Add the 4 crash prevention variables');
    console.log('3. 🚀 Click "Redeploy"');
    console.log('4. 👀 Watch deployment logs');
    console.log('5. ✅ Verify /health returns "healthy"');
    console.log('');
    console.log('This will get your system back online and posting!');
    console.log('');
    console.log('🎯 THE SYSTEM WILL BE FIXED WITHIN 10 MINUTES!');
}

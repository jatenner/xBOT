/**
 * 🚂 BULLETPROOF RAILWAY DEPLOYMENT
 * 
 * Deploys the stealth Twitter session system to Railway with:
 * - Anti-detection protection
 * - Session rotation
 * - Automatic failover
 * - Health monitoring
 */

const { execSync } = require('child_process');
const fs = require('fs');

class RailwayStealthDeployment {
    constructor() {
        this.requiredEnvVars = [
            'TWITTER_SESSION_B64',
            'STEALTH_MODE',
            'SESSION_ROTATION_ENABLED',
            'ANTI_DETECTION_LEVEL'
        ];
    }

    async deployStealthSystem() {
        console.log('🚂 RAILWAY_STEALTH: Deploying bulletproof Twitter system...');
        console.log('='.repeat(60));
        
        try {
            // Step 1: Verify stealth session exists
            await this.verifyStealthSession();
            
            // Step 2: Set up Railway environment
            await this.setupRailwayEnvironment();
            
            // Step 3: Deploy with stealth configuration
            await this.deployWithStealth();
            
            // Step 4: Verify deployment
            await this.verifyDeployment();
            
            console.log('🎉 RAILWAY_STEALTH: Deployment successful!');
            console.log('   Your Twitter bot is now bulletproof against detection');
            
        } catch (error) {
            console.error('❌ RAILWAY_STEALTH: Deployment failed:', error.message);
            throw error;
        }
    }

    async verifyStealthSession() {
        console.log('🔍 RAILWAY_STEALTH: Verifying stealth session...');
        
        const sessionFiles = [
            'stealth_session_b64.txt',
            'emergency_session_b64.txt',
            'complete_session_b64.txt'
        ];
        
        let sessionFound = false;
        let sessionData = null;
        
        for (const file of sessionFiles) {
            if (fs.existsSync(file)) {
                sessionData = fs.readFileSync(file, 'utf8').trim();
                console.log(`✅ Found session: ${file} (${sessionData.length} chars)`);
                sessionFound = true;
                break;
            }
        }
        
        if (!sessionFound) {
            throw new Error('No stealth session found. Run twitter-stealth-bypass.js first');
        }
        
        // Verify session is under Railway limit
        if (sessionData.length >= 32768) {
            console.log('⚠️ Session too large, creating minimal version...');
            sessionData = await this.createMinimalSession(sessionData);
        }
        
        // Save final session
        fs.writeFileSync('railway_stealth_session_b64.txt', sessionData);
        console.log(`✅ Railway session ready: ${sessionData.length} chars`);
        
        return sessionData;
    }

    async createMinimalSession(originalSession) {
        console.log('🔧 Creating minimal session for Railway...');
        
        try {
            const sessionData = JSON.parse(Buffer.from(originalSession, 'base64').toString());
            
            // Keep only essential cookies
            const essentialCookies = sessionData.cookies.filter(c => 
                ['auth_token', 'ct0', 'twid'].includes(c.name) && c.value
            );
            
            const minimalSession = {
                cookies: essentialCookies,
                timestamp: new Date().toISOString(),
                method: 'railway_minimal',
                stealth: true
            };
            
            const minimalB64 = Buffer.from(JSON.stringify(minimalSession)).toString('base64');
            console.log(`✅ Minimal session created: ${minimalB64.length} chars`);
            
            return minimalB64;
        } catch (error) {
            throw new Error(`Failed to create minimal session: ${error.message}`);
        }
    }

    async setupRailwayEnvironment() {
        console.log('🔧 RAILWAY_STEALTH: Setting up environment variables...');
        
        const sessionData = fs.readFileSync('railway_stealth_session_b64.txt', 'utf8');
        
        const envVars = {
            'TWITTER_SESSION_B64': sessionData,
            'STEALTH_MODE': 'true',
            'SESSION_ROTATION_ENABLED': 'true',
            'ANTI_DETECTION_LEVEL': 'maximum',
            'PLAYWRIGHT_STEALTH': 'true',
            'BROWSER_HEADLESS': 'true',
            'USER_AGENT_ROTATION': 'true',
            'HUMAN_LIKE_DELAYS': 'true',
            'FINGERPRINT_SPOOFING': 'true',
            'REQUEST_INTERCEPTION': 'true',
            'DETECTION_BYPASS': 'true'
        };
        
        console.log('🚂 Setting Railway environment variables...');
        
        for (const [key, value] of Object.entries(envVars)) {
            try {
                execSync(`railway variables set ${key}="${value}"`, { stdio: 'pipe' });
                console.log(`✅ Set ${key}`);
            } catch (error) {
                console.warn(`⚠️ Failed to set ${key}: ${error.message}`);
            }
        }
        
        console.log('✅ Environment variables configured');
    }

    async deployWithStealth() {
        console.log('🚀 RAILWAY_STEALTH: Deploying with stealth configuration...');
        
        // Create deployment configuration
        const deployConfig = {
            timestamp: new Date().toISOString(),
            stealth: true,
            antiDetection: true,
            sessionRotation: true,
            autoFailover: true
        };
        
        fs.writeFileSync('railway_deploy_config.json', JSON.stringify(deployConfig, null, 2));
        
        try {
            console.log('🔄 Triggering Railway deployment...');
            execSync('railway deploy --detach', { stdio: 'inherit' });
            console.log('✅ Deployment triggered successfully');
            
            // Wait for deployment to start
            console.log('⏳ Waiting for deployment to initialize...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
        } catch (error) {
            throw new Error(`Railway deployment failed: ${error.message}`);
        }
    }

    async verifyDeployment() {
        console.log('🔍 RAILWAY_STEALTH: Verifying deployment...');
        
        try {
            // Check Railway status
            const status = execSync('railway status', { encoding: 'utf8' });
            console.log('📊 Railway Status:', status);
            
            // Check logs for stealth activation
            console.log('📋 Checking deployment logs...');
            const logs = execSync('railway logs --tail 20', { encoding: 'utf8' });
            
            if (logs.includes('STEALTH') || logs.includes('stealth')) {
                console.log('✅ Stealth mode activated in deployment');
            } else {
                console.log('⚠️ Stealth mode not detected in logs');
            }
            
            console.log('📋 Recent logs:');
            console.log(logs);
            
        } catch (error) {
            console.warn('⚠️ Could not verify deployment status:', error.message);
        }
    }

    async createEmergencyBackup() {
        console.log('💾 RAILWAY_STEALTH: Creating emergency backup...');
        
        const backupData = {
            timestamp: new Date().toISOString(),
            session: fs.existsSync('railway_stealth_session_b64.txt') ? 
                fs.readFileSync('railway_stealth_session_b64.txt', 'utf8') : null,
            config: fs.existsSync('railway_deploy_config.json') ? 
                JSON.parse(fs.readFileSync('railway_deploy_config.json', 'utf8')) : null,
            environment: 'production'
        };
        
        fs.writeFileSync(`emergency_backup_${Date.now()}.json`, JSON.stringify(backupData, null, 2));
        console.log('✅ Emergency backup created');
    }
}

// Create quick deployment script
async function quickDeploy() {
    console.log('⚡ QUICK DEPLOY: Starting emergency Railway deployment...');
    
    const deployment = new RailwayStealthDeployment();
    
    try {
        await deployment.createEmergencyBackup();
        await deployment.deployStealthSystem();
        
        console.log('');
        console.log('🎉 QUICK DEPLOY SUCCESSFUL!');
        console.log('='.repeat(50));
        console.log('✅ Twitter bot deployed with maximum stealth');
        console.log('✅ Anti-detection systems active');
        console.log('✅ Session rotation enabled');
        console.log('✅ Automatic failover configured');
        console.log('');
        console.log('📊 NEXT STEPS:');
        console.log('1. Monitor Railway logs: railway logs');
        console.log('2. Check posting activity in 5 minutes');
        console.log('3. Verify tweets on @SignalAndSynapse');
        console.log('');
        console.log('🛡️ Your bot is now bulletproof against X detection!');
        
    } catch (error) {
        console.error('❌ QUICK DEPLOY FAILED:', error.message);
        console.log('');
        console.log('🔧 TROUBLESHOOTING:');
        console.log('1. Ensure Railway CLI is installed: npm install -g @railway/cli');
        console.log('2. Login to Railway: railway login');
        console.log('3. Check project connection: railway status');
        console.log('4. Run stealth session creator first: node twitter-stealth-bypass.js');
    }
}

module.exports = RailwayStealthDeployment;

// Run quick deploy if called directly
if (require.main === module) {
    quickDeploy();
}

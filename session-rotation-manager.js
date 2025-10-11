/**
 * 🔄 SESSION ROTATION & BACKUP SYSTEM
 * 
 * Implements multiple session management strategies to avoid detection:
 * - Session rotation every 24 hours
 * - Backup session pools
 * - Automatic failover
 * - Health monitoring
 */

const fs = require('fs');
const path = require('path');

class SessionRotationManager {
    constructor() {
        this.sessionsDir = './data/sessions';
        this.backupDir = './data/session_backups';
        this.currentSessionFile = './current_session_b64.txt';
        
        // Ensure directories exist
        this.ensureDirectories();
    }

    ensureDirectories() {
        [this.sessionsDir, this.backupDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async createSessionPool() {
        console.log('🔄 SESSION_POOL: Creating multiple backup sessions...');
        
        const TwitterStealthBypass = require('./twitter-stealth-bypass.js');
        const stealth = new TwitterStealthBypass();
        
        const sessions = [];
        const sessionCount = 3; // Create 3 backup sessions
        
        for (let i = 0; i < sessionCount; i++) {
            console.log(`🔄 Creating session ${i + 1}/${sessionCount}...`);
            
            try {
                const result = await stealth.bypassTwitterDetection();
                if (result.success) {
                    const sessionId = `session_${Date.now()}_${i}`;
                    const sessionData = {
                        id: sessionId,
                        base64: result.session,
                        created: new Date().toISOString(),
                        cookieCount: result.cookieCount,
                        status: 'active',
                        lastUsed: null,
                        failureCount: 0
                    };
                    
                    // Save session
                    fs.writeFileSync(
                        path.join(this.sessionsDir, `${sessionId}.json`),
                        JSON.stringify(sessionData, null, 2)
                    );
                    
                    sessions.push(sessionData);
                    console.log(`✅ Session ${i + 1} created successfully`);
                    
                    // Wait between sessions to avoid rate limiting
                    if (i < sessionCount - 1) {
                        console.log('⏳ Waiting 60 seconds before next session...');
                        await new Promise(resolve => setTimeout(resolve, 60000));
                    }
                } else {
                    console.log(`❌ Failed to create session ${i + 1}: ${result.error}`);
                }
            } catch (error) {
                console.log(`❌ Error creating session ${i + 1}: ${error.message}`);
            }
        }
        
        console.log(`🔄 SESSION_POOL: Created ${sessions.length} sessions`);
        return sessions;
    }

    getActiveSessions() {
        const sessions = [];
        
        if (fs.existsSync(this.sessionsDir)) {
            const files = fs.readdirSync(this.sessionsDir);
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const sessionData = JSON.parse(
                            fs.readFileSync(path.join(this.sessionsDir, file), 'utf8')
                        );
                        
                        if (sessionData.status === 'active' && sessionData.failureCount < 3) {
                            sessions.push(sessionData);
                        }
                    } catch (error) {
                        console.warn(`⚠️ Failed to load session ${file}: ${error.message}`);
                    }
                }
            }
        }
        
        return sessions.sort((a, b) => new Date(a.created) - new Date(b.created));
    }

    getCurrentSession() {
        if (fs.existsSync(this.currentSessionFile)) {
            return fs.readFileSync(this.currentSessionFile, 'utf8').trim();
        }
        return null;
    }

    rotateSession() {
        console.log('🔄 SESSION_ROTATION: Rotating to next available session...');
        
        const sessions = this.getActiveSessions();
        
        if (sessions.length === 0) {
            console.log('❌ No active sessions available for rotation');
            return false;
        }
        
        // Find the oldest unused session or least recently used
        const currentSession = this.getCurrentSession();
        let nextSession = sessions.find(s => s.base64 !== currentSession);
        
        if (!nextSession) {
            // All sessions have been used, pick the oldest
            nextSession = sessions[0];
        }
        
        // Update session metadata
        nextSession.lastUsed = new Date().toISOString();
        fs.writeFileSync(
            path.join(this.sessionsDir, `${nextSession.id}.json`),
            JSON.stringify(nextSession, null, 2)
        );
        
        // Set as current session
        fs.writeFileSync(this.currentSessionFile, nextSession.base64);
        
        console.log(`✅ Rotated to session: ${nextSession.id}`);
        console.log(`   Created: ${nextSession.created}`);
        console.log(`   Cookies: ${nextSession.cookieCount}`);
        
        return true;
    }

    markSessionFailed(sessionB64) {
        console.log('❌ SESSION_FAILURE: Marking session as failed...');
        
        const sessions = this.getActiveSessions();
        const failedSession = sessions.find(s => s.base64 === sessionB64);
        
        if (failedSession) {
            failedSession.failureCount = (failedSession.failureCount || 0) + 1;
            failedSession.lastFailure = new Date().toISOString();
            
            if (failedSession.failureCount >= 3) {
                failedSession.status = 'failed';
                console.log(`🚫 Session ${failedSession.id} marked as permanently failed`);
            }
            
            // Save updated session
            fs.writeFileSync(
                path.join(this.sessionsDir, `${failedSession.id}.json`),
                JSON.stringify(failedSession, null, 2)
            );
            
            // Auto-rotate to next session
            this.rotateSession();
        }
    }

    getSessionHealth() {
        const sessions = this.getActiveSessions();
        const totalSessions = fs.existsSync(this.sessionsDir) ? 
            fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.json')).length : 0;
        
        return {
            total: totalSessions,
            active: sessions.length,
            failed: totalSessions - sessions.length,
            current: this.getCurrentSession() ? 'loaded' : 'none',
            oldestSession: sessions.length > 0 ? sessions[0].created : null,
            newestSession: sessions.length > 0 ? sessions[sessions.length - 1].created : null
        };
    }

    async autoMaintenance() {
        console.log('🔧 SESSION_MAINTENANCE: Running automatic maintenance...');
        
        const health = this.getSessionHealth();
        console.log('📊 Session Health:', health);
        
        // If we have less than 2 active sessions, create more
        if (health.active < 2) {
            console.log('⚠️ Low session count, creating backup sessions...');
            await this.createSessionPool();
        }
        
        // Rotate session if current one is more than 24 hours old
        const currentSession = this.getCurrentSession();
        if (currentSession) {
            const sessions = this.getActiveSessions();
            const current = sessions.find(s => s.base64 === currentSession);
            
            if (current) {
                const age = Date.now() - new Date(current.lastUsed || current.created).getTime();
                const hoursSinceUsed = age / (1000 * 60 * 60);
                
                if (hoursSinceUsed > 24) {
                    console.log('🔄 Current session is over 24 hours old, rotating...');
                    this.rotateSession();
                }
            }
        }
        
        console.log('✅ SESSION_MAINTENANCE: Complete');
    }
}

module.exports = SessionRotationManager;

// Run maintenance if called directly
if (require.main === module) {
    const manager = new SessionRotationManager();
    manager.autoMaintenance().then(() => {
        console.log('🎉 Session maintenance completed');
    }).catch(error => {
        console.error('❌ Session maintenance failed:', error);
    });
}

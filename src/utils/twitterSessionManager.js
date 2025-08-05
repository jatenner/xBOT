/**
 * 🔑 TWITTER SESSION MANAGER
 * Manages Twitter authentication sessions for Railway
 */

import fs from 'fs';
import path from 'path';

export class TwitterSessionManager {
    
    constructor() {
        this.sessionPath = process.env.RAILWAY_ENVIRONMENT_NAME 
            ? '/app/data/twitter_session.json'
            : './data/twitter_session.json';
    }
    
    /**
     * Check if Twitter session exists
     */
    hasSession() {
        try {
            return fs.existsSync(this.sessionPath);
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Load Twitter session
     */
    loadSession() {
        try {
            if (!this.hasSession()) {
                console.log('⚠️ No Twitter session found');
                return null;
            }
            
            const sessionData = fs.readFileSync(this.sessionPath, 'utf8');
            const session = JSON.parse(sessionData);
            
            console.log('✅ Twitter session loaded successfully');
            return session;
            
        } catch (error) {
            console.error('❌ Error loading Twitter session:', error);
            return null;
        }
    }
    
    /**
     * Save Twitter session
     */
    saveSession(sessionData) {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.sessionPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.sessionPath, JSON.stringify(sessionData, null, 2));
            console.log('✅ Twitter session saved successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Error saving Twitter session:', error);
            return false;
        }
    }
    
    /**
     * Get session status for health checks
     */
    getSessionStatus() {
        const hasSession = this.hasSession();
        
        return {
            has_session: hasSession,
            session_path: this.sessionPath,
            status: hasSession ? 'available' : 'missing',
            environment: process.env.RAILWAY_ENVIRONMENT_NAME ? 'railway' : 'local'
        };
    }
    
    /**
     * Instructions for adding session to Railway
     */
    getSetupInstructions() {
        return [
            '🔧 TO ADD TWITTER SESSION TO RAILWAY:',
            '1. Run init-session locally to create twitter_session.json',
            '2. Copy the file content',
            '3. In Railway dashboard, add as environment variable:',
            '   TWITTER_SESSION_DATA=<paste_json_content>',
            '4. Update your app to load from environment variable',
            '',
            '📂 Expected local path: ./data/twitter_session.json',
            '📂 Expected Railway path: /app/data/twitter_session.json'
        ];
    }
}

export const twitterSession = new TwitterSessionManager();
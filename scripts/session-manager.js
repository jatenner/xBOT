#!/usr/bin/env node
/**
 * 🔐 CENTRALIZED SESSION MANAGER
 * 
 * Manages Twitter authentication sessions in a clean, organized way:
 * - One canonical location (.session/current/)
 * - Automatic archiving
 * - Validation & deployment
 * - Railway integration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SESSION_DIR = path.join(__dirname, '..', '.session');
const CURRENT_DIR = path.join(SESSION_DIR, 'current');
const ARCHIVE_DIR = path.join(SESSION_DIR, 'archive');

const PATHS = {
  session: path.join(CURRENT_DIR, 'session.json'),
  sessionB64: path.join(CURRENT_DIR, 'session.b64'),
  metadata: path.join(CURRENT_DIR, 'metadata.json')
};

// Ensure directories exist
[SESSION_DIR, CURRENT_DIR, ARCHIVE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

class SessionManager {
  
  /**
   * Extract session from DevTools cookie export
   */
  static extract(cookiesRawPath) {
    console.log('🍪 EXTRACTING SESSION FROM DEVTOOLS COOKIES\n');
    
    if (!fs.existsSync(cookiesRawPath)) {
      throw new Error(`Cookie file not found: ${cookiesRawPath}`);
    }
    
    const rawData = fs.readFileSync(cookiesRawPath, 'utf8');
    const lines = rawData.trim().split('\n');
    
    console.log(`📦 Parsing ${lines.length} lines of cookie data...`);
    
    const cookies = [];
    let hasAuthToken = false;
    let hasCt0 = false;
    
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      
      const name = parts[0].trim();
      const value = parts[1].trim();
      const domain = parts[2]?.trim() || '.x.com';
      const path = parts[3]?.trim() || '/';
      const expires = parts[4]?.trim();
      const httpOnly = parts[6]?.trim().toLowerCase() === 'true' || parts[6]?.trim() === '✓';
      const secure = parts[7]?.trim().toLowerCase() === 'true' || parts[7]?.trim() === '✓';
      const sameSite = parts[8]?.trim() || 'None';
      
      if (!name || !value) continue;
      
      if (name === 'auth_token') hasAuthToken = true;
      if (name === 'ct0') hasCt0 = true;
      
      let expiresTimestamp;
      if (expires && expires !== 'Session') {
        expiresTimestamp = Math.floor(new Date(expires).getTime() / 1000);
      } else {
        expiresTimestamp = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);
      }
      
      cookies.push({
        name,
        value,
        domain: domain.startsWith('.') ? domain : `.${domain}`,
        path,
        expires: expiresTimestamp,
        httpOnly,
        secure,
        sameSite: sameSite === 'Lax' ? 'Lax' : sameSite === 'Strict' ? 'Strict' : 'None'
      });
    }
    
    console.log(`✅ Parsed ${cookies.length} cookies\n`);
    
    // Validation
    if (!hasAuthToken) {
      throw new Error('CRITICAL: Missing auth_token! Session will not work.');
    }
    if (!hasCt0) {
      console.warn('⚠️  WARNING: Missing ct0 token\n');
    }
    
    // Archive current session if exists
    if (fs.existsSync(PATHS.session)) {
      this.archive();
    }
    
    // Save new session
    const session = { cookies, origins: [] };
    fs.writeFileSync(PATHS.session, JSON.stringify(session, null, 2));
    console.log(`💾 Saved session: ${PATHS.session}`);
    
    // Create base64
    const sessionB64 = Buffer.from(JSON.stringify(session)).toString('base64');
    fs.writeFileSync(PATHS.sessionB64, sessionB64);
    console.log(`💾 Created base64: ${PATHS.sessionB64}`);
    
    // Save metadata
    const metadata = {
      createdAt: new Date().toISOString(),
      cookieCount: cookies.length,
      hasAuthToken,
      hasCt0,
      cookieNames: cookies.map(c => c.name)
    };
    fs.writeFileSync(PATHS.metadata, JSON.stringify(metadata, null, 2));
    console.log(`💾 Saved metadata: ${PATHS.metadata}\n`);
    
    console.log('🔍 Session validation:');
    console.log(`   ✅ auth_token: ${hasAuthToken ? 'present' : 'MISSING'}`);
    console.log(`   ✅ ct0: ${hasCt0 ? 'present' : 'missing'}`);
    console.log(`   📊 Total cookies: ${cookies.length}\n`);
    
    return session;
  }
  
  /**
   * Deploy current session to Railway
   */
  static deploy() {
    console.log('🚀 DEPLOYING SESSION TO RAILWAY\n');
    
    if (!fs.existsSync(PATHS.sessionB64)) {
      throw new Error('No session found! Run session:extract first.');
    }
    
    const sessionB64 = fs.readFileSync(PATHS.sessionB64, 'utf8').trim();
    
    try {
      console.log('📤 Setting TWITTER_SESSION_B64 variable...');
      execSync(`railway variables --set TWITTER_SESSION_B64="${sessionB64}"`, { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      console.log('\n🔄 Restarting Railway service...');
      execSync('railway up --detach', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      console.log('\n✅ DEPLOYMENT COMPLETE!\n');
      console.log('📊 Next steps:');
      console.log('   1. Wait 30 seconds for restart');
      console.log('   2. Run: npm run logs');
      console.log('   3. Look for: "✅ Session loaded"');
      console.log('   4. System should post within 5-15 minutes\n');
      
    } catch (error) {
      console.error('\n❌ Deployment failed:', error.message);
      console.log('\n📋 Manual deployment:');
      console.log('   1. Copy base64 from:', PATHS.sessionB64);
      console.log('   2. Run: railway variables --set TWITTER_SESSION_B64="<paste>"');
      console.log('   3. Run: railway up --detach\n');
    }
  }
  
  /**
   * Show current session status
   */
  static status() {
    console.log('📊 SESSION STATUS\n');
    
    if (!fs.existsSync(PATHS.session)) {
      console.log('❌ No current session found\n');
      console.log('To create one: npm run session:extract\n');
      return;
    }
    
    const session = JSON.parse(fs.readFileSync(PATHS.session, 'utf8'));
    const metadata = fs.existsSync(PATHS.metadata) 
      ? JSON.parse(fs.readFileSync(PATHS.metadata, 'utf8'))
      : null;
    
    console.log('✅ Current session:');
    if (metadata) {
      console.log(`   Created: ${new Date(metadata.createdAt).toLocaleString()}`);
      console.log(`   Age: ${this.getAge(metadata.createdAt)}`);
      console.log(`   Cookies: ${metadata.cookieCount}`);
      console.log(`   auth_token: ${metadata.hasAuthToken ? '✅' : '❌'}`);
      console.log(`   ct0: ${metadata.hasCt0 ? '✅' : '❌'}`);
    } else {
      console.log(`   Cookies: ${session.cookies?.length || 0}`);
    }
    
    // Check archived sessions
    const archives = fs.readdirSync(ARCHIVE_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
    
    console.log(`\n📦 Archived sessions: ${archives.length}`);
    if (archives.length > 0) {
      console.log('   (Last 3):');
      archives.slice(0, 3).forEach(f => {
        console.log(`   - ${f}`);
      });
    }
    console.log();
  }
  
  /**
   * Archive current session
   */
  static archive() {
    if (!fs.existsSync(PATHS.session)) {
      console.log('⚠️  No current session to archive\n');
      return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').substring(0, 19);
    const archivePath = path.join(ARCHIVE_DIR, `session_${timestamp}.json`);
    
    fs.copyFileSync(PATHS.session, archivePath);
    console.log(`📦 Archived: ${archivePath}`);
  }
  
  /**
   * Clean old archives (keep last 5)
   */
  static cleanup() {
    console.log('🧹 CLEANING OLD ARCHIVES\n');
    
    const archives = fs.readdirSync(ARCHIVE_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(ARCHIVE_DIR, f),
        mtime: fs.statSync(path.join(ARCHIVE_DIR, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    const KEEP = 5;
    const toDelete = archives.slice(KEEP);
    
    if (toDelete.length === 0) {
      console.log(`✅ Only ${archives.length} archives (keeping all)\n`);
      return;
    }
    
    console.log(`Keeping ${KEEP} newest archives, deleting ${toDelete.length} old ones:\n`);
    
    toDelete.forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`   🗑️  Deleted: ${file.name}`);
    });
    
    console.log();
  }
  
  /**
   * Helper: Get human-readable age
   */
  static getAge(isoString) {
    const created = new Date(isoString);
    const now = new Date();
    const hours = Math.floor((now - created) / 3600000);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} days`;
    if (hours > 0) return `${hours} hours`;
    return 'just now';
  }
}

// CLI
const command = process.argv[2];

try {
  switch (command) {
    case 'extract':
      const cookiesPath = process.argv[3] || path.join(__dirname, '..', 'cookies_raw.txt');
      SessionManager.extract(cookiesPath);
      console.log('✨ Next step: npm run session:deploy\n');
      break;
      
    case 'deploy':
      SessionManager.deploy();
      break;
      
    case 'status':
      SessionManager.status();
      break;
      
    case 'archive':
      SessionManager.archive();
      console.log('✅ Session archived\n');
      break;
      
    case 'cleanup':
      SessionManager.cleanup();
      console.log('✅ Cleanup complete\n');
      break;
      
    default:
      console.log('🔐 SESSION MANAGER\n');
      console.log('Usage:');
      console.log('  npm run session:extract  - Extract cookies from DevTools');
      console.log('  npm run session:deploy   - Deploy to Railway');
      console.log('  npm run session:status   - Show session info');
      console.log('  npm run session:archive  - Archive current session');
      console.log('  npm run session:cleanup  - Remove old archives\n');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}


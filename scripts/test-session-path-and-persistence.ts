#!/usr/bin/env tsx
/**
 * 🧪 TEST SESSION PATH AND PERSISTENCE
 * 
 * Tests that session path resolution works correctly:
 * - Prints env var + resolved path
 * - Writes a marker file to confirm directory is writable
 * - Loads/saves storageState and prints file size change
 * - Exits non-zero if resolved path is not /data/... when /data exists
 */

import 'dotenv/config';
import { resolveSessionPath, getSessionPathInfo } from '../src/utils/sessionPathResolver';
import fs from 'fs';
import path from 'path';

async function testSessionPathAndPersistence() {
  console.log('🧪 Testing session path resolution and persistence...\n');
  
  // Step 1: Print env var
  const envVar = process.env.SESSION_CANONICAL_PATH;
  console.log(`📋 SESSION_CANONICAL_PATH env: ${envVar || '(not set)'}`);
  
  // Step 2: Get resolved path info
  const info = getSessionPathInfo();
  console.log(`📋 Resolved path: ${info.resolvedPath}`);
  console.log(`📋 File exists: ${info.exists}`);
  console.log(`📋 Directory writable: ${info.writable}`);
  if (info.exists) {
    console.log(`📋 File size: ${info.size} bytes`);
    console.log(`📋 Last modified: ${info.mtime}`);
  }
  console.log('');
  
  // Step 3: Check if /data exists
  const dataDirExists = fs.existsSync('/data') && fs.statSync('/data').isDirectory();
  console.log(`📁 /data directory exists: ${dataDirExists}`);
  
  // Step 4: Write marker file to confirm directory is writable
  const resolvedPath = resolveSessionPath();
  const dir = path.dirname(resolvedPath);
  const markerPath = path.join(dir, '.session_test_marker');
  
  try {
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
    
    // Write marker file
    fs.writeFileSync(markerPath, `test_marker_${Date.now()}\n`);
    console.log(`✅ Marker file written: ${markerPath}`);
    
    // Verify marker file exists
    if (fs.existsSync(markerPath)) {
      console.log(`✅ Marker file verified: ${markerPath}`);
      // Clean up
      fs.unlinkSync(markerPath);
      console.log(`✅ Marker file cleaned up`);
    } else {
      console.error(`❌ Marker file not found after write`);
      process.exit(1);
    }
  } catch (e: any) {
    console.error(`❌ Failed to write marker file: ${e.message}`);
    process.exit(1);
  }
  
  // Step 5: Test storageState load/save
  console.log('\n📦 Testing storageState load/save...');
  try {
    const { loadTwitterState } = await import('../src/playwright/twitterSession');
    const { UnifiedBrowserPool } = await import('../src/browser/UnifiedBrowserPool');
    
    const stateBefore = loadTwitterState();
    const sizeBefore = info.exists ? info.size : 0;
    
    console.log(`📊 State before: exists=${info.exists}, size=${sizeBefore}`);
    
    // Create a context and save state (if we have a browser pool)
    const pool = UnifiedBrowserPool.getInstance();
    await pool.withContext('test_session_path', async (context) => {
      const page = await context.newPage();
      await page.goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(2000);
      
      // Save state
      const { saveTwitterState } = await import('../src/playwright/twitterSession');
      const saved = await saveTwitterState(context);
      console.log(`💾 State saved: ${saved}`);
      
      if (saved) {
        const infoAfter = getSessionPathInfo();
        const sizeAfter = infoAfter.exists ? infoAfter.size : 0;
        console.log(`📊 State after: exists=${infoAfter.exists}, size=${sizeAfter}`);
        console.log(`📊 Size change: ${sizeAfter - sizeBefore} bytes`);
      }
    });
  } catch (e: any) {
    console.warn(`⚠️ StorageState test skipped: ${e.message}`);
  }
  
  // Step 6: Validation - if /data exists, path should be /data/twitter_session.json
  if (dataDirExists && !envVar) {
    // If /data exists and no explicit env var, should use /data/twitter_session.json
    if (!resolvedPath.startsWith('/data/')) {
      console.error(`\n❌ TEST FAILED: /data exists but resolved path is ${resolvedPath} (expected /data/twitter_session.json)`);
      process.exit(1);
    } else {
      console.log(`\n✅ TEST PASSED: /data exists and path correctly resolved to ${resolvedPath}`);
    }
  } else if (envVar) {
    console.log(`\n✅ TEST PASSED: Using explicit env var path: ${resolvedPath}`);
  } else {
    console.log(`\n✅ TEST PASSED: Using fallback path: ${resolvedPath}`);
  }
  
  console.log('\n📊 Summary:');
  console.log(`   Env var: ${envVar || '(not set)'}`);
  console.log(`   Resolved: ${resolvedPath}`);
  console.log(`   /data exists: ${dataDirExists}`);
  console.log(`   Directory writable: ${info.writable}`);
  console.log(`   File exists: ${info.exists}`);
}

testSessionPathAndPersistence().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

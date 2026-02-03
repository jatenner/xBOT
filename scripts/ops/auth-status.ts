#!/usr/bin/env tsx
/**
 * 🔐 AUTH STATUS (Phase 3)
 * 
 * Prints last known auth state from DB events and proof artifacts.
 * 
 * Usage:
 *   pnpm run ops:auth:status
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 EXECUTOR AUTH STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();

  // Get last EXECUTOR_AUTH_INVALID
  const { data: invalidAuth } = await supabase
    .from('system_events')
    .select('event_type, created_at, event_data')
    .eq('event_type', 'EXECUTOR_AUTH_INVALID')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get last EXECUTOR_AUTH_REQUIRED
  const { data: authRequired } = await supabase
    .from('system_events')
    .select('event_type, created_at, event_data')
    .eq('event_type', 'EXECUTOR_AUTH_REQUIRED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get last successful auth proof (EXECUTOR_AUTH_VERIFIED or auth-persistence PASS)
  const { data: verifiedAuth } = await supabase
    .from('system_events')
    .select('event_type, created_at, event_data')
    .eq('event_type', 'EXECUTOR_AUTH_VERIFIED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('📊 Database Events:\n');
  
  if (invalidAuth) {
    const data = typeof invalidAuth.event_data === 'string' 
      ? JSON.parse(invalidAuth.event_data) 
      : invalidAuth.event_data;
    console.log(`❌ Last EXECUTOR_AUTH_INVALID:`);
    console.log(`   Time: ${invalidAuth.created_at}`);
    console.log(`   Reason: ${data.reason || 'unknown'}`);
    console.log(`   URL: ${data.url || 'N/A'}\n`);
  } else {
    console.log(`✅ No EXECUTOR_AUTH_INVALID events found\n`);
  }

  if (authRequired) {
    const data = typeof authRequired.event_data === 'string' 
      ? JSON.parse(authRequired.event_data) 
      : authRequired.event_data;
    console.log(`⚠️  Last EXECUTOR_AUTH_REQUIRED:`);
    console.log(`   Time: ${authRequired.created_at}`);
    console.log(`   Reason: ${data.reason || 'unknown'}\n`);
  } else {
    console.log(`✅ No EXECUTOR_AUTH_REQUIRED events found\n`);
  }

  if (verifiedAuth) {
    const data = typeof verifiedAuth.event_data === 'string' 
      ? JSON.parse(verifiedAuth.event_data) 
      : verifiedAuth.event_data;
    console.log(`✅ Last EXECUTOR_AUTH_VERIFIED:`);
    console.log(`   Time: ${verifiedAuth.created_at}`);
    console.log(`   Handle: ${data.handle || 'unknown'}\n`);
  } else {
    console.log(`⚠️  No EXECUTOR_AUTH_VERIFIED events found\n`);
  }

  // Check proof artifacts
  const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
  console.log('📄 Proof Artifacts:\n');

  if (fs.existsSync(reportsDir)) {
    const reports = fs.readdirSync(reportsDir)
      .filter(f => f.startsWith('auth-persistence-') && f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 3);

    if (reports.length > 0) {
      console.log('Latest auth persistence reports:');
      reports.forEach(r => {
        const reportPath = path.join(reportsDir, r);
        const stats = fs.statSync(reportPath);
        console.log(`   ${reportPath}`);
        console.log(`   Modified: ${stats.mtime.toISOString()}`);
      });
    } else {
      console.log('   No auth persistence reports found');
    }

    const screenshots = fs.readdirSync(reportsDir)
      .filter(f => f.startsWith('auth-persistence-fail-') && f.endsWith('.png'))
      .sort()
      .reverse()
      .slice(0, 3);

    if (screenshots.length > 0) {
      console.log('\nLatest failure screenshots:');
      screenshots.forEach(s => {
        const screenshotPath = path.join(reportsDir, s);
        const stats = fs.statSync(screenshotPath);
        console.log(`   ${screenshotPath}`);
        console.log(`   Modified: ${stats.mtime.toISOString()}`);
      });
    }
  } else {
    console.log('   No proof artifacts directory found');
  }

  // Check AUTH_OK marker
  const { RUNNER_PROFILE_PATHS } = await import('../../src/infra/runnerProfile');
  const authOkPath = RUNNER_PROFILE_PATHS.authOk();
  console.log(`\n📋 AUTH_OK Marker:`);
  if (fs.existsSync(authOkPath)) {
    try {
      const content = fs.readFileSync(authOkPath, 'utf-8');
      const data = JSON.parse(content);
      console.log(`   ✅ Present: ${authOkPath}`);
      console.log(`   Handle: ${data.handle || 'N/A'}`);
      console.log(`   Timestamp: ${data.timestamp}`);
    } catch (e) {
      console.log(`   ⚠️  Present but unreadable: ${authOkPath}`);
    }
  } else {
    console.log(`   ❌ Missing: ${authOkPath}`);
  }

  console.log('');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

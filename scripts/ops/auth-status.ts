#!/usr/bin/env tsx
/**
 * 🔐 OPS:AUTH:STATUS - Auth Status Check
 * 
 * Prints last known auth state from DB events and local artifacts.
 * 
 * Usage:
 *   pnpm run ops:auth:status
 *   pnpm run ops:auth:status --one-line
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { getSupabaseClient } from '../../src/db/index';
import { getRunnerPaths } from '../../src/infra/runnerProfile';

const paths = getRunnerPaths();
const AUTH_OK_PATH = paths.auth_marker_path;
const REPORTS_DIR = path.join(process.cwd(), 'docs', 'proofs', 'auth');

const ONE_LINE = process.argv.includes('--one-line');

async function findLatestReport(pattern: string): Promise<string | null> {
  if (!fs.existsSync(REPORTS_DIR)) return null;
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.includes(pattern))
    .map(f => ({
      name: f,
      path: path.join(REPORTS_DIR, f),
      mtime: fs.statSync(path.join(REPORTS_DIR, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? files[0].path : null;
}

async function main(): Promise<void> {
  if (!ONE_LINE) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           🔐 AUTH STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
  
  const supabase = getSupabaseClient();
  
  // Query last auth events
  const { data: authInvalid } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'EXECUTOR_AUTH_INVALID')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const { data: authRequired } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'EXECUTOR_AUTH_REQUIRED')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const { data: authVerified } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'EXECUTOR_AUTH_VERIFIED')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const { data: authOk } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'EXECUTOR_AUTH_OK')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  // Check AUTH_OK marker
  let authOkData: any = null;
  if (fs.existsSync(AUTH_OK_PATH)) {
    try {
      const content = fs.readFileSync(AUTH_OK_PATH, 'utf-8');
      authOkData = JSON.parse(content);
    } catch (e) {
      // Ignore
    }
  }
  
  // Determine current status
  const now = Date.now();
  let status: 'OK' | 'DOWN' = 'OK';
  let reason: string | undefined;
  let lastUrl: string | undefined;
  let handle: string | undefined;
  let lastOkAge: number | undefined;
  
  // Check AUTH_OK marker first
  if (authOkData) {
    const authOkTime = new Date(authOkData.timestamp).getTime();
    lastOkAge = Math.floor((now - authOkTime) / 1000 / 60); // minutes
    handle = authOkData.handle;
    
    // Check if we have recent failures
    if (authInvalid && authInvalid.created_at) {
      const invalidTime = new Date(authInvalid.created_at).getTime();
      if (invalidTime > authOkTime) {
        status = 'DOWN';
        reason = authInvalid.event_data?.reason || 'auth_invalid';
        lastUrl = authInvalid.event_data?.url;
      }
    } else if (authRequired && authRequired.created_at) {
      const requiredTime = new Date(authRequired.created_at).getTime();
      if (requiredTime > authOkTime) {
        status = 'DOWN';
        reason = authRequired.event_data?.reason || 'auth_required';
        lastUrl = authRequired.event_data?.url;
      }
    }
  } else {
    status = 'DOWN';
    reason = 'AUTH_OK_marker_missing';
  }
  
  // Check latest verified event
  if (authVerified && authVerified.created_at) {
    const verifiedTime = new Date(authVerified.created_at).getTime();
    if (!authOkData || verifiedTime > new Date(authOkData.timestamp).getTime()) {
      const verifiedAge = Math.floor((now - verifiedTime) / 1000 / 60);
      if (verifiedAge < (lastOkAge || Infinity)) {
        lastOkAge = verifiedAge;
        handle = authVerified.event_data?.handle || handle;
      }
    }
  }
  
  if (ONE_LINE) {
    if (status === 'OK') {
      console.log(`AUTH=OK last_ok_age=${lastOkAge || 0}m handle=${handle || 'unknown'}`);
    } else {
      console.log(`AUTH=DOWN reason=${reason || 'unknown'} last_url=${lastUrl || 'N/A'} next=pnpm run ops:recover:x-auth`);
    }
    process.exit(status === 'OK' ? 0 : 1);
  }
  
  // Full output
  console.log(`📋 AUTH_OK Marker:`);
  if (authOkData) {
    console.log(`   ✅ EXISTS`);
    console.log(`   Handle: ${authOkData.handle || 'N/A'}`);
    console.log(`   Timestamp: ${authOkData.timestamp}`);
    console.log(`   Age: ${lastOkAge !== undefined ? `${lastOkAge} minutes` : 'N/A'}`);
  } else {
    console.log(`   ❌ MISSING`);
  }
  
  console.log(`\n📋 Latest Events:`);
  if (authOk && authOk.created_at) {
    console.log(`   EXECUTOR_AUTH_OK: ${authOk.created_at}`);
  }
  if (authVerified && authVerified.created_at) {
    console.log(`   EXECUTOR_AUTH_VERIFIED: ${authVerified.created_at}`);
  }
  if (authInvalid && authInvalid.created_at) {
    console.log(`   EXECUTOR_AUTH_INVALID: ${authInvalid.created_at}`);
    console.log(`   Reason: ${authInvalid.event_data?.reason || 'N/A'}`);
    console.log(`   URL: ${authInvalid.event_data?.url || 'N/A'}`);
  }
  if (authRequired && authRequired.created_at) {
    console.log(`   EXECUTOR_AUTH_REQUIRED: ${authRequired.created_at}`);
    console.log(`   Reason: ${authRequired.event_data?.reason || 'N/A'}`);
    console.log(`   URL: ${authRequired.event_data?.url || 'N/A'}`);
  }
  
  console.log(`\n📋 Latest Reports:`);
  const persistenceReport = await findLatestReport('auth-persistence');
  if (persistenceReport) {
    console.log(`   Auth Persistence: ${persistenceReport}`);
  }
  
  const cookieReport = await findLatestReport('cookie-persistence');
  if (cookieReport) {
    console.log(`   Cookie Persistence: ${cookieReport}`);
  }
  
  const screenshots = fs.existsSync(REPORTS_DIR)
    ? fs.readdirSync(REPORTS_DIR)
        .filter(f => f.includes('auth-persistence-fail') || f.includes('auth-repair-fail'))
        .map(f => path.join(REPORTS_DIR, f))
        .sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime())
        .slice(0, 3)
    : [];
  
  if (screenshots.length > 0) {
    console.log(`\n📋 Latest Screenshots:`);
    screenshots.forEach(s => console.log(`   ${s}`));
  }
  
  console.log(`\n📊 Status: ${status === 'OK' ? '✅ OK' : '❌ DOWN'}`);
  if (status === 'DOWN') {
    console.log(`   Reason: ${reason || 'unknown'}`);
    console.log(`   Next: pnpm run ops:recover:x-auth`);
  }
  
  console.log('');
}

if (require.main === module) {
  main().catch((error) => {
    if (ONE_LINE) {
      console.log(`AUTH=DOWN reason=fatal_error last_url=N/A next=pnpm run ops:recover:x-auth`);
    } else {
      console.error('❌ Fatal error:', error);
    }
    process.exit(1);
  });
}

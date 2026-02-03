#!/usr/bin/env tsx
/**
 * 🚪 GATE PROOFS (COOKIE AUTH)
 * 
 * Runs the two-gate proof sequence:
 * 1. 60-minute B64 auth persistence proof
 * 2. If PASS, run ops:up:fast with execution proof
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🚪 GATE PROOFS (COOKIE AUTH)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Load B64 from .env.local or process.env
  const envLocalPath = path.join(process.cwd(), '.env.local');
  let b64Value: string | undefined = process.env.TWITTER_SESSION_B64?.trim();
  
  if (!b64Value && fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf-8');
    // Try multiple patterns
    const patterns = [
      /^TWITTER_SESSION_B64=(.+)$/m,
      /^TWITTER_SESSION_B64="(.+)"$/m,
      /^TWITTER_SESSION_B64='(.+)'$/m,
    ];
    
    for (const pattern of patterns) {
      const match = envContent.match(pattern);
      if (match && match[1]) {
        b64Value = match[1].trim().replace(/^["']|["']$/g, '');
        break;
      }
    }
  }
  
  // Fallback: regenerate from cookies_input.json
  if (!b64Value) {
    const cookiesInputPath = path.join(process.cwd(), '.runner-profile', 'cookies_input.json');
    if (fs.existsSync(cookiesInputPath)) {
      try {
        const cookieData = JSON.parse(fs.readFileSync(cookiesInputPath, 'utf-8'));
        const cookies = cookieData.cookies || cookieData;
        const normalizedCookies = Array.isArray(cookies) ? cookies : [];
        
        // Duplicate for both domains
        const duplicated: any[] = [];
        for (const cookie of normalizedCookies) {
          duplicated.push(cookie);
          if (cookie.domain === '.x.com') {
            duplicated.push({ ...cookie, domain: '.twitter.com' });
          } else if (cookie.domain === '.twitter.com') {
            duplicated.push({ ...cookie, domain: '.x.com' });
          }
        }
        
        b64Value = Buffer.from(JSON.stringify({ cookies: duplicated })).toString('base64');
        console.log('📋 Regenerated TWITTER_SESSION_B64 from cookies_input.json\n');
      } catch (e) {
        // Ignore
      }
    }
  }
  
  if (!b64Value) {
    console.error('❌ TWITTER_SESSION_B64 not found');
    console.error('   Run: pnpm run ops:update:cookies');
    process.exit(1);
  }
  
  console.log(`✅ Found TWITTER_SESSION_B64 (${b64Value.length} chars)\n`);
  
  // GATE 1: 60-minute persistence proof
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           GATE 1: 60-MINUTE B64 AUTH PERSISTENCE PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    execSync('PROOF_DURATION_MINUTES=60 pnpm run executor:prove:auth-b64-persistence', {
      stdio: 'inherit',
      encoding: 'utf-8',
      env: {
        ...process.env,
        TWITTER_SESSION_B64: b64Value,
      },
    });
    
    console.log('\n✅ GATE 1 PASSED: 60-minute persistence proof successful\n');
    
  } catch (error: any) {
    // Find latest report
    const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
    const reports = fs.existsSync(reportsDir) 
      ? fs.readdirSync(reportsDir)
          .filter(f => f.includes('b64-auth-persistence') && f.endsWith('.md'))
          .map(f => ({
            name: f,
            path: path.join(reportsDir, f),
            mtime: fs.statSync(path.join(reportsDir, f)).mtime.getTime(),
          }))
          .sort((a, b) => b.mtime - a.mtime)
      : [];
    
    const latestReport = reports.length > 0 ? reports[0].path : null;
    
    // Find screenshots
    const screenshots = fs.existsSync(reportsDir)
      ? fs.readdirSync(reportsDir)
          .filter(f => f.includes('b64-auth-persistence-fail') && f.endsWith('.png'))
          .map(f => path.join(reportsDir, f))
      : [];
    
    console.log('\n❌ GATE 1 FAILED: 60-minute persistence proof failed\n');
    
    if (latestReport) {
      const reportContent = fs.readFileSync(latestReport, 'utf-8');
      const failureMatch = reportContent.match(/Failure Reason:\*\* (.+)/);
      const classification = failureMatch ? failureMatch[1] : 'unknown';
      
      console.log(`📋 Classification: ${classification}`);
      console.log(`📄 Report: ${latestReport}`);
      if (screenshots.length > 0) {
        console.log(`📸 Screenshots:`);
        screenshots.forEach(s => console.log(`   - ${s}`));
      }
    }
    
    console.log('\n🚪 STOPPING: Gate 1 failed, not proceeding to Gate 2');
    process.exit(1);
  }
  
  // GATE 2: ops:up:fast with execution proof
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           GATE 2: OPS:UP:FAST WITH EXECUTION PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    execSync('COOKIE_AUTH_MODE=true REQUIRE_EXECUTION_PROOF=true SOAK_MINUTES=20 pnpm run ops:up:fast', {
      stdio: 'inherit',
      encoding: 'utf-8',
      env: {
        ...process.env,
        TWITTER_SESSION_B64: b64Value,
      },
    });
    
    console.log('\n✅ GATE 2 PASSED: ops:up:fast with execution proof successful\n');
    
    // Check execution ledger for reply URL
    const ledgerPath = path.join(process.cwd(), 'docs', 'proofs', 'execution', 'execution-ledger.jsonl');
    if (fs.existsSync(ledgerPath)) {
      const lines = fs.readFileSync(ledgerPath, 'utf-8')
        .split('\n')
        .filter(l => l.trim().length > 0);
      
      if (lines.length > 0) {
        const lastEntry = JSON.parse(lines[lines.length - 1]);
        console.log('📋 Latest Execution Ledger Entry:');
        console.log(`   Proof Type: ${lastEntry.proof_type || 'N/A'}`);
        console.log(`   Target Tweet ID: ${lastEntry.target_tweet_id || 'N/A'}`);
        console.log(`   Decision ID: ${lastEntry.decision_id || 'N/A'}`);
        console.log(`   Passed: ${lastEntry.passed ? '✅ YES' : '❌ NO'}`);
        console.log(`   Failure Classification: ${lastEntry.failure_classification || 'N/A'}`);
        console.log(`   Reply URL: ${lastEntry.reply_url || 'N/A'}`);
        console.log(`   Time to Success: ${lastEntry.time_to_success_seconds || 'N/A'}s`);
        console.log(`   Report Path: ${lastEntry.report_path || 'N/A'}`);
        console.log('');
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ✅ ALL GATES PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    process.exit(0);
    
  } catch (error: any) {
    console.log('\n❌ GATE 2 FAILED: ops:up:fast with execution proof failed\n');
    
    // Check execution ledger
    const ledgerPath = path.join(process.cwd(), 'docs', 'proofs', 'execution', 'execution-ledger.jsonl');
    if (fs.existsSync(ledgerPath)) {
      const lines = fs.readFileSync(ledgerPath, 'utf-8')
        .split('\n')
        .filter(l => l.trim().length > 0);
      
      if (lines.length > 0) {
        const lastEntry = JSON.parse(lines[lines.length - 1]);
        console.log('📋 Latest Execution Ledger Entry:');
        console.log(`   Passed: ${lastEntry.passed ? '✅ YES' : '❌ NO'}`);
        console.log(`   Failure Classification: ${lastEntry.failure_classification || 'N/A'}`);
        console.log(`   Report Path: ${lastEntry.report_path || 'N/A'}`);
        console.log('');
      }
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

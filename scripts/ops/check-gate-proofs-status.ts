#!/usr/bin/env tsx
/**
 * Check status of running gate proofs
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
const executionLedgerPath = path.join(process.cwd(), 'docs', 'proofs', 'execution', 'execution-ledger.jsonl');

// Check if persistence proof is running
try {
  const result = execSync('ps aux | grep "prove-auth-b64-persistence" | grep -v grep', { encoding: 'utf-8' });
  if (result.trim()) {
    console.log('⏳ Gate 1 (60-minute persistence proof) is currently running...');
    console.log('   This will take approximately 60 minutes to complete.\n');
  }
} catch {
  // Not running
}

// Find latest persistence report
if (fs.existsSync(reportsDir)) {
  const reports = fs.readdirSync(reportsDir)
    .filter(f => f.includes('b64-auth-persistence') && f.endsWith('.md'))
    .map(f => ({
      name: f,
      path: path.join(reportsDir, f),
      mtime: fs.statSync(path.join(reportsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);
  
  if (reports.length > 0) {
    const latest = reports[0];
    const content = fs.readFileSync(latest.path, 'utf-8');
    
    console.log(`📄 Latest Persistence Report: ${latest.path}\n`);
    
    // Extract status
    const statusMatch = content.match(/\*\*Status:\*\* (.+)/);
    const minutesOkMatch = content.match(/Minutes OK:\*\* (\d+)/);
    const firstFailureMatch = content.match(/First Failure Minute:\*\* (.+)/);
    
    if (statusMatch) {
      console.log(`Status: ${statusMatch[1]}`);
    }
    if (minutesOkMatch) {
      console.log(`Minutes OK: ${minutesOkMatch[1]}`);
    }
    if (firstFailureMatch) {
      console.log(`First Failure Minute: ${firstFailureMatch[1]}`);
    }
    
    // Check for failure fingerprints
    if (content.includes('Failure Fingerprints')) {
      const fingerprintSection = content.split('Failure Fingerprints')[1]?.split('##')[0] || '';
      if (fingerprintSection.includes('###')) {
        console.log('\n⚠️  Failures detected - check report for details');
      }
    }
  }
}

// Check execution ledger
if (fs.existsSync(executionLedgerPath)) {
  const lines = fs.readFileSync(executionLedgerPath, 'utf-8')
    .split('\n')
    .filter(l => l.trim().length > 0);
  
  if (lines.length > 0) {
    const lastEntry = JSON.parse(lines[lines.length - 1]);
    console.log('\n📋 Latest Execution Ledger Entry:');
    console.log(`   Proof Type: ${lastEntry.proof_type || 'N/A'}`);
    console.log(`   Passed: ${lastEntry.passed ? '✅ YES' : '❌ NO'}`);
    console.log(`   Reply URL: ${lastEntry.reply_url || 'N/A'}`);
    console.log(`   Failure Classification: ${lastEntry.failure_classification || 'N/A'}`);
  }
}

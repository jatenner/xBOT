#!/usr/bin/env tsx
/**
 * CI Validation: Proof Scripts and System Events
 * 
 * Validates that:
 * 1. Proof scripts exist and have DRY_RUN default + EXECUTE_REAL_ACTION gating
 * 2. Required system_event types are present in codebase
 * 3. Documentation claims match evidence files
 */

import * as fs from 'fs';
import * as path from 'path';

const PROOF_SCRIPTS = [
  'scripts/executor/prove-e2e-control-to-post.ts',
  'scripts/executor/prove-e2e-control-to-reply.ts',
];

const REQUIRED_SYSTEM_EVENTS = [
  'EXECUTOR_DAEMON_BOOT',
  'EXECUTOR_DAEMON_READY',
  'EXECUTOR_DAEMON_EXIT',
  'EXECUTOR_DAEMON_CRASH',
  'EXECUTOR_DECISION_CLAIM_ATTEMPT',
  'EXECUTOR_DECISION_CLAIM_OK',
  'EXECUTOR_DECISION_CLAIM_FAIL',
  'EXECUTOR_PROOF_POST_SELECTED',
  'EXECUTOR_PROOF_POST_CANDIDATE_FOUND',
  'EXECUTOR_PROOF_POST_SKIPPED',
  'EXECUTOR_PROOF_POST_CLAIM_STALL',
];

const PROOF_REPORTS = {
  'Level 4.*POST': 'docs/CONTROL_TO_POST_PROOF.md',
  'Level 4.*REPLY': 'docs/CONTROL_TO_REPLY_PROOF.md',
};

let errors: string[] = [];
let warnings: string[] = [];

function validateProofScript(scriptPath: string): void {
  if (!fs.existsSync(scriptPath)) {
    errors.push(`❌ Proof script missing: ${scriptPath}`);
    return;
  }

  const content = fs.readFileSync(scriptPath, 'utf-8');
  
  // Check for DRY_RUN default
  if (!content.includes('DRY_RUN') && !content.includes('EXECUTE_REAL_ACTION')) {
    errors.push(`❌ ${scriptPath}: Missing DRY_RUN or EXECUTE_REAL_ACTION gating`);
  }
  
  // Check for EXECUTE_REAL_ACTION gating
  if (!content.includes('EXECUTE_REAL_ACTION')) {
    errors.push(`❌ ${scriptPath}: Missing EXECUTE_REAL_ACTION gating`);
  }
  
  // Check that DRY_RUN defaults to safe
  const dryRunPattern = /DRY_RUN\s*=\s*process\.env\.DRY_RUN\s*!==\s*['"]false['"]/;
  const executePattern = /EXECUTE_REAL_ACTION\s*=\s*process\.env\.EXECUTE_REAL_ACTION\s*===/;
  
  if (!dryRunPattern.test(content) && !executePattern.test(content)) {
    warnings.push(`⚠️  ${scriptPath}: DRY_RUN default may not be safe (check manually)`);
  }
}

function validateSystemEvents(): void {
  const codebaseFiles = [
    'scripts/executor/daemon.ts',
    'scripts/executor/prove-e2e-control-to-post.ts',
    'scripts/executor/prove-e2e-control-to-reply.ts',
    'src/jobs/postingQueue.ts',
  ];
  
  const allContent = codebaseFiles
    .filter(f => fs.existsSync(f))
    .map(f => fs.readFileSync(f, 'utf-8'))
    .join('\n');
  
  for (const eventType of REQUIRED_SYSTEM_EVENTS) {
    if (!allContent.includes(eventType)) {
      errors.push(`❌ Required system_event type missing: ${eventType}`);
    }
  }
}

function validateDocumentation(): void {
  const systemStatusPath = 'docs/SYSTEM_STATUS.md';
  if (!fs.existsSync(systemStatusPath)) {
    errors.push(`❌ Documentation file missing: ${systemStatusPath}`);
    return;
  }
  
  const content = fs.readFileSync(systemStatusPath, 'utf-8');
  
  // Check for PROVEN claims
  const provenPattern = /Level 4.*PROVEN|Control→Executor→X.*PROVEN/gi;
  const provenMatches = content.match(provenPattern);
  
  if (provenMatches) {
    for (const match of provenMatches) {
      // Check if POST or REPLY
      const isPost = match.toLowerCase().includes('post');
      const isReply = match.toLowerCase().includes('reply');
      
      if (isPost) {
        const reportPath = PROOF_REPORTS['Level 4.*POST'];
        if (!fs.existsSync(reportPath)) {
          errors.push(`❌ PROVEN claim for POST but proof report missing: ${reportPath}`);
        } else {
          const reportContent = fs.readFileSync(reportPath, 'utf-8');
          if (!reportContent.includes('https://x.com/')) {
            errors.push(`❌ PROVEN claim for POST but proof report missing tweet URL: ${reportPath}`);
          }
          if (!reportContent.includes('✅ PASS') && !reportContent.includes('Status: ✅')) {
            warnings.push(`⚠️  PROVEN claim for POST but proof report does not show PASS: ${reportPath}`);
          }
        }
      }
      
      if (isReply) {
        const reportPath = PROOF_REPORTS['Level 4.*REPLY'];
        if (!fs.existsSync(reportPath)) {
          errors.push(`❌ PROVEN claim for REPLY but proof report missing: ${reportPath}`);
        } else {
          const reportContent = fs.readFileSync(reportPath, 'utf-8');
          if (!reportContent.includes('https://x.com/')) {
            errors.push(`❌ PROVEN claim for REPLY but proof report missing reply URL: ${reportPath}`);
          }
          if (!reportContent.includes('✅ PASS') && !reportContent.includes('Status: ✅')) {
            warnings.push(`⚠️  PROVEN claim for REPLY but proof report does not show PASS: ${reportPath}`);
          }
        }
      }
    }
  }
}

function main(): void {
  console.log('🔍 Validating proof scripts and system events...\n');
  
  // Validate proof scripts
  console.log('📝 Validating proof scripts...');
  for (const script of PROOF_SCRIPTS) {
    validateProofScript(script);
  }
  
  // Validate system events
  console.log('📊 Validating required system_event types...');
  validateSystemEvents();
  
  // Validate documentation
  console.log('📚 Validating documentation claims...');
  validateDocumentation();
  
  // Report results
  console.log('\n' + '='.repeat(60));
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log(`  ${w}`));
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => console.log(`  ${e}`));
    console.log('\n❌ Validation failed');
    process.exit(1);
  }
  
  console.log('\n✅ All validations passed');
  process.exit(0);
}

main();

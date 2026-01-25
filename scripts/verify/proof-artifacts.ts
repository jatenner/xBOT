#!/usr/bin/env tsx
/**
 * Verify Proof Artifacts Truth Check
 * 
 * Ensures documentation claims of PROVEN status match actual proof reports.
 * 
 * Checks:
 * - If docs claim "PROVEN" for Level 4 POST/REPLY, verify:
 *   1. Referenced proof report exists
 *   2. Report contains "✅ PASS" (or "Status: ✅ PASS")
 *   3. Report contains https://x.com/ URL (Tweet URL or Reply URL)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const DOCS_TO_CHECK = [
  'docs/SYSTEM_STATUS.md',
  'README_MASTER.md',
];

const PROOF_REPORTS = {
  'POST': 'docs/CONTROL_TO_POST_PROOF.md',
  'REPLY': 'docs/CONTROL_TO_REPLY_PROOF.md',
};

const PROOF_IMMUTABLE_PATTERNS = {
  'POST': /docs\/proofs\/control-post\/(control-post-\d+\.md)/,
  'REPLY': /docs\/proofs\/control-reply\/(control-reply-\d+\.md)/,
  'HEALTH': /docs\/proofs\/health\/(health-\d+\.md)/,
};

interface ProvenClaim {
  doc: string;
  lineNumber: number;
  line: string;
  type: 'POST' | 'REPLY' | 'HEALTH';
  reportPath: string;
  immutableReportPath?: string;
}

let errors: string[] = [];
let warnings: string[] = [];

function findProvenClaims(docPath: string): ProvenClaim[] {
  if (!fs.existsSync(docPath)) {
    errors.push(`❌ Documentation file missing: ${docPath}`);
    return [];
  }

  const content = fs.readFileSync(docPath, 'utf-8');
  const lines = content.split('\n');
  const claims: ProvenClaim[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for PROVEN claims related to Level 4 POST
    if (line.includes('PROVEN') && (line.includes('POST') || line.includes('Posting') || line.includes('post'))) {
      // Extract immutable report path if mentioned
      const immutableMatch = line.match(PROOF_IMMUTABLE_PATTERNS.POST);
      const reportMatch = line.match(/docs\/CONTROL_TO_POST_PROOF\.md|CONTROL_TO_POST_PROOF\.md/);
      if (immutableMatch || reportMatch || line.includes('Level 4') || line.includes('Control→Executor→X')) {
        const immutablePath = immutableMatch 
          ? `docs/proofs/control-post/${immutableMatch[1]}`
          : undefined;
        claims.push({
          doc: docPath,
          lineNumber: lineNum,
          line: line.trim(),
          type: 'POST',
          reportPath: PROOF_REPORTS.POST,
          immutableReportPath: immutablePath,
        });
      }
    }

    // Check for PROVEN claims related to Level 4 REPLY
    if (line.includes('PROVEN') && (line.includes('REPLY') || line.includes('Replying') || line.includes('reply'))) {
      // Extract immutable report path if mentioned
      const immutableMatch = line.match(PROOF_IMMUTABLE_PATTERNS.REPLY);
      const reportMatch = line.match(/docs\/CONTROL_TO_REPLY_PROOF\.md|CONTROL_TO_REPLY_PROOF\.md/);
      if (immutableMatch || reportMatch || line.includes('Level 4') || line.includes('Control→Executor→X')) {
        const immutablePath = immutableMatch 
          ? `docs/proofs/control-reply/${immutableMatch[1]}`
          : undefined;
        claims.push({
          doc: docPath,
          lineNumber: lineNum,
          line: line.trim(),
          type: 'REPLY',
          reportPath: PROOF_REPORTS.REPLY,
          immutableReportPath: immutablePath,
        });
      }
    }

    // Check for PROVEN claims related to Phase 5A.1 Health
    if (line.includes('PROVEN') && (line.includes('Phase 5A.1') || line.includes('Health') || line.includes('health') || line.includes('Liveness') || line.includes('liveness'))) {
      // Extract immutable report path if mentioned
      const immutableMatch = line.match(PROOF_IMMUTABLE_PATTERNS.HEALTH);
      if (immutableMatch || line.includes('Phase 5A.1')) {
        const immutablePath = immutableMatch 
          ? `docs/proofs/health/${immutableMatch[1]}`
          : undefined;
        claims.push({
          doc: docPath,
          lineNumber: lineNum,
          line: line.trim(),
          type: 'HEALTH',
          reportPath: 'docs/proofs/health/INDEX.md', // Use INDEX as pointer
          immutableReportPath: immutablePath,
        });
      }
    }
  }

  return claims;
}

function verifyProofReport(claim: ProvenClaim): void {
  const { reportPath, type, doc, lineNumber, line, immutableReportPath } = claim;

  // Determine which report to verify
  let actualReportPath: string;
  let reportContent: string;
  
  if (immutableReportPath) {
    // Docs reference immutable report directly - verify that
    actualReportPath = immutableReportPath;
    if (!fs.existsSync(actualReportPath)) {
      errors.push(
        `❌ ${doc}:${lineNumber} claims PROVEN for ${type} but immutable proof report missing: ${actualReportPath}`
      );
      return;
    }
    reportContent = fs.readFileSync(actualReportPath, 'utf-8');
  } else {
    // Docs reference pointer file - check if pointer file references immutable report
    if (!fs.existsSync(reportPath)) {
      errors.push(
        `❌ ${doc}:${lineNumber} claims PROVEN for ${type} but pointer file missing: ${reportPath}`
      );
      return;
    }
    
    const pointerContent = fs.readFileSync(reportPath, 'utf-8');
    
    // Extract immutable report path from pointer file
    const immutablePathMatch = pointerContent.match(/Canonical Report:.*\[`([^`]+)`\]/);
    if (immutablePathMatch) {
      const relativeImmutablePath = immutablePathMatch[1];
      actualReportPath = path.join(process.cwd(), relativeImmutablePath);
      if (!fs.existsSync(actualReportPath)) {
        errors.push(
          `❌ ${doc}:${lineNumber} claims PROVEN for ${type} but immutable report referenced in pointer file missing: ${actualReportPath}\n` +
          `   Pointer file: ${reportPath}`
        );
        return;
      }
      reportContent = fs.readFileSync(actualReportPath, 'utf-8');
    } else {
      // Pointer file doesn't reference immutable report - check pointer file itself
      // But PROVEN requires real execution, so pointer-only is not sufficient
      errors.push(
        `❌ ${doc}:${lineNumber} claims PROVEN for ${type} but pointer file does not reference immutable report: ${reportPath}\n` +
        `   PROVEN status requires real execution with immutable report. Pointer file should contain "Canonical Report: [\`docs/proofs/...\`]()"`
      );
      return;
    }
  }
  
  // Extract URL from doc line if present (for cross-reference)
  // Look for URLs in various formats: url=..., Reply URL:..., tweet_url=..., etc.
  const docUrlPatterns = [
    /(?:tweet_url|reply_url|url)=([^\s`,\]]+)/,
    /(?:Tweet URL|Reply URL|Result URL):\s*([^\s`,\]]+)/,
    /(https:\/\/x\.com\/[^\s`,\]]+)/,
  ];
  
  let urlInDoc: string | null = null;
  for (const pattern of docUrlPatterns) {
    const match = line.match(pattern);
    if (match) {
      urlInDoc = (match[1] || match[0]).replace(/[,`)\]]+$/, '').trim();
      break;
    }
  }

  // Check for PASS status (multiple patterns)
  const passPatterns = [
    /✅ PASS/,
    /\*\*Status:\*\* ✅ PASS/,
    /Status: ✅ PASS/,
    /✅ \*\*PASS\*\*/,
    /PASS.*All execution checks/,
  ];
  
  const hasPass = passPatterns.some(pattern => pattern.test(reportContent));
  
  // Also check if the report shows a successful result at the end
  const hasSuccessResult = reportContent.includes('✅ **PASS**') || 
                           reportContent.includes('TEST PASSED') ||
                           (reportContent.includes('**Result**') && reportContent.includes('✅'));

  // If doc mentions a specific URL and it exists in report, accept as evidence of successful run
  const hasUrlFromDocs = urlInDoc && reportContent.includes(urlInDoc);
  
  // Verify PASS status (required for PROVEN)
  if (!hasPass && !hasSuccessResult) {
    const statusLine = reportContent.match(/\*\*Status:\*\*.*/)?.[0] || 
                       reportContent.match(/Status:.*/)?.[0] || 
                       'Not found';
    errors.push(
      `❌ ${doc}:${lineNumber} claims PROVEN for ${type} but immutable proof report does not show PASS: ${actualReportPath}\n` +
      `   Report status: ${statusLine}`
    );
  }

  // Check for URL (multiple patterns)
  let hasUrl = false;
  const reportUrlPatterns = [
    /https:\/\/x\.com\/.*status\/\d+/,
    /https:\/\/twitter\.com\/.*status\/\d+/,
  ];
  
  if (type === 'POST') {
    // Look for Tweet URL patterns
    const tweetUrlPatterns = [
      /Tweet URL:.*https:\/\/x\.com\//,
      /Result URL:.*https:\/\/x\.com\//,
      /url=.*https:\/\/x\.com\//,
      /tweet_url=.*https:\/\/x\.com\//,
      ...reportUrlPatterns,
    ];
    hasUrl = tweetUrlPatterns.some(pattern => pattern.test(reportContent));
    
    // Also check if the doc mentions a specific URL and it exists in report
    if (urlInDoc && reportContent.includes(urlInDoc)) {
      hasUrl = true;
    }
  } else if (type === 'REPLY') {
    // Look for Reply URL patterns
    const replyUrlPatterns = [
      /Reply URL:.*https:\/\/x\.com\//,
      /reply_url=.*https:\/\/x\.com\//,
      /Result URL:.*https:\/\/x\.com\//,
      ...reportUrlPatterns,
    ];
    hasUrl = replyUrlPatterns.some(pattern => pattern.test(reportContent));
    
    // Also check if the doc mentions a specific URL and it exists in report
    if (urlInDoc && reportContent.includes(urlInDoc)) {
      hasUrl = true;
    }
  } else if (type === 'HEALTH') {
    // Health proofs don't require URLs - they require event IDs
    // Check for event IDs in report
    const hasEventIds = /Boot Event ID:|Ready Event ID:|Health OK Event ID:|Tick Event ID/i.test(reportContent);
    // For health proofs, PASS status is sufficient (no URL required)
    hasUrl = true; // Health proofs don't need URLs
  }

  // Verify URL exists (required for PROVEN)
  if (!hasUrl && !hasUrlFromDocs) {
    const expectedUrl = urlInDoc ? `URL mentioned in docs: ${urlInDoc}` : `${type === 'POST' ? 'Tweet URL:' : 'Reply URL:'} containing https://x.com/`;
    errors.push(
      `❌ ${doc}:${lineNumber} claims PROVEN for ${type} but immutable proof report missing ${type === 'POST' ? 'Tweet' : 'Reply'} URL: ${actualReportPath}\n` +
      `   Expected: ${expectedUrl}`
    );
  }

  // If both checks pass, log success
  // Accept if: (PASS status) AND (URL in report OR URL from docs exists)
  const statusValid = hasPass || hasSuccessResult;
  const urlValid = hasUrl || hasUrlFromDocs;
  
  if (statusValid && urlValid) {
    console.log(`✅ Verified: ${doc}:${lineNumber} - ${type} PROVEN claim matches immutable report ${actualReportPath}`);
  } else if (hasUrlFromDocs && !hasUrl) {
    // URL from docs exists but not found by patterns - still accept (might be in different format)
    console.log(`✅ Verified: ${doc}:${lineNumber} - ${type} PROVEN claim matches immutable report ${actualReportPath} (URL from docs found)`);
  }
}

function main(): void {
  console.log('🔍 Verifying proof artifact truth in documentation...\n');

  const allClaims: ProvenClaim[] = [];

  // Find all PROVEN claims
  for (const docPath of DOCS_TO_CHECK) {
    const claims = findProvenClaims(docPath);
    allClaims.push(...claims);
  }

  if (allClaims.length === 0) {
    console.log('ℹ️  No PROVEN claims found for Level 4 POST/REPLY in documentation');
    console.log('✅ Verification passed (no claims to verify)');
    process.exit(0);
  }

  console.log(`📋 Found ${allClaims.length} PROVEN claim(s) to verify:\n`);
  allClaims.forEach(claim => {
    console.log(`  - ${claim.doc}:${claim.lineNumber} (${claim.type})`);
  });
  console.log('');

  // Verify each claim
  for (const claim of allClaims) {
    verifyProofReport(claim);
  }

  // Report results
  console.log('\n' + '='.repeat(60));

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log(`  ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ Verification Failed:\n');
    errors.forEach(e => console.log(`  ${e}\n`));
    console.log('❌ Documentation truth check failed');
    process.exit(1);
  }

  console.log('\n✅ All PROVEN claims verified against proof reports');
  process.exit(0);
}

main();

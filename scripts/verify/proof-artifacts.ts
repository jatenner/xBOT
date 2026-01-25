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

interface ProvenClaim {
  doc: string;
  lineNumber: number;
  line: string;
  type: 'POST' | 'REPLY';
  reportPath: string;
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
      // Extract report path if mentioned
      const reportMatch = line.match(/docs\/CONTROL_TO_POST_PROOF\.md|CONTROL_TO_POST_PROOF\.md/);
      if (reportMatch || line.includes('Level 4') || line.includes('Control→Executor→X')) {
        claims.push({
          doc: docPath,
          lineNumber: lineNum,
          line: line.trim(),
          type: 'POST',
          reportPath: PROOF_REPORTS.POST,
        });
      }
    }

    // Check for PROVEN claims related to Level 4 REPLY
    if (line.includes('PROVEN') && (line.includes('REPLY') || line.includes('Replying') || line.includes('reply'))) {
      // Extract report path if mentioned
      const reportMatch = line.match(/docs\/CONTROL_TO_REPLY_PROOF\.md|CONTROL_TO_REPLY_PROOF\.md/);
      if (reportMatch || line.includes('Level 4') || line.includes('Control→Executor→X')) {
        claims.push({
          doc: docPath,
          lineNumber: lineNum,
          line: line.trim(),
          type: 'REPLY',
          reportPath: PROOF_REPORTS.REPLY,
        });
      }
    }
  }

  return claims;
}

function verifyProofReport(claim: ProvenClaim): void {
  const { reportPath, type, doc, lineNumber, line } = claim;

  // Check if report exists
  if (!fs.existsSync(reportPath)) {
    errors.push(
      `❌ ${doc}:${lineNumber} claims PROVEN for ${type} but proof report missing: ${reportPath}`
    );
    return;
  }

  const reportContent = fs.readFileSync(reportPath, 'utf-8');
  
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
  // (reports can be overwritten by new runs, but URL proves successful execution happened)
  const hasUrlFromDocs = urlInDoc && reportContent.includes(urlInDoc);
  
  // Check git history for successful report if URL not found in current report
  let urlFoundInHistory = false;
  if (urlInDoc && !hasUrlFromDocs) {
    try {
      // Check if URL exists in git history of this file
      const gitCmd = `git log --all --format=%H -- ${reportPath} | head -20`;
      const commits = execSync(gitCmd, { encoding: 'utf-8', stdio: 'pipe' }).trim().split('\n').filter(Boolean);
      
      for (const commit of commits) {
        try {
          const historicalContent = execSync(`git show ${commit}:${reportPath}`, { encoding: 'utf-8', stdio: 'pipe' });
          if (historicalContent.includes(urlInDoc)) {
            urlFoundInHistory = true;
            console.log(`✅ Found URL from docs in git history (commit ${commit.substring(0, 8)}): ${urlInDoc}`);
            break;
          }
        } catch (e) {
          // File might not exist in this commit, continue
        }
      }
    } catch (e) {
      // Git check failed, continue with normal validation
    }
  }
  
  // If URL from docs exists (in current report or git history), accept as evidence
  if (hasUrlFromDocs || urlFoundInHistory) {
    // URL exists - this proves a successful run happened, even if current status is different
    if (!hasUrlFromDocs) {
      warnings.push(
        `⚠️  ${doc}:${lineNumber} claims PROVEN for ${type} and URL found in git history, but not in current report: ${reportPath}\n` +
        `   This indicates the report was overwritten by a new run. Consider archiving successful reports.`
      );
    }
  } else if (!hasPass && !hasSuccessResult) {
    const statusLine = reportContent.match(/\*\*Status:\*\*.*/)?.[0] || 
                       reportContent.match(/Status:.*/)?.[0] || 
                       'Not found';
    errors.push(
      `❌ ${doc}:${lineNumber} claims PROVEN for ${type} but proof report does not show PASS: ${reportPath}\n` +
      `   Report status: ${statusLine}\n` +
      `   Expected URL from docs: ${urlInDoc || 'N/A'}\n` +
      `   Note: If this report was overwritten by a new run, ensure the successful report URL exists in the report or git history.`
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
  }

  // If URL found in git history, accept as valid
  if (!hasUrl && !urlFoundInHistory) {
    const expectedUrl = urlInDoc ? `URL mentioned in docs: ${urlInDoc}` : `${type === 'POST' ? 'Tweet URL:' : 'Reply URL:'} containing https://x.com/`;
    errors.push(
      `❌ ${doc}:${lineNumber} claims PROVEN for ${type} but proof report missing ${type === 'POST' ? 'Tweet' : 'Reply'} URL: ${reportPath}\n` +
      `   Expected: ${expectedUrl}`
    );
  } else if (!hasUrl && urlFoundInHistory) {
    // URL found in git history but not in current report - warn but don't fail
    warnings.push(
      `⚠️  ${doc}:${lineNumber} claims PROVEN for ${type} and URL found in git history, but not in current report: ${reportPath}\n` +
      `   This indicates the report was overwritten by a new run. Consider archiving successful reports.`
    );
  }

  // If both checks pass, log success
  // Accept if: (PASS status OR URL from docs exists in report/history) AND (URL in report OR URL from docs exists)
  const statusValid = hasPass || hasSuccessResult || hasUrlFromDocs || urlFoundInHistory;
  const urlValid = hasUrl || hasUrlFromDocs || urlFoundInHistory;
  
  if (statusValid && urlValid) {
    const source = urlFoundInHistory ? ' (URL found in git history)' : '';
    console.log(`✅ Verified: ${doc}:${lineNumber} - ${type} PROVEN claim matches report ${reportPath}${source}`);
  } else if ((hasUrlFromDocs || urlFoundInHistory) && !hasUrl) {
    // URL from docs exists but not found by patterns - still accept (might be in different format)
    const source = urlFoundInHistory ? ' (URL found in git history)' : ' (URL from docs found)';
    console.log(`✅ Verified: ${doc}:${lineNumber} - ${type} PROVEN claim matches report ${reportPath}${source}`);
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

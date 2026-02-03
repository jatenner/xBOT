#!/usr/bin/env tsx
/**
 * 🔐 EXECUTOR AUTH PERSISTENCE PROOF
 * 
 * Proves that authentication persists across headed/headless modes and time.
 * Classifies failures into root causes: PROFILE_MISMATCH, PROFILE_WIPED, SESSION_INVALIDATED, CONTEXT_DELTA, PROOF_DAEMON_DELTA
 * 
 * Usage:
 *   RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:prove:auth-persistence
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, Page } from 'playwright';
import { ensureRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { checkWhoami } from '../../src/utils/whoamiAuth';

const RUNNER_PROFILE_DIR = ensureRunnerProfileDir();
const RUNNER_PROFILE_DIR_ABS = path.resolve(process.cwd(), RUNNER_PROFILE_DIR);
const BROWSER_USER_DATA_DIR = RUNNER_PROFILE_PATHS.chromeProfile();
const BROWSER_USER_DATA_DIR_ABS = path.resolve(BROWSER_USER_DATA_DIR);
const AUTH_OK_PATH = RUNNER_PROFILE_PATHS.authOk();

interface SubtestResult {
  name: string;
  pass: boolean;
  reason?: string;
  details?: any;
}

interface Classification {
  type: 'PROFILE_MISMATCH' | 'PROFILE_WIPED' | 'SESSION_INVALIDATED' | 'CONTEXT_DELTA' | 'PROOF_DAEMON_DELTA' | 'UNKNOWN';
  evidence: any;
}

async function collectCookieStoreInfo(): Promise<Array<{ path: string; exists: boolean; mtime: string | null; size: number | null }>> {
  const cookiePaths = [
    path.join(BROWSER_USER_DATA_DIR_ABS, 'Default', 'Cookies'),
    path.join(BROWSER_USER_DATA_DIR_ABS, 'Cookies'),
    path.join(BROWSER_USER_DATA_DIR_ABS, 'Default', 'Network', 'Cookies'),
  ];

  const results = [];
  for (const cookiePath of cookiePaths) {
    const exists = fs.existsSync(cookiePath);
    let mtime: string | null = null;
    let size: number | null = null;

    if (exists) {
      try {
        const stats = fs.statSync(cookiePath);
        mtime = stats.mtime.toISOString();
        size = stats.size;
      } catch (e) {
        // Ignore
      }
    }

    results.push({ path: cookiePath, exists, mtime, size });
  }

  return results;
}

async function checkLoggedIn(page: Page): Promise<{ logged_in: boolean; handle: string | null; url: string; reason: string }> {
  const result = await checkWhoami(page);
  return {
    logged_in: result.logged_in,
    handle: result.handle,
    url: result.url,
    reason: result.reason,
  };
}

async function subtestHeadedPersistent(): Promise<SubtestResult> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           Subtest A: Headed Persistent Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    const cookieStoreBefore = await collectCookieStoreInfo();
    
    console.log(`[SUBTEST_A] 🚀 Launching HEADED browser...`);
    console.log(`[SUBTEST_A]    UserDataDir: ${BROWSER_USER_DATA_DIR_ABS}`);
    
    context = await chromium.launchPersistentContext(BROWSER_USER_DATA_DIR_ABS, {
      headless: false,
      channel: 'chrome',
      args: [
        '--no-first-run',
        '--no-default-browser-check',
      ],
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });

    page = await context.newPage();
    
    console.log(`[SUBTEST_A] 🌐 Navigating to https://x.com/home...`);
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    const authResult = await checkLoggedIn(page);
    const cookieStoreAfter = await collectCookieStoreInfo();

    console.log(`[SUBTEST_A] 📊 Result: logged_in=${authResult.logged_in}, handle=${authResult.handle || 'N/A'}, reason=${authResult.reason}`);

    return {
      name: 'Headed Persistent Check',
      pass: authResult.logged_in,
      reason: authResult.logged_in ? undefined : authResult.reason,
      details: {
        handle: authResult.handle,
        url: authResult.url,
        cookieStoreBefore,
        cookieStoreAfter,
      },
    };
  } catch (error: any) {
    return {
      name: 'Headed Persistent Check',
      pass: false,
      reason: `error: ${error.message}`,
      details: { error: error.message },
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

async function subtestHeadlessPersistent(): Promise<SubtestResult> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           Subtest B: Headless Persistent Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    const cookieStoreBefore = await collectCookieStoreInfo();
    
    console.log(`[SUBTEST_B] 🚀 Launching HEADLESS browser...`);
    console.log(`[SUBTEST_B]    UserDataDir: ${BROWSER_USER_DATA_DIR_ABS}`);
    
    context = await chromium.launchPersistentContext(BROWSER_USER_DATA_DIR_ABS, {
      headless: true,
      channel: 'chrome',
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });

    page = await context.newPage();
    
    console.log(`[SUBTEST_B] 🌐 Navigating to https://x.com/home...`);
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    const authResult = await checkLoggedIn(page);
    const cookieStoreAfter = await collectCookieStoreInfo();

    console.log(`[SUBTEST_B] 📊 Result: logged_in=${authResult.logged_in}, handle=${authResult.handle || 'N/A'}, reason=${authResult.reason}`);

    return {
      name: 'Headless Persistent Check',
      pass: authResult.logged_in,
      reason: authResult.logged_in ? undefined : authResult.reason,
      details: {
        handle: authResult.handle,
        url: authResult.url,
        cookieStoreBefore,
        cookieStoreAfter,
      },
    };
  } catch (error: any) {
    return {
      name: 'Headless Persistent Check',
      pass: false,
      reason: `error: ${error.message}`,
      details: { error: error.message },
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

async function subtestStabilityCheck(): Promise<SubtestResult> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           Subtest C: Stability Check (3 iterations)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results: Array<{ iteration: number; logged_in: boolean; handle: string | null; url: string; reason: string }> = [];

  for (let i = 1; i <= 3; i++) {
    console.log(`[SUBTEST_C] 🔄 Iteration ${i}/3...`);
    
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      context = await chromium.launchPersistentContext(BROWSER_USER_DATA_DIR_ABS, {
        headless: true,
        channel: 'chrome',
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
      });

      page = await context.newPage();
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      const authResult = await checkLoggedIn(page);
      results.push({
        iteration: i,
        logged_in: authResult.logged_in,
        handle: authResult.handle,
        url: authResult.url,
        reason: authResult.reason,
      });

      console.log(`[SUBTEST_C]    Iteration ${i}: logged_in=${authResult.logged_in}, handle=${authResult.handle || 'N/A'}`);

      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});

      if (i < 3) {
        console.log(`[SUBTEST_C]    Waiting 40s before next iteration...`);
        await new Promise(resolve => setTimeout(resolve, 40000));
      }
    } catch (error: any) {
      results.push({
        iteration: i,
        logged_in: false,
        handle: null,
        url: 'error',
        reason: `error: ${error.message}`,
      });
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  const allPassed = results.every(r => r.logged_in);
  const firstHandle = results[0]?.handle;
  const handlesMatch = results.every(r => r.handle === firstHandle);

  return {
    name: 'Stability Check',
    pass: allPassed && handlesMatch,
    reason: allPassed ? (handlesMatch ? undefined : 'handle_mismatch') : 'auth_lost',
    details: { results },
  };
}

function classifyFailure(
  subtestA: SubtestResult,
  subtestB: SubtestResult,
  subtestC: SubtestResult,
  authOkData: any,
  cookieStoreInfo: any[]
): Classification {
  // Check AUTH_OK.json for profile mismatch
  if (authOkData) {
    const authOkUserDataDir = authOkData.userDataDir;
    if (authOkUserDataDir && authOkUserDataDir !== BROWSER_USER_DATA_DIR_ABS) {
      return {
        type: 'PROFILE_MISMATCH',
        evidence: {
          authOkUserDataDir,
          currentUserDataDir: BROWSER_USER_DATA_DIR_ABS,
        },
      };
    }

    const authOkCwd = authOkData.cwd;
    if (authOkCwd && authOkCwd !== process.cwd()) {
      return {
        type: 'PROOF_DAEMON_DELTA',
        evidence: {
          authOkCwd,
          currentCwd: process.cwd(),
        },
      };
    }
  }

  // Check if cookie store disappeared
  const cookieStoreExists = cookieStoreInfo.some(c => c.exists);
  if (!cookieStoreExists && (subtestA.pass || subtestB.pass)) {
    return {
      type: 'PROFILE_WIPED',
      evidence: {
        cookieStoreInfo,
      },
    };
  }

  // Check if headed works but headless doesn't
  if (subtestA.pass && !subtestB.pass) {
    return {
      type: 'CONTEXT_DELTA',
      evidence: {
        headedPass: true,
        headlessPass: false,
        headedDetails: subtestA.details,
        headlessDetails: subtestB.details,
      },
    };
  }

  // Check if auth was lost over time
  if (subtestB.pass && !subtestC.pass) {
    return {
      type: 'SESSION_INVALIDATED',
      evidence: {
        initialPass: true,
        stabilityFail: true,
        stabilityDetails: subtestC.details,
      },
    };
  }

  return {
    type: 'UNKNOWN',
    evidence: {
      subtestA,
      subtestB,
      subtestC,
    },
  };
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 EXECUTOR AUTH PERSISTENCE PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Require RUNNER_PROFILE_DIR
  if (!process.env.RUNNER_PROFILE_DIR && RUNNER_PROFILE_DIR === path.resolve(process.cwd(), '.runner-profile')) {
    console.error('❌ RUNNER_PROFILE_DIR must be set');
    process.exit(1);
  }

  console.log(`📋 Configuration:`);
  console.log(`   RUNNER_PROFILE_DIR: ${RUNNER_PROFILE_DIR}`);
  console.log(`   RUNNER_PROFILE_DIR_ABS: ${RUNNER_PROFILE_DIR_ABS}`);
  console.log(`   UserDataDir: ${BROWSER_USER_DATA_DIR_ABS}`);
  console.log('');

  // Check AUTH_OK marker
  let authOkData: any = null;
  if (fs.existsSync(AUTH_OK_PATH)) {
    try {
      const content = fs.readFileSync(AUTH_OK_PATH, 'utf-8');
      authOkData = JSON.parse(content);
      console.log(`✅ AUTH_OK marker found: handle=${authOkData.handle || 'unknown'}, timestamp=${authOkData.timestamp}`);
    } catch (e) {
      console.warn(`⚠️  AUTH_OK marker exists but unreadable: ${(e as Error).message}`);
    }
  } else {
    console.error(`❌ AUTH_OK marker missing: ${AUTH_OK_PATH}`);
    console.error(`   Run executor:auth first to create authentication`);
    process.exit(1);
  }

  const cookieStoreInfo = await collectCookieStoreInfo();
  console.log(`\n📋 Cookie Store Files:`);
  cookieStoreInfo.forEach(c => {
    console.log(`   ${c.exists ? '✅' : '❌'} ${c.path}`);
    if (c.exists) {
      console.log(`      mtime: ${c.mtime}, size: ${c.size} bytes`);
    }
  });

  // Run subtests
  const subtestA = await subtestHeadedPersistent();
  const subtestB = await subtestHeadlessPersistent();
  const subtestC = await subtestStabilityCheck();

  // Classify failure if any
  let classification: Classification | null = null;
  const allPassed = subtestA.pass && subtestB.pass && subtestC.pass;
  if (!allPassed) {
    classification = classifyFailure(subtestA, subtestB, subtestC, authOkData, cookieStoreInfo);
  }

  // Write proof report
  const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = Date.now();
  const reportPath = path.join(reportsDir, `auth-persistence-${timestamp}.md`);

  const report = `# Auth Persistence Proof

**Timestamp:** ${new Date().toISOString()}
**Proof Time:** ${timestamp}

## Environment

- **CWD:** \`${process.cwd()}\`
- **RUNNER_PROFILE_DIR:** \`${RUNNER_PROFILE_DIR}\`
- **RUNNER_PROFILE_DIR_ABS:** \`${RUNNER_PROFILE_DIR_ABS}\`
- **UserDataDir:** \`${BROWSER_USER_DATA_DIR_ABS}\`

## AUTH_OK Marker

${authOkData ? `
- **Handle:** ${authOkData.handle || 'N/A'}
- **Timestamp:** ${authOkData.timestamp}
- **UserDataDir:** \`${authOkData.userDataDir}\`
- **CWD:** \`${authOkData.cwd}\`
` : '**Missing**'}

## Cookie Store Files

${cookieStoreInfo.map(c => `
### \`${c.path}\`
- **Exists:** ${c.exists}
- **Modified:** ${c.mtime || 'N/A'}
- **Size:** ${c.size !== null ? `${c.size} bytes` : 'N/A'}
`).join('\n')}

## Subtest Results

### Subtest A: Headed Persistent Check
- **Status:** ${subtestA.pass ? '✅ PASS' : '❌ FAIL'}
${subtestA.reason ? `- **Reason:** ${subtestA.reason}` : ''}
${subtestA.details ? `
- **Details:**
  - Handle: ${subtestA.details.handle || 'N/A'}
  - URL: ${subtestA.details.url}
` : ''}

### Subtest B: Headless Persistent Check
- **Status:** ${subtestB.pass ? '✅ PASS' : '❌ FAIL'}
${subtestB.reason ? `- **Reason:** ${subtestB.reason}` : ''}
${subtestB.details ? `
- **Details:**
  - Handle: ${subtestB.details.handle || 'N/A'}
  - URL: ${subtestB.details.url}
` : ''}

### Subtest C: Stability Check
- **Status:** ${subtestC.pass ? '✅ PASS' : '❌ FAIL'}
${subtestC.reason ? `- **Reason:** ${subtestC.reason}` : ''}
${subtestC.details ? `
- **Details:**
\`\`\`json
${JSON.stringify(subtestC.details, null, 2)}
\`\`\`
` : ''}

## Classification

${classification ? `
**Type:** ${classification.type}
**Evidence:**
\`\`\`json
${JSON.stringify(classification.evidence, null, 2)}
\`\`\`
` : '**All subtests passed - no classification needed**'}

## Result

${allPassed ? '✅ **PASS** - Auth persistence verified' : '❌ **FAIL** - Auth persistence broken'}

---

*Generated by scripts/executor/prove-auth-persistence.ts*
`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n✅ Proof report written to: ${reportPath}`);

  // Print summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 Proof Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Subtest A (Headed): ${subtestA.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Subtest B (Headless): ${subtestB.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Subtest C (Stability): ${subtestC.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  if (classification) {
    console.log(`Classification: ${classification.type}`);
  }
  console.log(`Overall: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);

  process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

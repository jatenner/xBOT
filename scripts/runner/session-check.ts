#!/usr/bin/env tsx
/**
 * 🔐 SESSION CHECK
 * 
 * Checks if the Mac Runner Playwright session is logged in to X.com
 * 
 * Usage:
 *   pnpm exec tsx scripts/runner/session-check.ts
 */

import fs from 'fs';
import path from 'path';

// Load .env.local first (preferred), then .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Set runner mode to use persistent profile
process.env.RUNNER_MODE = 'true';
if (!process.env.RUNNER_PROFILE_DIR) {
  process.env.RUNNER_PROFILE_DIR = path.join(process.cwd(), '.runner-profile');
}

async function checkSession(): Promise<{ 
  status: 'SESSION_OK' | 'SESSION_EXPIRED'; 
  url: string; 
  reason: string;
  diagnostics?: {
    hasLoginButton: boolean;
    hasConsentWall: boolean;
    hasChallenge: boolean;
    hasTimeline: boolean;
  };
}> {
  const { launchPersistent } = await import('../../src/infra/playwright/launcher');
  const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');
  
  const context = await launchPersistent();
  const page = await context.newPage();
  
  try {
    console.log('🔐 Checking X.com session...');
    console.log(`   Profile: ${RUNNER_PROFILE_DIR}`);
    
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000); // Let page settle
    
    const currentUrl = page.url();
    
    // Collect diagnostics
    const diagnostics = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const pageContent = document.documentElement.innerHTML;
      
      return {
        hasLoginButton: !!(
          document.querySelector('[data-testid="loginButton"]') ||
          bodyText.includes('Sign in') ||
          bodyText.includes('Log in')
        ),
        hasConsentWall: !!(
          bodyText.includes('Before you continue') ||
          bodyText.toLowerCase().includes('cookies') ||
          bodyText.toLowerCase().includes('consent') ||
          bodyText.includes('Accept all') ||
          pageContent.toLowerCase().includes('consent')
        ),
        hasChallenge: !!(
          bodyText.toLowerCase().includes('unusual activity') ||
          bodyText.toLowerCase().includes('verify') ||
          bodyText.toLowerCase().includes('suspicious') ||
          bodyText.toLowerCase().includes('challenge') ||
          pageContent.toLowerCase().includes('challenge')
        ),
        hasTimeline: !!(
          document.querySelector('[data-testid="primaryColumn"]') ||
          document.querySelector('article[data-testid="tweet"]') ||
          document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
        ),
      };
    });
    
    // Also check with locators
    const hasLoginButtonLocator = await page.locator('text="Sign in"').isVisible({ timeout: 2000 }).catch(() => false) ||
                                  await page.locator('text="Log in"').isVisible({ timeout: 2000 }).catch(() => false) ||
                                  await page.locator('[data-testid="loginButton"]').isVisible({ timeout: 2000 }).catch(() => false);
    
    diagnostics.hasLoginButton = diagnostics.hasLoginButton || hasLoginButtonLocator;
    
    // Check for login redirect
    if (currentUrl.includes('/i/flow/login') || currentUrl.includes('/login')) {
      // Save screenshot before closing
      const screenshotPath = path.join(RUNNER_PROFILE_DIR, 'session_check.png');
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      await context.close();
      return {
        status: 'SESSION_EXPIRED',
        url: currentUrl,
        reason: 'Redirected to login page',
        diagnostics,
      };
    }
    
    if (diagnostics.hasLoginButton) {
      const screenshotPath = path.join(RUNNER_PROFILE_DIR, 'session_check.png');
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      await context.close();
      return {
        status: 'SESSION_EXPIRED',
        url: currentUrl,
        reason: 'Login button visible',
        diagnostics,
      };
    }
    
    if (!diagnostics.hasTimeline) {
      // Double-check: wait a bit more and check again
      await page.waitForTimeout(3000);
      const hasTimelineAfterWait = await page.evaluate(() => {
        return !!document.querySelector('[data-testid="primaryColumn"]') ||
               !!document.querySelector('article[data-testid="tweet"]');
      });
      
      if (!hasTimelineAfterWait) {
        const screenshotPath = path.join(RUNNER_PROFILE_DIR, 'session_check.png');
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
        await context.close();
        return {
          status: 'SESSION_EXPIRED',
          url: currentUrl,
          reason: 'No timeline elements found',
          diagnostics,
        };
      }
    }
    
    // Additional check: look for navigation elements that indicate logged-in state
    const hasNav = await page.evaluate(() => {
      return !!document.querySelector('nav[role="navigation"]') ||
             !!document.querySelector('[data-testid="AppTabBar_Home_Link"]');
    });
    
    if (!hasNav) {
      const screenshotPath = path.join(RUNNER_PROFILE_DIR, 'session_check.png');
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      await context.close();
      return {
        status: 'SESSION_EXPIRED',
        url: currentUrl,
        reason: 'No navigation elements found',
        diagnostics,
      };
    }
    
    await context.close();
    return {
      status: 'SESSION_OK',
      url: currentUrl,
      reason: 'Timeline and navigation elements present',
      diagnostics,
    };
    
  } catch (error: any) {
    let url = 'unknown';
    let diagnostics: any = undefined;
    
    try {
      url = page.url();
      // Try to get diagnostics even on error
      diagnostics = await page.evaluate(() => {
        const bodyText = document.body.textContent || '';
        const pageContent = document.documentElement.innerHTML;
        
        return {
          hasLoginButton: !!(
            bodyText.includes('Sign in') ||
            bodyText.includes('Log in')
          ),
          hasConsentWall: !!(
            bodyText.includes('Before you continue') ||
            bodyText.includes('cookies') ||
            bodyText.includes('consent')
          ),
          hasChallenge: !!(
            bodyText.includes('unusual activity') ||
            bodyText.includes('verify') ||
            bodyText.includes('suspicious')
          ),
          hasTimeline: !!(
            document.querySelector('[data-testid="primaryColumn"]') ||
            document.querySelector('article[data-testid="tweet"]')
          ),
        };
      }).catch(() => undefined);
    } catch {}
    
    // Save screenshot on error
    const screenshotPath = path.join(RUNNER_PROFILE_DIR, 'session_check.png');
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    
    await context.close().catch(() => {});
    return {
      status: 'SESSION_EXPIRED',
      url,
      reason: `Error checking session: ${error.message}`,
      diagnostics,
    };
  }
}

async function main() {
  const result = await checkSession();
  const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`           ${result.status}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`URL: ${result.url}`);
  console.log(`Reason: ${result.reason}`);
  
  if (result.status === 'SESSION_EXPIRED' && result.diagnostics) {
    console.log('');
    console.log('📊 Diagnostics:');
    console.log(`   hasLoginButton: ${result.diagnostics.hasLoginButton}`);
    console.log(`   hasConsentWall: ${result.diagnostics.hasConsentWall}`);
    console.log(`   hasChallenge: ${result.diagnostics.hasChallenge}`);
    console.log(`   hasTimeline: ${result.diagnostics.hasTimeline}`);
    console.log('');
    console.log(`📸 Screenshot saved: ${path.join(RUNNER_PROFILE_DIR, 'session_check.png')}`);
  }
  
  console.log('');
  
  if (result.status === 'SESSION_EXPIRED') {
    process.exit(2); // Exit code 2 for SESSION_EXPIRED
  } else {
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('❌ Session check failed:', error);
  process.exit(1);
});

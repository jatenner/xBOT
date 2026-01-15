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

async function checkSession(): Promise<{ status: 'SESSION_OK' | 'SESSION_EXPIRED'; url: string; reason: string }> {
  const { launchPersistent } = await import('../../src/infra/playwright/launcher');
  
  const context = await launchPersistent();
  const page = await context.newPage();
  
  try {
    console.log('🔐 Checking X.com session...');
    console.log(`   Profile: ${process.env.RUNNER_PROFILE_DIR}`);
    
    await page.goto('https://x.com/home', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000); // Let page settle
    
    const currentUrl = page.url();
    
    // Check for login redirect
    if (currentUrl.includes('/i/flow/login') || currentUrl.includes('/login')) {
      await context.close();
      return {
        status: 'SESSION_EXPIRED',
        url: currentUrl,
        reason: 'Redirected to login page',
      };
    }
    
    // Check for login button/text
    const hasLoginButton = await page.locator('text="Sign in"').isVisible({ timeout: 2000 }).catch(() => false) ||
                          await page.locator('text="Log in"').isVisible({ timeout: 2000 }).catch(() => false) ||
                          await page.locator('[data-testid="loginButton"]').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasLoginButton) {
      await context.close();
      return {
        status: 'SESSION_EXPIRED',
        url: currentUrl,
        reason: 'Login button visible',
      };
    }
    
    // Check for logged-in indicators
    const hasTimeline = await page.evaluate(() => {
      return !!document.querySelector('[data-testid="primaryColumn"]') ||
             !!document.querySelector('article[data-testid="tweet"]') ||
             !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    });
    
    if (!hasTimeline) {
      // Double-check: wait a bit more and check again
      await page.waitForTimeout(3000);
      const hasTimelineAfterWait = await page.evaluate(() => {
        return !!document.querySelector('[data-testid="primaryColumn"]') ||
               !!document.querySelector('article[data-testid="tweet"]');
      });
      
      if (!hasTimelineAfterWait) {
        await context.close();
        return {
          status: 'SESSION_EXPIRED',
          url: currentUrl,
          reason: 'No timeline elements found',
        };
      }
    }
    
    // Additional check: look for navigation elements that indicate logged-in state
    const hasNav = await page.evaluate(() => {
      return !!document.querySelector('nav[role="navigation"]') ||
             !!document.querySelector('[data-testid="AppTabBar_Home_Link"]');
    });
    
    if (!hasNav) {
      await context.close();
      return {
        status: 'SESSION_EXPIRED',
        url: currentUrl,
        reason: 'No navigation elements found',
      };
    }
    
    await context.close();
    return {
      status: 'SESSION_OK',
      url: currentUrl,
      reason: 'Timeline and navigation elements present',
    };
    
  } catch (error: any) {
    let url = 'unknown';
    try {
      url = page.url();
    } catch {}
    await context.close().catch(() => {});
    return {
      status: 'SESSION_EXPIRED',
      url,
      reason: `Error checking session: ${error.message}`,
    };
  }
}

async function main() {
  const result = await checkSession();
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`           ${result.status}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`URL: ${result.url}`);
  console.log(`Reason: ${result.reason}`);
  console.log('');
  
  if (result.status === 'SESSION_EXPIRED') {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('❌ Session check failed:', error);
  process.exit(1);
});

/**
 * 🎭 PLAYWRIGHT UTILITIES
 * 
 * Utility functions for consistent Playwright browser launching across the codebase.
 * Ensures correct executable paths on Render and other deployment environments.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Get the correct Chromium executable path for the current environment
 */
export function getChromiumExecutablePath(): string | undefined {
  console.log('🔍 Detecting Chromium executable path...');
  
  // For development and local environments, let Playwright auto-detect
  if (process.env.NODE_ENV !== 'production') {
    console.log('🏠 Development environment - using Playwright auto-detection');
    return undefined;
  }
  
  // Check if we have a playwright-core installation (PLAYWRIGHT_BROWSERS_PATH=0)
  const nodeModulesPath = path.join(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers');
  
  if (fs.existsSync(nodeModulesPath)) {
    console.log(`📂 Found playwright-core browsers at: ${nodeModulesPath}`);
    
    // Look for chromium directories
    try {
      const dirs = fs.readdirSync(nodeModulesPath);
      const chromiumDirs = dirs.filter(dir => dir.startsWith('chromium-') && !dir.includes('headless_shell'));
      
      console.log(`🔍 Available chromium directories: ${chromiumDirs.join(', ')}`);
      
      if (chromiumDirs.length > 0) {
        // Use the first (and typically only) chromium directory
        const chromiumDir = chromiumDirs[0];
        const executablePath = path.join(nodeModulesPath, chromiumDir, 'chrome-linux', 'chrome');
        
        if (fs.existsSync(executablePath)) {
          console.log(`✅ Found Chromium executable: ${executablePath}`);
          return executablePath;
        } else {
          console.log(`⚠️ Chromium directory found but executable missing: ${executablePath}`);
        }
      }
    } catch (error) {
      console.log(`⚠️ Error reading browser directories: ${error.message}`);
    }
  }
  
  // Fallback: Check for system-wide Playwright installation paths
  const fallbackPaths = [
    '/opt/render/project/src/node_modules/playwright-core/.local-browsers',
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    '/opt/render/.cache/ms-playwright'
  ].filter(Boolean);
  
  for (const basePath of fallbackPaths) {
    if (fs.existsSync(basePath!)) {
      console.log(`🔍 Checking fallback path: ${basePath}`);
      
      try {
        const dirs = fs.readdirSync(basePath!);
        const chromiumDirs = dirs.filter(dir => dir.startsWith('chromium-') && !dir.includes('headless_shell'));
        
        for (const dir of chromiumDirs) {
          const executablePath = path.join(basePath!, dir, 'chrome-linux', 'chrome');
          if (fs.existsSync(executablePath)) {
            console.log(`✅ Found fallback Chromium executable: ${executablePath}`);
            return executablePath;
          }
        }
      } catch (error) {
        console.log(`⚠️ Error checking fallback path ${basePath}: ${error.message}`);
      }
    }
  }
  
  console.log('⚠️ No Chromium executable found - using Playwright auto-detection');
  return undefined;
}

/**
 * Get standard browser launch options with the correct executable path
 */
export function getChromiumLaunchOptions(additionalArgs: string[] = []): any {
  const executablePath = getChromiumExecutablePath();
  
  const baseArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-blink-features=AutomationControlled'
  ];
  
  const launchOptions: any = {
    headless: true,
    args: [...baseArgs, ...additionalArgs]
  };
  
  if (executablePath) {
    launchOptions.executablePath = executablePath;
    console.log(`🎯 Using explicit executable path: ${executablePath}`);
  } else {
    console.log('🎯 Using Playwright auto-detection for executable path');
  }
  
  return launchOptions;
} 
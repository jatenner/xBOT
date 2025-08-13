#!/usr/bin/env ts-node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const SESSION_PATH = '/app/data/twitter_session.json';

async function seedSession() {
  // Ensure Playwright is installed
  try {
    await import('playwright');
  } catch {
    console.log('Installing Playwright...');
    const { execSync } = require('child_process');
    execSync('npx playwright install', { stdio: 'inherit' });
  }
  
  console.log('🔐 Opening X.com for manual login...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://x.com/login');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  await new Promise<void>((resolve) => {
    rl.question('👆 Please log in to X.com, then press ENTER here: ', () => {
      rl.close();
      resolve();
    });
  });
  
  const storageState = await context.storageState();
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
  fs.writeFileSync(SESSION_PATH, JSON.stringify(storageState, null, 2));
  
  await browser.close();
  
  console.log(`SESSION_SAVED: ${SESSION_PATH}`);
  console.log(`🍪 Cookies: ${storageState.cookies.length}`);
}

seedSession().catch(console.error);
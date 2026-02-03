#!/usr/bin/env tsx
/**
 * 🔄 Reload LaunchAgent to Pick Up Environment Changes
 * 
 * Stops executor, reinstalls service, and reloads LaunchAgent
 * so it picks up updated environment variables (e.g., OPENAI_API_KEY).
 * 
 * Usage:
 *   pnpm run ops:reload:launchagent
 */

import { execSync } from 'child_process';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔄 Reload LaunchAgent');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const steps = [
    {
      name: 'Stop executor daemon',
      command: 'pnpm run executor:stop',
    },
    {
      name: 'Reinstall LaunchAgent service',
      command: 'pnpm run executor:install-service',
    },
    {
      name: 'Unload LaunchAgent',
      command: 'launchctl unload -w ~/Library/LaunchAgents/com.xbot.executor.plist',
      allowFail: true,
    },
    {
      name: 'Load LaunchAgent',
      command: 'launchctl load -w ~/Library/LaunchAgents/com.xbot.executor.plist',
    },
  ];

  for (const step of steps) {
    console.log(`📋 ${step.name}...`);
    try {
      execSync(step.command, {
        stdio: 'inherit',
        encoding: 'utf-8',
      });
      console.log(`   ✅ ${step.name} completed\n`);
    } catch (error: any) {
      if (step.allowFail) {
        console.log(`   ⚠️  ${step.name} failed (non-critical): ${error.message}\n`);
      } else {
        console.error(`   ❌ ${step.name} failed: ${error.message}`);
        process.exit(1);
      }
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ LaunchAgent reloaded');
  console.log('\n   LaunchAgent will now use updated environment variables from .env.local');
  console.log('   Verify: pnpm run ops:executor:status');
}

main().catch((error) => {
  console.error('\n❌ FATAL: Reload script error:', error.message);
  process.exit(1);
});

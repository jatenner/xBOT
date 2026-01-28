#!/usr/bin/env tsx
/**
 * 🔄 SYNC OPENAI KEY FROM RAILWAY
 * 
 * Safely syncs OPENAI_API_KEY from Railway to local .env.local
 * Never prints the full key - only safe fingerprints.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

interface KeyFingerprint {
  source: string;
  prefix: string;
  suffix: string;
  length: number;
  sha16: string;
  present: boolean;
}

/**
 * Compute safe fingerprint of a key (never prints full key)
 */
function fingerprintKey(key: string | undefined, source: string): KeyFingerprint {
  if (!key) {
    return {
      source,
      prefix: 'none',
      suffix: 'none',
      length: 0,
      sha16: 'none',
      present: false,
    };
  }

  const trimmed = key.trim();
  const length = trimmed.length;
  const prefix = length >= 7 ? trimmed.slice(0, 7) : trimmed.slice(0, length);
  const suffix = length >= 4 ? trimmed.slice(-4) : trimmed.slice(-length);
  const sha16 = crypto.createHash('sha256').update(trimmed).digest('hex').substring(0, 16);

  return {
    source,
    prefix,
    suffix,
    length,
    sha16,
    present: true,
  };
}

/**
 * Get Railway OPENAI_API_KEY (safe - only fingerprint)
 */
function getRailwayKeyFingerprint(): KeyFingerprint {
  try {
    console.log('📡 Fetching OPENAI_API_KEY from Railway...');
    
    // Use --json flag (not --output json)
    let railwayKey: string | undefined;
    
    try {
      const jsonOutput = execSync(
        'railway variables --service xBOT --json',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      
      const parsed = JSON.parse(jsonOutput);
      // Railway JSON format: array of {name, value}
      if (Array.isArray(parsed)) {
        const openaiVar = parsed.find((v: any) => v.name === 'OPENAI_API_KEY');
        if (openaiVar && openaiVar.value) {
          railwayKey = openaiVar.value;
        }
      } else if (parsed.OPENAI_API_KEY) {
        railwayKey = parsed.OPENAI_API_KEY;
      } else if (parsed.value && parsed.name === 'OPENAI_API_KEY') {
        railwayKey = parsed.value;
      }
    } catch (jsonError: any) {
      // Fallback: try using jq if available
      try {
        const jqOutput = execSync(
          'railway variables --service xBOT --json | jq -r \'.[] | select(.name == "OPENAI_API_KEY") | .value\'',
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], shell: '/bin/bash' }
        ).trim();
        if (jqOutput && jqOutput.length > 10) {
          railwayKey = jqOutput;
        }
      } catch (jqError) {
        throw new Error(`Failed to parse Railway JSON: ${jsonError.message}`);
      }
    }

    if (!railwayKey || railwayKey.length < 10) {
      throw new Error('Could not extract valid OPENAI_API_KEY from Railway output');
    }

    return fingerprintKey(railwayKey, 'railway');
  } catch (error: any) {
    console.error(`❌ Failed to fetch Railway key: ${error.message}`);
    if (error.stdout) console.error(`   Stdout: ${error.stdout.substring(0, 200)}`);
    if (error.stderr) console.error(`   Stderr: ${error.stderr.substring(0, 200)}`);
    throw error;
  }
}

/**
 * Get local OPENAI_API_KEY from .env.local or .env
 */
function getLocalKeyFingerprint(): KeyFingerprint {
  const envLocalPath = path.join(process.cwd(), '.env.local');
  const envPath = path.join(process.cwd(), '.env');

  let key: string | undefined;
  let source = 'none';

  // Try .env.local first
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf-8');
    const match = content.match(/^OPENAI_API_KEY\s*=\s*(.+)$/m);
    if (match) {
      key = match[1].trim();
      source = '.env.local';
    }
  }

  // Fallback to .env
  if (!key && fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/^OPENAI_API_KEY\s*=\s*(.+)$/m);
    if (match) {
      key = match[1].trim();
      source = '.env';
    }
  }

  return fingerprintKey(key, source);
}

/**
 * Get full Railway key (for writing - still never printed)
 */
function getRailwayKeyValue(): string {
  try {
    let railwayKey: string | undefined;
    
    // Use --json flag (not --output json)
    try {
      const jsonOutput = execSync(
        'railway variables --service xBOT --json',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      
      const parsed = JSON.parse(jsonOutput);
      if (Array.isArray(parsed)) {
        const openaiVar = parsed.find((v: any) => v.name === 'OPENAI_API_KEY');
        if (openaiVar && openaiVar.value) {
          railwayKey = openaiVar.value;
        }
      } else if (parsed.OPENAI_API_KEY) {
        railwayKey = parsed.OPENAI_API_KEY;
      } else if (parsed.value && parsed.name === 'OPENAI_API_KEY') {
        railwayKey = parsed.value;
      }
    } catch (jsonError: any) {
      // Fallback: try using jq if available
      try {
        const jqOutput = execSync(
          'railway variables --service xBOT --json | jq -r \'.[] | select(.name == "OPENAI_API_KEY") | .value\'',
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], shell: '/bin/bash' }
        ).trim();
        if (jqOutput && jqOutput.length > 10) {
          railwayKey = jqOutput;
        }
      } catch (jqError) {
        throw new Error(`Failed to parse Railway JSON: ${jsonError.message}`);
      }
    }

    if (!railwayKey || railwayKey.length < 10) {
      throw new Error('Could not extract valid OPENAI_API_KEY from Railway');
    }

    // Clean key (remove quotes if present)
    railwayKey = railwayKey.trim();
    if ((railwayKey.startsWith('"') && railwayKey.endsWith('"')) ||
        (railwayKey.startsWith("'") && railwayKey.endsWith("'"))) {
      railwayKey = railwayKey.slice(1, -1).trim();
    }

    return railwayKey;
  } catch (error: any) {
    throw new Error(`Failed to get Railway key: ${error.message}`);
  }
}

/**
 * Update .env.local with Railway key
 */
function updateLocalEnvFile(railwayKey: string): void {
  const envLocalPath = path.join(process.cwd(), '.env.local');
  
  let existingContent = '';
  const otherVars: Record<string, string> = {};

  // Read existing .env.local if it exists
  if (fs.existsSync(envLocalPath)) {
    existingContent = fs.readFileSync(envLocalPath, 'utf-8');
    
    // Parse existing vars (except OPENAI_API_KEY)
    const lines = existingContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const match = trimmed.match(/^([^=]+)\s*=\s*(.+)$/);
        if (match && match[1].trim() !== 'OPENAI_API_KEY') {
          otherVars[match[1].trim()] = match[2].trim();
        }
      }
    }
  }

  // Build new content
  const newLines: string[] = [];
  
  // Add other vars first
  for (const [key, value] of Object.entries(otherVars)) {
    newLines.push(`${key}=${value}`);
  }
  
  // Add OPENAI_API_KEY (overwrite if exists)
  newLines.push(`OPENAI_API_KEY=${railwayKey}`);

  // Write to .env.local
  fs.writeFileSync(envLocalPath, newLines.join('\n') + '\n', 'utf-8');
  console.log(`✅ Updated ${envLocalPath} with Railway OPENAI_API_KEY`);
}

/**
 * Print fingerprint in safe format
 */
function printFingerprint(fp: KeyFingerprint, label: string): void {
  console.log(`\n${label}:`);
  console.log(`  source=${fp.source}`);
  console.log(`  prefix=${fp.prefix}`);
  console.log(`  suffix=${fp.suffix}`);
  console.log(`  len=${fp.length}`);
  console.log(`  sha16=${fp.sha16}`);
  console.log(`  present=${fp.present}`);
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🔄 SYNC OPENAI KEY FROM RAILWAY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1: Get Railway fingerprint
  const railwayFp = getRailwayKeyFingerprint();
  printFingerprint(railwayFp, '📡 Railway Key Fingerprint');

  if (!railwayFp.present) {
    console.error('\n❌ Railway OPENAI_API_KEY not found');
    process.exit(1);
  }

  // Step 2: Get local fingerprint
  const localFpBefore = getLocalKeyFingerprint();
  printFingerprint(localFpBefore, '💻 Local Key Fingerprint (Before)');

  // Step 3: Compare and sync if needed
  const fingerprintsMatch = 
    railwayFp.sha16 === localFpBefore.sha16 &&
    railwayFp.length === localFpBefore.length &&
    railwayFp.prefix === localFpBefore.prefix &&
    railwayFp.suffix === localFpBefore.suffix;

  if (fingerprintsMatch && localFpBefore.present) {
    console.log('\n✅ Fingerprints match - no sync needed');
  } else {
    console.log('\n🔄 Fingerprints differ or local key missing - syncing...');
    
    // Get full Railway key (still never printed)
    const railwayKey = getRailwayKeyValue();
    
    // Update local file
    updateLocalEnvFile(railwayKey);
    
    // Verify update
    const localFpAfter = getLocalKeyFingerprint();
    printFingerprint(localFpAfter, '💻 Local Key Fingerprint (After)');
    
    // Confirm match
    const nowMatches = 
      railwayFp.sha16 === localFpAfter.sha16 &&
      railwayFp.length === localFpAfter.length &&
      railwayFp.prefix === localFpAfter.prefix &&
      railwayFp.suffix === localFpAfter.suffix;

    if (nowMatches) {
      console.log('\n✅ Fingerprints now match!');
    } else {
      console.error('\n❌ Fingerprints still differ after sync');
      process.exit(1);
    }
  }

  // Step 4: Run verification
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Running verification script...\n');
  
  try {
    const verifyOutput = execSync(
      'pnpm tsx scripts/ops/verify-openai-key.ts',
      { encoding: 'utf-8', stdio: 'inherit' }
    );
    console.log('\n✅ Verification passed');
  } catch (error: any) {
    console.error('\n❌ Verification failed');
    console.error(`   Exit code: ${error.status || error.code || 'unknown'}`);
    
    // Re-print fingerprints for debugging
    const localFpFinal = getLocalKeyFingerprint();
    printFingerprint(railwayFp, '\n📡 Railway Key Fingerprint (for reference)');
    printFingerprint(localFpFinal, '💻 Local Key Fingerprint (current)');
    
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ SYNC COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(error => {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
});

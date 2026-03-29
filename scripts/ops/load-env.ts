/**
 * Load .env (base) then .env.local (overrides) before any other imports.
 * Import this first in ops scripts so OPENAI_API_KEY etc. are set before config/env is loaded.
 *
 * Proof-run live-write intent: when running ops-autonomous-reply-proof, explicit shell
 * SHADOW_MODE=false and X_ACTIONS_ENABLED=true are preserved so .env/.env.local do not
 * force read-only mode (narrow fix for proof runs only).
 */
import path from 'path';
import fs from 'fs';

const isProofScript = process.argv[1]?.includes('ops-autonomous-reply-proof') === true;

// Capture shell env BEFORE dotenv so we can restore explicit live-write intent after file load
const shellShadowMode = process.env.SHADOW_MODE;
const shellXActionsEnabled = process.env.X_ACTIONS_ENABLED;
const shellPostingEnabled = process.env.POSTING_ENABLED;

const cwd = process.cwd();
const envPath = path.join(cwd, '.env');
const envLocalPath = path.join(cwd, '.env.local');
// override: true so repo .env/.env.local win over shell for keys like OPENAI_API_KEY
if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath, override: true });
if (fs.existsSync(envLocalPath)) require('dotenv').config({ path: envLocalPath, override: true });

// Ops autonomous reply proof: set proof flags and restore explicit live-write intent from shell
if (isProofScript) {
  process.env.PROOF_MODE = 'true';
  process.env.POSTING_ENABLED = 'true';
  // Preserve shell intent so .env/.env.local cannot force read-only when operator wants live proof
  if (shellShadowMode === 'false') process.env.SHADOW_MODE = 'false';
  if (shellXActionsEnabled === 'true') process.env.X_ACTIONS_ENABLED = 'true';
  if (shellPostingEnabled === 'true') process.env.POSTING_ENABLED = 'true';

  // Startup diagnostics: final effective values and which source won
  const effective = {
    SHADOW_MODE: process.env.SHADOW_MODE,
    X_ACTIONS_ENABLED: process.env.X_ACTIONS_ENABLED,
    POSTING_ENABLED: process.env.POSTING_ENABLED,
    PROOF_MODE: process.env.PROOF_MODE,
  };
  const source = (key: string, shellVal: string | undefined, effectiveVal: string | undefined) => {
    if (key === 'SHADOW_MODE' && shellVal === 'false' && effectiveVal === 'false') return 'shell (explicit live preserved)';
    if (key === 'X_ACTIONS_ENABLED' && shellVal === 'true' && effectiveVal === 'true') return 'shell (explicit live preserved)';
    if (key === 'POSTING_ENABLED' && (shellVal === 'true' || effectiveVal === 'true')) return effectiveVal === 'true' ? (shellVal === 'true' ? 'shell + script' : 'script default') : '.env';
    if (key === 'PROOF_MODE') return 'script (proof run)';
    return effectiveVal != null ? '.env/.env.local' : 'default';
  };
  console.log('[OPS_PROOF_ENV] Final effective env (proof run):');
  console.log(`  SHADOW_MODE=${effective.SHADOW_MODE} (source: ${source('SHADOW_MODE', shellShadowMode, effective.SHADOW_MODE)})`);
  console.log(`  X_ACTIONS_ENABLED=${effective.X_ACTIONS_ENABLED} (source: ${source('X_ACTIONS_ENABLED', shellXActionsEnabled, effective.X_ACTIONS_ENABLED)})`);
  console.log(`  POSTING_ENABLED=${effective.POSTING_ENABLED} (source: ${source('POSTING_ENABLED', shellPostingEnabled, effective.POSTING_ENABLED)})`);
  console.log(`  PROOF_MODE=${effective.PROOF_MODE} (source: ${source('PROOF_MODE', undefined, effective.PROOF_MODE)})`);
}

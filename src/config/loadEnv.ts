/**
 * Single env-loading contract for worker and verify script.
 * Load order: .env first, then .env.local with override so .env.local wins.
 * Matches verify script effective behavior so worker and verify see the same OPENAI_API_KEY.
 *
 * Use this in railwayEntrypoint (and executor daemon); verify script uses the same order.
 */

import * as path from 'path';
import * as fs from 'fs';

export interface LoadEnvResult {
  /** Paths that were loaded (e.g. ['.env', '.env.local']) */
  loaded: string[];
  cwd: string;
}

/**
 * Load .env then .env.local (override: true) so .env.local wins.
 * Returns which files were loaded for proof logging.
 */
export function loadEnvForWorker(): LoadEnvResult {
  const cwd = process.cwd();
  const envPath = path.join(cwd, '.env');
  const envLocalPath = path.join(cwd, '.env.local');
  const loaded: string[] = [];

  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    loaded.push('.env');
  }
  if (fs.existsSync(envLocalPath)) {
    require('dotenv').config({ path: envLocalPath, override: true });
    loaded.push('.env.local');
  }

  return { loaded, cwd };
}

/**
 * Delete local artifact/debug files older than 24h so the Mac runner does not accumulate artifacts.
 * Targets: ./artifacts, .runner-profile/debug, /tmp thread_timeout_*
 * File types: png, html, json, txt
 */

import { readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const EXTENSIONS = new Set(['.png', '.html', '.json', '.txt']);

function isStale(filePath: string): boolean {
  try {
    const stat = statSync(filePath);
    return Date.now() - stat.mtimeMs > MAX_AGE_MS;
  } catch {
    return false;
  }
}

function cleanupDir(dir: string): number {
  let deleted = 0;
  try {
    if (!statSync(dir).isDirectory()) return 0;
  } catch {
    return 0;
  }
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        deleted += cleanupDir(full);
      } else if (e.isFile()) {
        const ext = e.name.replace(/^.*\./, '.');
        if (EXTENSIONS.has(ext) && isStale(full)) {
          try {
            unlinkSync(full);
            deleted++;
          } catch {
            // ignore
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return deleted;
}

function cleanupTmpThreadArtifacts(): number {
  let deleted = 0;
  try {
    const names = readdirSync('/tmp');
    for (const name of names) {
      if (!name.startsWith('thread_timeout_')) continue;
      const full = join('/tmp', name);
      if (!EXTENSIONS.has('.' + name.split('.').pop()!)) continue;
      if (isStale(full)) {
        try {
          unlinkSync(full);
          deleted++;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
  return deleted;
}

function main(): void {
  const cwd = process.cwd();
  const artifactsDir = join(cwd, 'artifacts');
  const debugDir = join(process.env.RUNNER_PROFILE_DIR || join(cwd, '.runner-profile'), 'debug');

  let total = 0;
  total += cleanupDir(artifactsDir);
  total += cleanupDir(debugDir);
  total += cleanupTmpThreadArtifacts();

  console.log(`[CLEANUP_ARTIFACTS] Deleted ${total} stale artifact(s)`);
}

main();

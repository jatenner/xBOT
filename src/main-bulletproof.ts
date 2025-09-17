/**
 * Bulletproof production entry.
 * - Loads env
 * - Runs migrations (if enabled)
 * - Runs acceptance smoke (if enabled, non-blocking)
 * - Connects DB/Redis (lazy ok)
 * - Starts the HTTP server using the first available entry among:
 *   ./server, ./main, ./index, ./app/server, ./api/server
 * Shapes accepted:
 *   - export async function start(port?: number)
 *   - export const app (Express/Koa/Fastify) -> app.listen
 *   - default export function start()
 */
import 'source-map-support/register';
import { config } from 'dotenv';
config();

const PORT = Number(process.env.PORT || 3000);

// small helper to try a list of modules
async function tryRequire(cands: string[]) {
  for (const c of cands) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const m = require(c);
      return { id: c, mod: m };
    } catch (_) {}
  }
  return null;
}

// Run migrations if enabled
async function runMigrationsIfEnabled() {
  if (process.env.MIGRATIONS_RUNTIME_ENABLED === 'true') {
    console.log('🔧 Running DB migrations...');
    const { runMigrations } = require('../tools/db/migrate');
    await runMigrations();
  }
}

// Run acceptance smoke if enabled (non-blocking)
async function runAcceptanceSmokeIfEnabled() {
  if (process.env.STARTUP_ACCEPTANCE_ENABLED === 'true') {
    console.log('🧪 Running acceptance smoke (posting OFF)...');
    console.log('→ Testing learning job...');
    try {
      const { spawn } = require('child_process');
      await new Promise((resolve) => {
        const proc = spawn('node', ['dist/scripts/jobs-learn.js'], { stdio: 'inherit' });
        proc.on('close', () => resolve(null));
      });
    } catch (e) {
      console.log('⚠️ acceptance jobs:learn failed (non-blocking)');
    }
    
    console.log('→ Testing plan dryrun...');
    try {
      const { spawn } = require('child_process');
      await new Promise((resolve) => {
        const proc = spawn('node', ['dist/scripts/dryrun-plan.js', '2'], { stdio: 'inherit' });
        proc.on('close', () => resolve(null));
      });
    } catch (e) {
      console.log('⚠️ acceptance dryrun:plan failed (non-blocking)');
    }
    
    console.log('→ Testing reply dryrun...');
    try {
      const { spawn } = require('child_process');
      await new Promise((resolve) => {
        const proc = spawn('node', ['dist/scripts/dryrun-reply.js'], { stdio: 'inherit' });
        proc.on('close', () => resolve(null));
      });
    } catch (e) {
      console.log('⚠️ acceptance dryrun:reply failed (non-blocking)');
    }
    
    console.log('✅ Acceptance smoke completed (failures are non-blocking)');
  } else {
    console.log('🧪 Acceptance smoke: skipped (STARTUP_ACCEPTANCE_ENABLED=false)');
  }
}

async function start() {
  // Run migrations if enabled
  await runMigrationsIfEnabled();
  
  // Run acceptance smoke if enabled (non-blocking)
  await runAcceptanceSmokeIfEnabled();
  
  console.log('🚀 Starting app...');
  
  const hit = await tryRequire([
    './server',
    './main',
    './index',
    './app/server',
    './api/server',
  ]);

  if (!hit) {
    console.error('❌ No runtime entry found (server/main/index).');
    console.error('Please wire your HTTP server to one of the candidates above or export start()/app.');
    process.exit(1);
    return;
  }

  const m = hit.mod;
  console.log(`🟢 Using runtime entry: ${hit.id}`);

  // Case 1: explicit start()
  if (typeof m.start === 'function') {
    await Promise.resolve(m.start(PORT));
    console.log(`🚀 start() invoked on port ${PORT}`);
    return;
  }
  // Case 2: default export is a function
  if (typeof m.default === 'function') {
    await Promise.resolve(m.default(PORT));
    console.log(`🚀 default() invoked on port ${PORT}`);
    return;
  }
  // Case 3: Express/Koa/Fastify app
  const app = m.app || m.default?.app || m.default;
  if (app && typeof app.listen === 'function') {
    app.listen(PORT, () => console.log(`🚀 app.listen on ${PORT}`));
    return;
  }

  console.error('❌ Entry module found but no start()/default()/app.listen shape detected.');
  process.exit(1);
}

start().catch((e) => {
  console.error('💥 Fatal boot error:', e);
  process.exit(1);
});

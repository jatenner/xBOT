// tools/start.js
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

function run(cmd, args) {
  const p = spawnSync(cmd, args, { stdio: 'inherit' });
  process.exit(p.status ?? 1);
}

function main() {
  const explicit = process.env.APP_ENTRY;
  if (explicit) {
    const full = resolve(explicit);
    try { require.resolve(full); } catch {
      console.error(`APP_ENTRY points to missing file: ${full}`);
      process.exit(1);
    }
    console.log(`▶ Starting (APP_ENTRY): ${full}`);
    return run('node', [full]);
  }

  const candidates = [
    'dist/main-bulletproof.js',
    'dist/main.js',
    'dist/index.js',
    'dist/server.js',
    'dist/app.js',
    'dist/src/main-bulletproof.js',
    'dist/scripts/main-bulletproof.js',
  ];

  for (const c of candidates) {
    if (existsSync(c)) {
      console.log(`▶ Starting (auto): ${c}`);
      return run('node', [c]);
    }
  }

  console.error('❌ No runnable entry found in dist/.');
  console.error('📂 Dist listing:');
  spawnSync('bash', ['-lc', 'ls -lah dist || true'], { stdio: 'inherit' });
  console.error('🔎 JS files under dist/:');
  spawnSync('bash', ['-lc', "find dist -maxdepth 2 -type f -name '*.js' | sort || true"], { stdio: 'inherit' });
  process.exit(1);
}

main();

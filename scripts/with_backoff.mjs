#!/usr/bin/env node
import { spawn } from 'node:child_process';

const baseMs = Number(process.env.BACKOFF_BASE_MS || 5000);
const maxTries = Number(process.env.BACKOFF_TRIES || 6);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(ms) { return Math.round(ms * (0.85 + Math.random() * 0.3)); }

async function runOnce(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d.toString());
    p.stderr.on('data', d => err += d.toString());
    p.on('close', code => {
      if (code === 0) resolve({ code, out, err });
      else reject(Object.assign(new Error(err || out || `${cmd} failed`), { code, out, err }));
    });
  });
}

(async () => {
  const [cmd, ...args] = process.argv.slice(2);
  
  if (!cmd) {
    console.error('Usage: node scripts/with_backoff.mjs <command> [args...]');
    process.exit(1);
  }
  
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await runOnce(cmd, args);
      process.stdout.write(res.out);
      process.stderr.write(res.err);
      process.exit(0);
    } catch (e) {
      const msg = (e.out + '\n' + e.err).toLowerCase();
      
      // Check for rate limiting (429 or explicit rate limit messages)
      if (/rate[- ]?limited|429|too many requests|being ratelimited/.test(msg)) {
        const wait = jitter(baseMs * Math.pow(2, i));
        console.error(`[backoff] Rate limited (attempt ${i + 1}/${maxTries}); sleeping ${wait}ms`);
        
        if (i < maxTries - 1) {
          await sleep(wait);
          continue;
        }
      }
      
      // Check for auth issues (401 or explicit auth messages)  
      if (/unauthorized|401|please login|railway login/.test(msg)) {
        console.error('[auth] Unauthorized—manual `railway login` or set RAILWAY_TOKEN required.');
        process.exit(1);
      }
      
      // For other errors, fail immediately (don't retry)
      console.error(e.message || String(e));
      process.exit(e.code || 1);
    }
  }
  
  console.error('[backoff] Still rate-limited after all retries.');
  process.exit(1);
})();

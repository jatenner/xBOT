#!/usr/bin/env node
import { spawn } from 'node:child_process';

function run(cmd, args = []) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d.toString());
    p.stderr.on('data', d => err += d.toString());
    p.on('close', code => resolve({ code, out, err }));
  });
}

// Minimal probe set to avoid excessive API calls
const probes = [
  ['railway', ['whoami']],
  ['railway', ['status']],
  ['railway', ['logs', '--help']],
];

const now = () => new Date().toISOString();

(async () => {
  console.log(`🔍 RAILWAY CLI DIAGNOSTIC - ${now()}`);
  console.log('='.repeat(60));
  
  for (const [cmd, args] of probes) {
    const start = Date.now();
    const res = await run(cmd, args);
    const duration = Date.now() - start;
    
    console.log('---');
    console.log(`[${now()}] CMD: ${cmd} ${args.join(' ')}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Exit Code: ${res.code}`);
    
    // Parse output for rate limiting signals
    const combined = (res.out + '\n' + res.err).toLowerCase();
    
    // Check for various rate limiting patterns
    const patterns = {
      '429': /429|too many requests/,
      'rate_limited': /rate[- ]?limited|being ratelimited/,
      '401': /401|unauthorized/,
      'login_required': /please login|railway login/,
      'network_error': /network|timeout|connection/,
      'success': /@\w+|logged in|project:|service:/
    };
    
    const detected = [];
    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.test(combined)) {
        detected.push(key);
      }
    }
    
    console.log(`Status Hints: [${detected.join(', ') || 'none'}]`);
    
    if (res.out.trim()) {
      console.log(`STDOUT: ${res.out.trim()}`);
    }
    if (res.err.trim()) {
      console.log(`STDERR: ${res.err.trim()}`);
    }
    
    // Add delay between probes to avoid hammering
    if (probes.indexOf([cmd, args]) < probes.length - 1) {
      console.log('⏳ Waiting 2s before next probe...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  console.log('---');
  console.log(`🏁 Diagnostic complete at ${now()}`);
})();

/**
 * 🔍 DIAGNOSE RAILWAY JOB EXECUTION
 * Checks why jobs aren't running in production
 */

import 'dotenv/config';

console.log('========================================');
console.log('RAILWAY JOB DIAGNOSTICS');
console.log('========================================\n');

console.log('1) ENVIRONMENT VARIABLES');
console.log('---');
console.log(`JOBS_AUTOSTART: ${process.env.JOBS_AUTOSTART || 'NOT SET (defaults to false!)'}`);
console.log(`MODE: ${process.env.MODE || 'NOT SET'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET (' + process.env.OPENAI_API_KEY.substring(0, 20) + '...)' : 'NOT SET'}`);

console.log('\n2) EXPECTED BEHAVIOR');
console.log('---');
console.log('JOBS_AUTOSTART must be explicitly set to "true"');
console.log('If not set or set to anything else, jobs will NOT start');
console.log('This is because: process.env.JOBS_AUTOSTART === "true"');

console.log('\n3) FIX REQUIRED');
console.log('---');
console.log('Set in Railway: JOBS_AUTOSTART=true');


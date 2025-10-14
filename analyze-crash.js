#!/usr/bin/env node

/**
 * CRASH LOG ANALYZER
 * Fetches and analyzes Railway deployment crash logs
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');

const DEPLOYMENT_ID = 'f03b04a4-9356-4910-9d2e-3c18e5a52d72';
const LOG_FILE = 'crash-logs.txt';

console.log('🔍 RAILWAY CRASH LOG ANALYZER\n');
console.log('Deployment ID:', DEPLOYMENT_ID);
console.log('Status: CRASHED');
console.log('Commit: Deploy aggressive growth configuration\n');

console.log('📋 Fetching crash logs...\n');

// Fetch logs with timeout
const railway = spawn('railway', ['logs', '--deployment', DEPLOYMENT_ID], {
  cwd: __dirname
});

let logs = '';
let errorFound = false;

railway.stdout.on('data', (data) => {
  logs += data.toString();
});

railway.stderr.on('data', (data) => {
  logs += data.toString();
});

// Timeout after 5 seconds
setTimeout(() => {
  railway.kill();
  
  if (logs.length === 0) {
    console.log('⚠️  No logs found for crashed deployment');
    console.log('Fetching latest logs instead...\n');
    
    try {
      logs = execSync('railway logs 2>&1 | head -500', { 
        encoding: 'utf-8',
        timeout: 8000
      });
    } catch (e) {
      logs = e.stdout || e.stderr || 'Could not fetch logs';
    }
  }
  
  // Save logs
  fs.writeFileSync(LOG_FILE, logs);
  console.log(`✅ Logs saved to: ${LOG_FILE}\n`);
  
  // Analyze logs
  analyzeCrash(logs);
  
}, 5000);

function analyzeCrash(logs) {
  console.log('═'.repeat(80));
  console.log('CRASH ANALYSIS');
  console.log('═'.repeat(80) + '\n');
  
  const lines = logs.split('\n');
  
  // Look for error patterns
  const errorPatterns = [
    { pattern: /error/i, label: 'Errors' },
    { pattern: /exception/i, label: 'Exceptions' },
    { pattern: /failed/i, label: 'Failures' },
    { pattern: /fatal/i, label: 'Fatal errors' },
    { pattern: /crash/i, label: 'Crashes' },
    { pattern: /ECONNREFUSED/i, label: 'Connection refused' },
    { pattern: /ENOENT/i, label: 'File not found' },
    { pattern: /Cannot find module/i, label: 'Missing modules' },
    { pattern: /SyntaxError/i, label: 'Syntax errors' },
    { pattern: /TypeError/i, label: 'Type errors' },
    { pattern: /ReferenceError/i, label: 'Reference errors' },
    { pattern: /PGRST116/i, label: 'Database errors' },
    { pattern: /playwright/i, label: 'Playwright issues' },
    { pattern: /exit code/i, label: 'Exit codes' },
    { pattern: /killed/i, label: 'Killed processes' }
  ];
  
  const findings = {};
  const criticalErrors = [];
  
  lines.forEach((line, index) => {
    errorPatterns.forEach(({ pattern, label }) => {
      if (pattern.test(line)) {
        if (!findings[label]) findings[label] = [];
        findings[label].push({ line: index + 1, text: line.trim() });
        
        // Mark as critical if it's a fatal error or crash
        if (label.includes('Fatal') || label.includes('Crash') || label.includes('Exit')) {
          criticalErrors.push({ line: index + 1, text: line.trim(), type: label });
        }
      }
    });
  });
  
  // Display findings
  if (Object.keys(findings).length === 0) {
    console.log('✅ No obvious errors found in logs');
    console.log('   The crash may be due to:');
    console.log('   - Memory limits exceeded');
    console.log('   - Health check timeout');
    console.log('   - Container startup failure\n');
  } else {
    console.log('🔴 ISSUES FOUND:\n');
    
    Object.entries(findings).forEach(([label, items]) => {
      console.log(`${label} (${items.length}):`);
      items.slice(0, 3).forEach(item => {
        console.log(`  Line ${item.line}: ${item.text.substring(0, 100)}`);
      });
      if (items.length > 3) {
        console.log(`  ... and ${items.length - 3} more`);
      }
      console.log('');
    });
  }
  
  // Show critical errors
  if (criticalErrors.length > 0) {
    console.log('━'.repeat(80));
    console.log('🚨 CRITICAL ERRORS:\n');
    criticalErrors.forEach(err => {
      console.log(`[${err.type}] Line ${err.line}:`);
      console.log(`  ${err.text}\n`);
    });
  }
  
  // Look for specific patterns
  const specificIssues = [];
  
  if (logs.includes('ECONNREFUSED')) {
    specificIssues.push({
      issue: 'Database connection refused',
      cause: 'Cannot connect to Supabase or Redis',
      fix: 'Check DATABASE_URL and REDIS_URL environment variables'
    });
  }
  
  if (logs.includes('Cannot find module')) {
    specificIssues.push({
      issue: 'Missing Node.js modules',
      cause: 'Dependencies not installed or incorrect paths',
      fix: 'Check package.json and ensure all imports are correct'
    });
  }
  
  if (logs.includes('playwright') || logs.includes('chromium')) {
    specificIssues.push({
      issue: 'Playwright/Browser issues',
      cause: 'Chromium not installed or incompatible',
      fix: 'Check Dockerfile includes playwright install --with-deps'
    });
  }
  
  if (logs.includes('Health check') || logs.includes('healthcheck')) {
    specificIssues.push({
      issue: 'Health check failure',
      cause: 'Application not responding to health endpoint',
      fix: 'Check /status endpoint or increase healthcheck timeout'
    });
  }
  
  if (logs.includes('SIGKILL') || logs.includes('OOM')) {
    specificIssues.push({
      issue: 'Out of memory',
      cause: 'Application using too much RAM',
      fix: 'Optimize memory usage or upgrade Railway plan'
    });
  }
  
  if (specificIssues.length > 0) {
    console.log('━'.repeat(80));
    console.log('💡 SPECIFIC ISSUES DETECTED:\n');
    specificIssues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.issue}`);
      console.log(`   Cause: ${issue.cause}`);
      console.log(`   Fix: ${issue.fix}\n`);
    });
  }
  
  // Recommendations
  console.log('═'.repeat(80));
  console.log('📋 RECOMMENDATIONS:\n');
  console.log('1. Check full logs: cat crash-logs.txt');
  console.log('2. Review environment variables: railway variables');
  console.log('3. Check build logs: railway logs --deployment ' + DEPLOYMENT_ID);
  console.log('4. Verify Dockerfile configuration');
  console.log('5. Check Railway resource limits');
  console.log('\n🔧 To fix, run: node fix-crash.js (will be created based on findings)');
  console.log('═'.repeat(80) + '\n');
}


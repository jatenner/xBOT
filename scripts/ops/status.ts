#!/usr/bin/env tsx
/**
 * OPS STATUS
 * 
 * Comprehensive status check for all running components
 */

import 'dotenv/config';
import { Client } from 'pg';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const RUNNER_PROFILE = path.join(process.cwd(), '.runner-profile');
const GO_LIVE_LOG = path.join(RUNNER_PROFILE, 'go-live-monitor.log');

async function checkLaunchAgent(name: string): Promise<{ loaded: boolean; status: string }> {
  try {
    const output = execSync(`launchctl list | grep "${name}" || true`, { encoding: 'utf-8' });
    const loaded = output.trim().length > 0;
    if (loaded) {
      const parts = output.trim().split(/\s+/);
      const exitCode = parts[0];
      const status = exitCode === '-' ? 'running' : `exited (${exitCode})`;
      return { loaded: true, status };
    }
    return { loaded: false, status: 'not loaded' };
  } catch (err: any) {
    return { loaded: false, status: `error: ${err.message}` };
  }
}

async function checkCDP(): Promise<{ reachable: boolean; details: string }> {
  try {
    const output = execSync('curl -s http://127.0.0.1:9222/json 2>&1 | head -1', { encoding: 'utf-8', timeout: 2000 });
    if (output.includes('[') || output.includes('{')) {
      return { reachable: true, details: 'CDP responding' };
    }
    return { reachable: false, details: 'CDP not responding' };
  } catch (err: any) {
    return { reachable: false, details: `error: ${err.message.split('\n')[0]}` };
  }
}

function getLastLogLines(filePath: string, lines: number = 10): string[] {
  try {
    if (!fs.existsSync(filePath)) {
      return [`Log file not found: ${filePath}`];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const allLines = content.split('\n').filter(l => l.trim());
    return allLines.slice(-lines);
  } catch (err: any) {
    return [`Error reading log: ${err.message}`];
  }
}

async function getSupabaseStatus(client: Client) {
  // POST_SUCCESS last 6h
  const { rows: postSuccess } = await client.query(`
    SELECT COUNT(*) as count
    FROM system_events
    WHERE event_type = 'POST_SUCCESS'
      AND created_at >= NOW() - INTERVAL '6 hours';
  `);

  // Plans last 6h
  const { rows: plans } = await client.query(`
    SELECT COUNT(*) as count
    FROM growth_plans
    WHERE window_start >= NOW() - INTERVAL '6 hours';
  `);

  // Overruns last 72h
  const { rows: overruns } = await client.query(`
    SELECT COUNT(*) as count
    FROM growth_plans gp
    JOIN growth_execution ge ON ge.plan_id = gp.plan_id
    WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)
      AND gp.window_start >= NOW() - INTERVAL '72 hours';
  `);

  return {
    postSuccess: parseInt(postSuccess[0].count, 10),
    plans: parseInt(plans[0].count, 10),
    overruns: parseInt(overruns[0].count, 10)
  };
}

async function getRailwayStatus(): Promise<{ status: string; service: string; environment: string }> {
  try {
    let status = 'unknown';
    let service = 'unknown';
    let environment = 'unknown';
    
    try {
      const statusOutput = execSync('railway status 2>&1', { encoding: 'utf-8', timeout: 10000 });
      status = statusOutput.split('\n').slice(0, 3).join(' | ').trim() || 'connected';
      
      if (statusOutput.includes('Service:')) {
        const serviceMatch = statusOutput.match(/Service:\s*([^\n|]+)/);
        if (serviceMatch) service = serviceMatch[1].trim();
      }
      
      if (statusOutput.includes('Environment:')) {
        const envMatch = statusOutput.match(/Environment:\s*([^\n|]+)/);
        if (envMatch) environment = envMatch[1].trim();
      }
    } catch (err: any) {
      status = `status check failed: ${err.message.split('\n')[0]}`;
    }
    
    try {
      // Try to get service from config
      const configPath = path.join(process.env.HOME || '', '.railway', 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.service) {
          service = config.service;
        }
      }
    } catch (err: any) {
      // Ignore config read errors
    }
    
    return {
      status,
      service,
      environment
    };
  } catch (err: any) {
    return {
      status: `error: ${err.message.split('\n')[0]}`,
      service: 'unknown',
      environment: 'unknown'
    };
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 OPS STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // A) LaunchAgents
  console.log('A) LaunchAgents:');
  const runnerAgent = await checkLaunchAgent('com.xbot.runner');
  const goLiveAgent = await checkLaunchAgent('com.xbot.go-live-monitor');
  const cooldownAgent = await checkLaunchAgent('com.xbot.cooldown-monitor');
  
  console.log(`   Runner: ${runnerAgent.loaded ? '✅' : '❌'} ${runnerAgent.status}`);
  console.log(`   Go-Live Monitor: ${goLiveAgent.loaded ? '✅' : '❌'} ${goLiveAgent.status}`);
  console.log(`   Cooldown Monitor: ${cooldownAgent.loaded ? '✅' : '❌'} ${cooldownAgent.status}`);
  console.log('');

  // B) CDP
  console.log('B) CDP:');
  const cdp = await checkCDP();
  console.log(`   ${cdp.reachable ? '✅' : '❌'} ${cdp.details}`);
  console.log('');

  // C) Logs
  console.log('C) Go-Live Monitor Log (last 10 lines):');
  const logLines = getLastLogLines(GO_LIVE_LOG);
  if (logLines.length === 0) {
    console.log('   (no log entries)');
  } else {
    logLines.forEach(line => {
      console.log(`   ${line}`);
    });
  }
  console.log('');

  // D) Supabase
  console.log('D) Supabase:');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const dbStatus = await getSupabaseStatus(client);
    console.log(`   POST_SUCCESS (6h): ${dbStatus.postSuccess}`);
    console.log(`   Plans (6h): ${dbStatus.plans}`);
    console.log(`   Overruns (72h): ${dbStatus.overruns} ${dbStatus.overruns === 0 ? '✅' : '❌'}`);
    await client.end();
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  console.log('');

  // E) Railway
  console.log('E) Railway:');
  const railway = await getRailwayStatus();
  console.log(`   Status: ${railway.status}`);
  console.log(`   Service: ${railway.service}`);
  console.log(`   Environment: ${railway.environment}`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

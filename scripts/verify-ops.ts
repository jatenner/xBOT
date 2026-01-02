#!/usr/bin/env tsx
/**
 * 🔍 OPERATIONAL VERIFICATION SCRIPT
 * Verifies system health and job heartbeats
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

interface StatusResponse {
  ok: boolean;
  ready: boolean;
  degraded: boolean;
  stalled: boolean;
  stalledJobs: string[];
  heartbeats: Record<string, {
    lastRunAt: string | null;
    minutesSinceLastRun: string | null;
    lastError: string | null;
    runCount: number;
    errorCount: number;
  }>;
  jobStatuses: Record<string, boolean>;
}

async function checkStatus(): Promise<{ pass: boolean; message: string }> {
  try {
    const response = await fetch(`${BASE_URL}/status`);
    
    if (!response.ok) {
      return { pass: false, message: `❌ /status returned ${response.status}` };
    }
    
    const data: StatusResponse = await response.json();
    
    if (!data.ok) {
      return { pass: false, message: '❌ /status ok=false' };
    }
    
    return { pass: true, message: '✅ /status 200 OK' };
  } catch (error: any) {
    return { pass: false, message: `❌ /status failed: ${error.message}` };
  }
}

async function checkReady(): Promise<{ pass: boolean; message: string }> {
  try {
    const response = await fetch(`${BASE_URL}/ready`);
    
    if (!response.ok) {
      const data = await response.json();
      return { 
        pass: false, 
        message: `❌ /ready returned ${response.status}: ${data.message || 'not ready'}` 
      };
    }
    
    return { pass: true, message: '✅ /ready 200 OK' };
  } catch (error: any) {
    return { pass: false, message: `❌ /ready failed: ${error.message}` };
  }
}

async function checkStalled(): Promise<{ pass: boolean; message: string }> {
  try {
    const response = await fetch(`${BASE_URL}/status`);
    const data: StatusResponse = await response.json();
    
    if (data.stalled) {
      return { 
        pass: false, 
        message: `❌ System stalled: ${data.stalledJobs.join(', ')}` 
      };
    }
    
    return { pass: true, message: '✅ No stalled jobs' };
  } catch (error: any) {
    return { pass: false, message: `❌ Stall check failed: ${error.message}` };
  }
}

async function checkHeartbeats(): Promise<{ pass: boolean; message: string }> {
  try {
    const response = await fetch(`${BASE_URL}/status`);
    const data: StatusResponse = await response.json();
    
    const criticalJobs = ['posting', 'reply_posting'];
    const staleJobs: string[] = [];
    
    for (const job of criticalJobs) {
      const heartbeat = data.heartbeats[job];
      
      if (!heartbeat) {
        staleJobs.push(`${job} (no heartbeat)`);
        continue;
      }
      
      if (heartbeat.minutesSinceLastRun === null) {
        staleJobs.push(`${job} (never run)`);
        continue;
      }
      
      const minutes = parseFloat(heartbeat.minutesSinceLastRun);
      if (minutes > 15) {
        staleJobs.push(`${job} (${minutes.toFixed(1)}min ago)`);
      }
    }
    
    if (staleJobs.length > 0) {
      return { 
        pass: false, 
        message: `❌ Stale heartbeats: ${staleJobs.join(', ')}` 
      };
    }
    
    return { pass: true, message: '✅ All critical jobs ran within 15min' };
  } catch (error: any) {
    return { pass: false, message: `❌ Heartbeat check failed: ${error.message}` };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 OPERATIONAL VERIFICATION');
  console.log(`   BASE_URL: ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const checks = [
    { name: 'Status Endpoint', fn: checkStatus },
    { name: 'Ready Endpoint', fn: checkReady },
    { name: 'Stall Detection', fn: checkStalled },
    { name: 'Job Heartbeats', fn: checkHeartbeats },
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    const result = await check.fn();
    console.log(`${check.name}: ${result.message}`);
    if (!result.pass) {
      allPassed = false;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  
  if (allPassed) {
    console.log('✅ ALL CHECKS PASSED');
    process.exit(0);
  } else {
    console.log('❌ SOME CHECKS FAILED');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}


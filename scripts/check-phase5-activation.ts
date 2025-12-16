/**
 * Phase 5 Activation Diagnostic Script
 * 
 * Fetches Railway logs and checks for Phase 5 activation indicators
 */

import { execSync } from 'child_process';

interface LogEntry {
  timestamp?: string;
  line: string;
}

interface ActivationStatus {
  slotPolicy: { found: boolean; evidence: LogEntry[] };
  genPolicy: { found: boolean; evidence: LogEntry[] };
  voiceGuide: { found: boolean; evidence: LogEntry[] };
  phase4Router: { found: boolean; evidence: LogEntry[] };
}

interface ErrorEntry {
  type: string;
  line: string;
  timestamp?: string;
}

function parseLogLine(line: string): LogEntry {
  // Try to extract timestamp if present (Railway logs format)
  const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z)/);
  const timestamp = timestampMatch ? timestampMatch[1] : undefined;
  
  return {
    timestamp,
    line: line.trim()
  };
}

function fetchRailwayLogs(lines: number = 500): string[] {
  try {
    console.log(`[DIAGNOSTIC] Fetching last ${lines} lines from Railway logs...`);
    const output = execSync(
      `railway logs --service xBOT --lines ${lines}`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    return output.split('\n').filter(line => line.trim().length > 0);
  } catch (error: any) {
    console.error(`[DIAGNOSTIC] ❌ Failed to fetch logs: ${error.message}`);
    process.exit(1);
  }
}

function checkActivation(logLines: string[]): ActivationStatus {
  const status: ActivationStatus = {
    slotPolicy: { found: false, evidence: [] },
    genPolicy: { found: false, evidence: [] },
    voiceGuide: { found: false, evidence: [] },
    phase4Router: { found: false, evidence: [] }
  };

  for (const line of logLines) {
    const entry = parseLogLine(line);
    
    // Check for SLOT_POLICY
    if (line.includes('[SLOT_POLICY]')) {
      status.slotPolicy.found = true;
      status.slotPolicy.evidence.push(entry);
    }
    
    // Check for GEN_POLICY
    if (line.includes('[GEN_POLICY]')) {
      status.genPolicy.found = true;
      status.genPolicy.evidence.push(entry);
    }
    
    // Check for VOICE_GUIDE
    if (line.includes('[VOICE_GUIDE]')) {
      status.voiceGuide.found = true;
      status.voiceGuide.evidence.push(entry);
    }
    
    // Check for PHASE4 Router
    if (line.includes('[PHASE4][Router]') || line.includes('[PHASE4]')) {
      status.phase4Router.found = true;
      status.phase4Router.evidence.push(entry);
    }
  }

  return status;
}

function checkPlanJobHealth(logLines: string[]): {
  planJobRunning: boolean;
  slotSelected: boolean;
  generatorSelected: boolean;
  phase4Routing: boolean;
  evidence: LogEntry[];
} {
  const evidence: LogEntry[] = [];
  let planJobRunning = false;
  let slotSelected = false;
  let generatorSelected = false;
  let phase4Routing = false;

  for (const line of logLines) {
    const entry = parseLogLine(line);
    
    if (line.includes('[PLAN_JOB]') || line.includes('planJob') || line.includes('📅 CONTENT SLOT')) {
      planJobRunning = true;
      evidence.push(entry);
    }
    
    if (line.includes('CONTENT SLOT:') || line.includes('Selected slot=')) {
      slotSelected = true;
      evidence.push(entry);
    }
    
    if (line.includes('Selected generator=') || line.includes('GENERATOR_MATCH') || line.includes('→ Exploitation mode:') || line.includes('→ Exploration mode:')) {
      generatorSelected = true;
      evidence.push(entry);
    }
    
    if (line.includes('[PHASE4]') || line.includes('[PHASE4][Router]')) {
      phase4Routing = true;
      evidence.push(entry);
    }
  }

  return {
    planJobRunning,
    slotSelected,
    generatorSelected,
    phase4Routing,
    evidence: evidence.slice(0, 10) // Limit to first 10 entries
  };
}

function findErrors(logLines: string[]): ErrorEntry[] {
  const errors: ErrorEntry[] = [];
  const errorPatterns = [
    'Unknown generator',
    'slotPolicyInitialized=false',
    'generatorPolicyInitialized=false',
    'policy fallback',
    'error',
    'exception',
    'failed',
    'Failed to',
    '❌',
    'ERROR'
  ];

  for (const line of logLines) {
    const lowerLine = line.toLowerCase();
    
    for (const pattern of errorPatterns) {
      if (lowerLine.includes(pattern.toLowerCase())) {
        // Skip false positives (e.g., "no error" messages)
        if (lowerLine.includes('no error') || lowerLine.includes('without error')) {
          continue;
        }
        
        const entry = parseLogLine(line);
        errors.push({
          type: pattern,
          line: entry.line,
          timestamp: entry.timestamp
        });
        break; // Only count once per line
      }
    }
  }

  return errors.slice(0, 20); // Limit to first 20 errors
}

function generateReport(
  activation: ActivationStatus,
  planJob: ReturnType<typeof checkPlanJobHealth>,
  errors: ErrorEntry[]
): string {
  const report: string[] = [];

  report.push('# Phase 5 Activation Report\n');
  report.push(`**Generated:** ${new Date().toISOString()}\n`);
  report.push(`**Source:** Railway xBOT service logs (last 500 lines)\n`);

  // 1. Activation Summary
  report.push('## 1. Activation Summary\n');
  report.push('| Component | Status | Evidence Count |');
  report.push('|-----------|--------|----------------|');
  report.push(`| [SLOT_POLICY] | ${activation.slotPolicy.found ? '✅ YES' : '❌ NO'} | ${activation.slotPolicy.evidence.length} |`);
  report.push(`| [GEN_POLICY] | ${activation.genPolicy.found ? '✅ YES' : '❌ NO'} | ${activation.genPolicy.evidence.length} |`);
  report.push(`| [VOICE_GUIDE] | ${activation.voiceGuide.found ? '✅ YES' : '❌ NO'} | ${activation.voiceGuide.evidence.length} |`);
  report.push(`| [PHASE4][Router] | ${activation.phase4Router.found ? '✅ YES' : '❌ NO'} | ${activation.phase4Router.evidence.length} |`);
  report.push('');

  // 2. Evidence from Logs
  report.push('## 2. Evidence from Logs\n');

  if (activation.slotPolicy.found) {
    report.push('### [SLOT_POLICY] Evidence\n');
    activation.slotPolicy.evidence.slice(0, 5).forEach(entry => {
      report.push(`- **${entry.timestamp || 'No timestamp'}**: \`${entry.line}\``);
    });
    report.push('');
  } else {
    report.push('### [SLOT_POLICY] Evidence\n');
    report.push('❌ No [SLOT_POLICY] entries found in logs\n');
  }

  if (activation.genPolicy.found) {
    report.push('### [GEN_POLICY] Evidence\n');
    activation.genPolicy.evidence.slice(0, 5).forEach(entry => {
      report.push(`- **${entry.timestamp || 'No timestamp'}**: \`${entry.line}\``);
    });
    report.push('');
  } else {
    report.push('### [GEN_POLICY] Evidence\n');
    report.push('❌ No [GEN_POLICY] entries found in logs\n');
  }

  if (activation.voiceGuide.found) {
    report.push('### [VOICE_GUIDE] Evidence\n');
    activation.voiceGuide.evidence.slice(0, 5).forEach(entry => {
      report.push(`- **${entry.timestamp || 'No timestamp'}**: \`${entry.line}\``);
    });
    report.push('');
  } else {
    report.push('### [VOICE_GUIDE] Evidence\n');
    report.push('❌ No [VOICE_GUIDE] entries found in logs\n');
  }

  if (activation.phase4Router.found) {
    report.push('### [PHASE4][Router] Evidence\n');
    activation.phase4Router.evidence.slice(0, 5).forEach(entry => {
      report.push(`- **${entry.timestamp || 'No timestamp'}**: \`${entry.line}\``);
    });
    report.push('');
  } else {
    report.push('### [PHASE4][Router] Evidence\n');
    report.push('❌ No [PHASE4][Router] entries found in logs\n');
  }

  // 3. Plan Job Health
  report.push('## 3. Plan Job Health\n');
  report.push('| Check | Status |');
  report.push('|-------|--------|');
  report.push(`| planJob Running | ${planJob.planJobRunning ? '✅ YES' : '❌ NO'} |`);
  report.push(`| Slot Selected | ${planJob.slotSelected ? '✅ YES' : '❌ NO'} |`);
  report.push(`| Generator Selected | ${planJob.generatorSelected ? '✅ YES' : '❌ NO'} |`);
  report.push(`| Phase 4 Routing | ${planJob.phase4Routing ? '✅ YES' : '❌ NO'} |`);
  report.push('');

  if (planJob.evidence.length > 0) {
    report.push('### Plan Job Evidence\n');
    planJob.evidence.forEach(entry => {
      report.push(`- **${entry.timestamp || 'No timestamp'}**: \`${entry.line}\``);
    });
    report.push('');
  }

  // 4. Errors / Warnings
  report.push('## 4. Errors / Warnings\n');
  
  if (errors.length > 0) {
    report.push(`Found ${errors.length} potential errors/warnings:\n`);
    errors.forEach((error, idx) => {
      report.push(`### Error ${idx + 1}: ${error.type}\n`);
      report.push(`- **Timestamp**: ${error.timestamp || 'Not available'}`);
      report.push(`- **Line**: \`${error.line}\`\n`);
    });
  } else {
    report.push('✅ No critical errors found in logs\n');
  }

  // 5. System Health Status
  report.push('## 5. System Health Status\n');
  
  const allActivated = activation.slotPolicy.found && 
                       activation.genPolicy.found && 
                       activation.voiceGuide.found && 
                       activation.phase4Router.found;
  
  const partialActivation = activation.phase4Router.found || 
                            activation.slotPolicy.found || 
                            activation.genPolicy.found;

  if (allActivated) {
    report.push('✅ **FULLY ACTIVATED**: All Phase 5 components are active\n');
  } else if (partialActivation) {
    report.push('⚠️ **PARTIALLY ACTIVATED**: Some Phase 5 components are active\n');
  } else {
    report.push('❌ **NOT ACTIVATED**: No Phase 5 components detected\n');
  }

  report.push(`- Phase 4 Routing: ${activation.phase4Router.found ? '✅ Active' : '❌ Not detected'}`);
  report.push(`- Slot Policy: ${activation.slotPolicy.found ? '✅ Active' : '❌ Not detected'}`);
  report.push(`- Generator Policy: ${activation.genPolicy.found ? '✅ Active' : '❌ Not detected'}`);
  report.push(`- Voice Guide: ${activation.voiceGuide.found ? '✅ Active' : '❌ Not detected'}`);
  report.push('');

  // 6. Recommendations
  report.push('## 6. Recommendations\n');

  if (allActivated) {
    report.push('✅ **Phase 5 is running correctly.**\n');
    report.push('- Continue monitoring logs');
    report.push('- No action needed at this time');
  } else if (activation.phase4Router.found && !activation.slotPolicy.found && !activation.genPolicy.found) {
    report.push('⚠️ **Phase 4 is active, but Phase 5 policies are not yet initialized.**\n');
    report.push('- **Wait**: Policies initialize lazily on first use');
    report.push('- **Monitor**: Check logs after next `planJob` execution');
    report.push('- **Expected**: Slot policy initializes in `planJob`, generator policy initializes on first generator selection');
  } else if (!planJob.planJobRunning) {
    report.push('⚠️ **planJob has not run recently.**\n');
    report.push('- **Wait**: planJob needs to execute for Phase 5 policies to initialize');
    report.push('- **Check**: Verify planJob schedule/cron is configured correctly');
  } else if (errors.length > 0 && errors.some(e => e.type.includes('Unknown generator'))) {
    report.push('⚠️ **Generator name mismatches detected.**\n');
    report.push('- **Action**: Review generator name consistency (snake_case vs camelCase)');
    report.push('- **Impact**: System falls back gracefully, but may affect policy effectiveness');
  } else {
    report.push('❌ **Phase 5 not detected in logs.**\n');
    report.push('- **Check**: Verify flags are set correctly in Railway');
    report.push('- **Verify**: Run `pnpm phase:flags` to confirm flag values');
    report.push('- **Restart**: May need to restart Railway service for flags to take effect');
  }

  return report.join('\n');
}

function main() {
  console.log('[DIAGNOSTIC] Starting Phase 5 activation check...\n');

  // Fetch logs
  const logLines = fetchRailwayLogs(500);
  console.log(`[DIAGNOSTIC] ✅ Fetched ${logLines.length} log lines\n`);

  // Check activation
  console.log('[DIAGNOSTIC] Checking for Phase 5 activation indicators...');
  const activation = checkActivation(logLines);
  
  // Check planJob health
  console.log('[DIAGNOSTIC] Checking planJob health...');
  const planJob = checkPlanJobHealth(logLines);
  
  // Find errors
  console.log('[DIAGNOSTIC] Scanning for errors...');
  const errors = findErrors(logLines);

  // Generate report
  const report = generateReport(activation, planJob, errors);
  
  // Output report
  console.log('\n' + '='.repeat(80));
  console.log(report);
  console.log('='.repeat(80) + '\n');

  // Save to file
  const fs = require('fs');
  const reportPath = 'docs/reports/PHASE5_ACTIVATION_REPORT.md';
  fs.writeFileSync(reportPath, report);
  console.log(`[DIAGNOSTIC] ✅ Report saved to ${reportPath}`);
}

main();


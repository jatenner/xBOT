#!/usr/bin/env tsx
/**
 * Railway Logs Analysis Tool
 * Analyzes Railway logs to identify failure patterns and root causes
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface FailurePattern {
  category: string;
  pattern: RegExp;
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

interface LogAnalysis {
  errors: {
    database: LogEntry[];
    browser: LogEntry[];
    circuitBreaker: LogEntry[];
    jobs: LogEntry[];
    memory: LogEntry[];
    session: LogEntry[];
    other: LogEntry[];
  };
  successes: {
    posting: LogEntry[];
    scraping: LogEntry[];
    learning: LogEntry[];
  };
  patterns: FailurePattern[];
  rootCauses: string[];
  recommendations: string[];
  performance: {
    postingRate: number;
    scrapingRate: number;
    jobExecutionRate: number;
  };
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, any>;
}

const FAILURE_PATTERNS: FailurePattern[] = [
  {
    category: 'database',
    pattern: /database|supabase|connection|522|timeout|pool.*exhausted/i,
    description: 'Database connection failures',
    severity: 'critical'
  },
  {
    category: 'browser',
    pattern: /browser|playwright|context|pool.*exhausted|OOM|memory/i,
    description: 'Browser pool exhaustion or memory issues',
    severity: 'critical'
  },
  {
    category: 'circuitBreaker',
    pattern: /circuit.*breaker|open|blocked|failures.*threshold/i,
    description: 'Circuit breaker opened',
    severity: 'critical'
  },
  {
    category: 'jobs',
    pattern: /job.*fail|plan.*fail|posting.*fail|scraping.*fail/i,
    description: 'Job execution failures',
    severity: 'warning'
  },
  {
    category: 'memory',
    pattern: /memory|oom|exhausted|leak/i,
    description: 'Memory issues',
    severity: 'critical'
  },
  {
    category: 'session',
    pattern: /session|auth|expired|not.*authenticated/i,
    description: 'Session authentication failures',
    severity: 'warning'
  }
];

const SUCCESS_PATTERNS: FailurePattern[] = [
  {
    category: 'posting',
    pattern: /post.*success|tweet.*posted|POST_SUCCESS|POSTING_QUEUE.*success/i,
    description: 'Successful posts',
    severity: 'info'
  },
  {
    category: 'scraping',
    pattern: /scrap.*success|metrics.*collected|METRICS.*success/i,
    description: 'Successful metrics scraping',
    severity: 'info'
  },
  {
    category: 'learning',
    pattern: /learn.*success|model.*updated|LEARN.*success/i,
    description: 'Successful learning cycles',
    severity: 'info'
  }
];

async function fetchRailwayLogs(tail: number = 10000): Promise<string> {
  try {
    console.log(`[RAILWAY_LOGS] Fetching last ${tail} lines...`);
    const logs = execSync(`railway logs --tail ${tail}`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    return logs;
  } catch (error: any) {
    if (error.message.includes('Unauthorized') || error.message.includes('login')) {
      console.warn('[RAILWAY_LOGS] Railway CLI not authenticated. Using local log file if available...');
      // Try to read from local file if exists
      const logFile = path.join(process.cwd(), 'railway_logs_recent.log');
      if (fs.existsSync(logFile)) {
        return fs.readFileSync(logFile, 'utf-8');
      }
      throw new Error('Railway CLI not authenticated and no local log file found. Run: railway logs --tail 10000 > railway_logs_recent.log');
    }
    throw error;
  }
}

function parseLogs(logs: string): LogEntry[] {
  const lines = logs.split('\n');
  const entries: LogEntry[] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Try to extract timestamp and level
    const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
    const levelMatch = line.match(/(ERROR|WARN|INFO|DEBUG|❌|✅|⚠️)/);
    
    entries.push({
      timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
      level: levelMatch ? levelMatch[1] : 'INFO',
      message: line
    });
  }
  
  return entries;
}

function categorizeErrors(entries: LogEntry[]): LogAnalysis['errors'] {
  const errors: LogAnalysis['errors'] = {
    database: [],
    browser: [],
    circuitBreaker: [],
    jobs: [],
    memory: [],
    session: [],
    other: []
  };
  
  for (const entry of entries) {
    let categorized = false;
    
    for (const pattern of FAILURE_PATTERNS) {
      if (pattern.pattern.test(entry.message)) {
        errors[pattern.category as keyof typeof errors].push(entry);
        categorized = true;
        break;
      }
    }
    
    if (!categorized && /error|fail|❌/i.test(entry.message)) {
      errors.other.push(entry);
    }
  }
  
  return errors;
}

function categorizeSuccesses(entries: LogEntry[]): LogAnalysis['successes'] {
  const successes: LogAnalysis['successes'] = {
    posting: [],
    scraping: [],
    learning: []
  };
  
  for (const entry of entries) {
    for (const pattern of SUCCESS_PATTERNS) {
      if (pattern.pattern.test(entry.message)) {
        successes[pattern.category as keyof typeof successes].push(entry);
        break;
      }
    }
  }
  
  return successes;
}

function identifyRootCauses(errors: LogAnalysis['errors']): string[] {
  const rootCauses: string[] = [];
  
  if (errors.database.length > 10) {
    rootCauses.push('Database connection pool exhausted or timeout issues');
  }
  
  if (errors.browser.length > 10) {
    rootCauses.push('Browser pool resource exhaustion');
  }
  
  if (errors.circuitBreaker.length > 5) {
    rootCauses.push('Circuit breaker opening due to repeated failures');
  }
  
  if (errors.jobs.length > 20) {
    rootCauses.push('Job execution failures due to missing dependencies or resources');
  }
  
  if (errors.memory.length > 5) {
    rootCauses.push('Memory exhaustion causing OOM kills');
  }
  
  if (errors.session.length > 10) {
    rootCauses.push('Session expiration causing authentication failures');
  }
  
  return rootCauses;
}

function generateRecommendations(analysis: LogAnalysis): string[] {
  const recommendations: string[] = [];
  
  if (analysis.errors.database.length > 10) {
    recommendations.push('Implement UnifiedDatabase with connection pooling and retry logic');
  }
  
  if (analysis.errors.browser.length > 10) {
    recommendations.push('Migrate all browser usage to UnifiedBrowserPool with resource budgeting');
  }
  
  if (analysis.errors.circuitBreaker.length > 5) {
    recommendations.push('Implement dependency management to prevent cascading failures');
  }
  
  if (analysis.errors.jobs.length > 20) {
    recommendations.push('Implement job framework with dependency checking and resource allocation');
  }
  
  if (analysis.errors.memory.length > 5) {
    recommendations.push('Implement resource management framework to prevent memory exhaustion');
  }
  
  if (analysis.performance.postingRate < 0.95) {
    recommendations.push('Investigate posting failures and implement resilience framework');
  }
  
  return recommendations;
}

function calculatePerformanceMetrics(entries: LogEntry[]): LogAnalysis['performance'] {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  const recentEntries = entries.filter(e => {
    const entryTime = new Date(e.timestamp).getTime();
    return entryTime > oneDayAgo;
  });
  
  const postingSuccesses = recentEntries.filter(e => 
    /post.*success|tweet.*posted|POST_SUCCESS/i.test(e.message)
  ).length;
  
  const scrapingSuccesses = recentEntries.filter(e => 
    /scrap.*success|metrics.*collected/i.test(e.message)
  ).length;
  
  const jobExecutions = recentEntries.filter(e => 
    /job.*complete|job.*success/i.test(e.message)
  ).length;
  
  const totalPosts = recentEntries.filter(e => 
    /posting|post.*attempt/i.test(e.message)
  ).length;
  
  const totalScrapes = recentEntries.filter(e => 
    /scrap|metrics/i.test(e.message)
  ).length;
  
  const totalJobs = recentEntries.filter(e => 
    /job.*start|job.*run/i.test(e.message)
  ).length;
  
  return {
    postingRate: totalPosts > 0 ? postingSuccesses / totalPosts : 0,
    scrapingRate: totalScrapes > 0 ? scrapingSuccesses / totalScrapes : 0,
    jobExecutionRate: totalJobs > 0 ? jobExecutions / totalJobs : 0
  };
}

export async function analyzeRailwayLogs(tail: number = 10000): Promise<LogAnalysis> {
  console.log('[RAILWAY_LOGS] Starting analysis...');
  
  const logs = await fetchRailwayLogs(tail);
  const entries = parseLogs(logs);
  
  console.log(`[RAILWAY_LOGS] Parsed ${entries.length} log entries`);
  
  const errors = categorizeErrors(entries);
  const successes = categorizeSuccesses(entries);
  const rootCauses = identifyRootCauses(errors);
  const performance = calculatePerformanceMetrics(entries);
  const recommendations = generateRecommendations({
    errors,
    successes,
    patterns: FAILURE_PATTERNS,
    rootCauses,
    recommendations: [],
    performance
  });
  
  return {
    errors,
    successes,
    patterns: FAILURE_PATTERNS,
    rootCauses,
    recommendations,
    performance
  };
}

async function generateReport(analysis: LogAnalysis): Promise<string> {
  const report = `# Railway Logs Analysis Report
Generated: ${new Date().toISOString()}

## Error Summary

### Database Errors: ${analysis.errors.database.length}
${analysis.errors.database.slice(0, 5).map(e => `- ${e.message.substring(0, 100)}`).join('\n')}

### Browser Errors: ${analysis.errors.browser.length}
${analysis.errors.browser.slice(0, 5).map(e => `- ${e.message.substring(0, 100)}`).join('\n')}

### Circuit Breaker Opens: ${analysis.errors.circuitBreaker.length}
${analysis.errors.circuitBreaker.slice(0, 5).map(e => `- ${e.message.substring(0, 100)}`).join('\n')}

### Job Failures: ${analysis.errors.jobs.length}
${analysis.errors.jobs.slice(0, 5).map(e => `- ${e.message.substring(0, 100)}`).join('\n')}

## Success Summary

### Posting Successes: ${analysis.successes.posting.length}
### Scraping Successes: ${analysis.successes.scraping.length}
### Learning Successes: ${analysis.successes.learning.length}

## Performance Metrics

- Posting Success Rate: ${(analysis.performance.postingRate * 100).toFixed(1)}%
- Scraping Success Rate: ${(analysis.performance.scrapingRate * 100).toFixed(1)}%
- Job Execution Rate: ${(analysis.performance.jobExecutionRate * 100).toFixed(1)}%

## Root Causes Identified

${analysis.rootCauses.map(rc => `- ${rc}`).join('\n')}

## Recommendations

${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}
`;
  
  return report;
}

// CLI execution
if (require.main === module) {
  const tail = parseInt(process.argv[2]) || 10000;
  
  analyzeRailwayLogs(tail)
    .then(async (analysis) => {
      const report = await generateReport(analysis);
      console.log(report);
      
      // Save to file
      const reportPath = path.join(process.cwd(), 'RAILWAY_FAILURE_PATTERNS.md');
      fs.writeFileSync(reportPath, report);
      console.log(`\n[RAILWAY_LOGS] Report saved to ${reportPath}`);
    })
    .catch((error) => {
      console.error('[RAILWAY_LOGS] Analysis failed:', error.message);
      process.exit(1);
    });
}




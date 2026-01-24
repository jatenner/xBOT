/**
 * 🚀 RAILWAY UNIFIED ENTRYPOINT
 * Single entrypoint for both worker and main services
 * MUST start health server IMMEDIATELY before any other initialization
 */

import 'dotenv/config';
import { createServer, Server } from 'http';
import { randomUUID } from 'crypto';
import * as os from 'os';

// 🏥 STEP 0: Start health server IMMEDIATELY (before anything else)
let healthServer: Server | null = null;

// Generate boot_id once at process start (anti-lie field)
const bootId = randomUUID();
const bootTime = new Date().toISOString();
const hostname = os.hostname();
const pid = process.pid;

function startHealthServer(): void {
  if (healthServer) {
    console.log('[HEALTH] Server already running');
    return;
  }

  const port = Number(process.env.PORT ?? 8080);
  const host = '0.0.0.0';
  // Prefer APP_VERSION (set at build time) over Railway's env vars for deterministic versioning
  // IMPORTANT: Do NOT use hardcoded defaults - let 'unknown' show if env vars are missing
  const serviceName = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || 'unknown';

  // 🔒 PHASE 4.B: DEPLOYMENT INTEGRITY CHECK - Log at boot
  const appVersion = process.env.APP_VERSION ?? 'unknown';
  const gitSha = process.env.APP_VERSION ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'unknown';
  // 🔒 DEPLOY FINGERPRINT: Required for deploy verification
  const appCommitSha = process.env.APP_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'unknown';
  const appBuildTime = process.env.APP_BUILD_TIME ?? 'unknown';
  const railwayServiceName = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || '';
  const serviceRole = process.env.SERVICE_ROLE || (railwayServiceName.includes('worker') ? 'worker' : 'main') || 'unknown';
  const railwayService = railwayServiceName || 'unknown';
  const executionMode = process.env.EXECUTION_MODE || 'control'; // Default to control (fail-closed)
  const runnerMode = process.env.RUNNER_MODE === 'true';
  
  // Determine jobs_enabled status (will be set later in background init)
  const jobsEnabled = 'pending'; // Will be updated after role resolution
  
  // Single-line boot fingerprint (required for deploy verification)
  console.log(`[BOOT] sha=${appCommitSha} build_time=${appBuildTime} execution_mode=${executionMode} runner_mode=${runnerMode} service_role=${serviceRole} railway_service=${railwayService} jobs_enabled=${jobsEnabled}`);
  
  console.log(`[BOOT] git_sha=${gitSha}`);
  console.log(`[BOOT] RAILWAY_GIT_COMMIT_SHA=${process.env.RAILWAY_GIT_COMMIT_SHA ?? 'missing'}`);
  console.log(`[BOOT] VERIFY_SHA: RAILWAY_GIT_COMMIT_SHA=${process.env.RAILWAY_GIT_COMMIT_SHA ?? 'NOT_SET'}`);
  console.log(`[BOOT] app_version=${appVersion}`);
  console.log(`[BOOT] boot_id=${bootId}`);
  console.log(`[BOOT] boot_time=${bootTime}`);
  
  console.log(`[HEALTH] Starting health server on ${host}:${port}...`);
  console.log(`[HEALTH] Boot ID: ${bootId}`);
  console.log(`[HEALTH] Boot time: ${bootTime}`);
  console.log(`[HEALTH] Hostname: ${hostname}`);
  console.log(`[HEALTH] PID: ${pid}`);
  console.log(`[HEALTH] APP_VERSION: ${process.env.APP_VERSION || 'NOT SET'}`);
  console.log(`[HEALTH] RAILWAY_GIT_COMMIT_SHA: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'NOT SET'}`);

  healthServer = createServer(async (req, res) => {
    // Minimal /healthz endpoint for SHA verification (no secrets, fast)
    if (req.url?.startsWith('/healthz')) {
      // Prioritize RAILWAY_GIT_COMMIT_SHA (set by Railway GitHub Integration) over APP_COMMIT_SHA (build-time)
      const railwaySha = process.env.RAILWAY_GIT_COMMIT_SHA || null;
      const appSha = process.env.APP_COMMIT_SHA || null;
      const gitSha = process.env.GIT_SHA || null;
      const sha = railwaySha ?? appSha ?? gitSha ?? 'unknown';
      const serviceName = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || 'unknown';
      const executionMode = process.env.EXECUTION_MODE || 'control';
      const runnerMode = process.env.RUNNER_MODE === 'true';
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(JSON.stringify({
        sha,
        railway_sha: railwaySha,
        app_sha: appSha,
        git_sha: gitSha,
        serviceName,
        executionMode,
        runnerMode
      }));
      return;
    }
    
    // Respond to healthcheck endpoints
    if (req.url === '/status' || req.url === '/health') {
      // Get session path info
      let sessionPathInfo: any = {
        resolvedPath: 'unknown',
        exists: false,
        size: null,
        mtime: null,
        writable: false,
      };
      try {
        const { getSessionPathInfo } = await import('./utils/sessionPathResolver');
        sessionPathInfo = getSessionPathInfo();
      } catch (e: any) {
        console.warn(`[HEALTH] Could not get session path info: ${e.message}`);
      }
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      });
      // Compute fingerprint fields dynamically (read env vars at request time)
      const appCommitSha = process.env.APP_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'unknown';
      const appBuildTime = process.env.APP_BUILD_TIME ?? 'unknown';
      const railwayServiceName = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || '';
      const serviceRole = process.env.SERVICE_ROLE || (railwayServiceName.includes('worker') ? 'worker' : 'main') || 'unknown';
      
      // Compute version fields dynamically (do NOT cache - read env vars at request time)
      const appVersion = process.env.APP_VERSION ?? 'unknown';
      const gitSha = process.env.APP_VERSION ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'unknown';
      
      // Determine jobs_enabled (read from env or infer from role)
      const { resolveServiceRole } = await import('./utils/serviceRoleResolver');
      const roleInfo = resolveServiceRole();
      const disableAllJobs = process.env.DISABLE_ALL_JOBS === 'true';
      const jobsEnabled = roleInfo.role === 'worker' && !disableAllJobs;
      
      res.end(JSON.stringify({
        ok: true,
        sha: appCommitSha,
        build_time: appBuildTime,
        service_role: serviceRole,
        railway_service: railwayServiceName || 'unknown',
        jobs_enabled: jobsEnabled,
        status: 'healthy',
        git_sha: gitSha,
        app_version: appVersion,
        service_name: serviceName,
        timestamp: new Date().toISOString(),
        // Anti-lie fields
        boot_id: bootId,
        boot_time: bootTime,
        hostname: hostname,
        pid: pid,
        git_sha_env: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'missing',
        railway_git_commit_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'missing',
        railway_git_author: process.env.RAILWAY_GIT_AUTHOR ?? 'missing',
        railway_git_branch: process.env.RAILWAY_GIT_BRANCH ?? 'missing',
        railway_git_commit_message: process.env.RAILWAY_GIT_COMMIT_MESSAGE ?? 'missing',
        railway_service_name: process.env.RAILWAY_SERVICE_NAME ?? 'missing',
        railway_environment: process.env.RAILWAY_ENVIRONMENT ?? 'missing',
        // Session path info
        session_canonical_path_env: process.env.SESSION_CANONICAL_PATH || '(not set)',
        session_path_resolved: sessionPathInfo.resolvedPath || 'unknown',
        session_path_exists: sessionPathInfo.exists || false,
        session_path_size_bytes: sessionPathInfo.size || null,
        session_file_mtime: sessionPathInfo.mtime || null,
        session_directory_writable: sessionPathInfo.writable || false,
      }));
    } else if (req.url === '/metrics/replies') {
      // Reply decisions metrics endpoint
      try {
        const { getSupabaseClient } = await import('./db');
        const supabase = getSupabaseClient();
        
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        
        // 🔒 TRUTHFUL: Compute from columns, not reason parsing
        const { data: last24hData } = await supabase
          .from('reply_decisions')
          .select('decision, status, method, cache_hit, deny_reason_code, posted_reply_tweet_id, created_at, reward_24h')
          .gte('created_at', last24h);
        
        const { data: last1hData } = await supabase
          .from('reply_decisions')
          .select('decision, status, method, cache_hit, deny_reason_code, posted_reply_tweet_id, created_at, reward_24h')
          .gte('created_at', last1h);
        
        const total24h = last24hData?.length || 0;
        const allow24h = last24hData?.filter(r => r.decision === 'ALLOW').length || 0;
        const deny24h = last24hData?.filter(r => r.decision === 'DENY').length || 0;
        const uncertain24h = last24hData?.filter(r => r.status === 'UNCERTAIN').length || 0;
        const error24h = last24hData?.filter(r => r.status === 'ERROR').length || 0;
        const ok24h = last24hData?.filter(r => r.status === 'OK').length || 0;
        const cacheHits24h = last24hData?.filter(r => r.cache_hit === true).length || 0;
        const allowRate24h = total24h > 0 ? ((allow24h / total24h) * 100).toFixed(2) : '0.00';
        const posted24h = last24hData?.filter(r => r.posted_reply_tweet_id).length || 0;
        const postedRate24h = allow24h > 0 ? ((posted24h / allow24h) * 100).toFixed(2) : '0.00';
        const now24h = new Date();
        const learnable24h = last24hData?.filter(r => 
          r.posted_reply_tweet_id && 
          r.decision === 'ALLOW' &&
          new Date(r.created_at).getTime() < now24h.getTime() - 24 * 60 * 60 * 1000
        ).length || 0;
        
        // 🎯 ANALYTICS: Deny reason breakdown
        const denyReasonBreakdown24h = (last24hData || [])
          .filter(r => r.decision === 'DENY')
          .reduce((acc: Record<string, number>, r) => {
            const code = r.deny_reason_code || 'OTHER';
            acc[code] = (acc[code] || 0) + 1;
            return acc;
          }, {});
        
        // 🎯 ANALYTICS: Consent wall rate
        const consentWallCount24h = denyReasonBreakdown24h['CONSENT_WALL'] || 0;
        const consentWallRate24h = total24h > 0 ? ((consentWallCount24h / total24h) * 100).toFixed(2) + '%' : '0%';
        
        // Method breakdown
        const methodBreakdown24h = (last24hData || []).reduce((acc: Record<string, { allow: number; deny: number }>, r) => {
          const method = r.method || 'unknown';
          if (!acc[method]) acc[method] = { allow: 0, deny: 0 };
          if (r.decision === 'ALLOW') acc[method].allow++;
          else acc[method].deny++;
          return acc;
        }, {});
        
        // 🎯 PART A: Ancestry metrics
        const ancestryAttemptsLast1h = (global as any).ancestryAttemptsLast1h || 0;
        const ancestryUsedPoolLast1h = (global as any).ancestryUsedPoolLast1h || 0;
        
        // 🎯 POOL HEALTH: Get browser pool stats (truthful)
        let poolHealth: any = {};
        try {
          const { UnifiedBrowserPool } = await import('./browser/UnifiedBrowserPool');
          const pool = UnifiedBrowserPool.getInstance();
          const metrics = pool.getMetrics();
          const poolAny = pool as any;
          
          // Get real values from pool
          const activeContexts = poolAny.getActiveCount?.() || 0;
          const totalContexts = poolAny.contexts?.size || 0;
          const idleContexts = Math.max(0, totalContexts - activeContexts);
          const queueLen = poolAny.queue?.length || 0;
          const maxContexts = poolAny.MAX_CONTEXTS || 0;
          
          // Get ancestry limiter stats if available
          let semaphoreInflight = 0;
          try {
            const { getAncestryLimiter } = await import('./utils/ancestryConcurrencyLimiter');
            const limiter = getAncestryLimiter();
            const limiterStats = limiter.getStats();
            semaphoreInflight = limiterStats.current || 0;
          } catch {
            // Limiter not available
          }
          
          // Calculate avg wait time from metrics
          const avgWaitMs = (metrics as any).averageWaitTime || 0;
          const timeoutsLast1h = (metrics as any).timeoutsLast1h || 0;
          
          poolHealth = {
            contexts_created_total: metrics.contextsCreated || 0,
            active_contexts: activeContexts,
            idle_contexts: idleContexts,
            total_contexts: totalContexts,
            max_contexts: maxContexts,
            queue_len: queueLen,
            avg_wait_ms: Math.round(avgWaitMs),
            total_operations: metrics.totalOperations || 0,
            successful_operations: metrics.successfulOperations || 0,
            failed_operations: metrics.failedOperations || 0,
            peak_queue: metrics.peakQueue || 0,
            semaphore_inflight: semaphoreInflight,
            timeouts_last_1h: timeoutsLast1h,
          };
        } catch (e: any) {
          poolHealth = { error: e.message };
        }
        
        const total1h = last1hData?.length || 0;
        const allow1h = last1hData?.filter(r => r.decision === 'ALLOW').length || 0;
        const deny1h = last1hData?.filter(r => r.decision === 'DENY').length || 0;
        const uncertain1h = last1hData?.filter(r => r.status === 'UNCERTAIN').length || 0;
        const error1h = last1hData?.filter(r => r.status === 'ERROR').length || 0;
        const ok1h = last1hData?.filter(r => r.status === 'OK').length || 0;
        const cacheHits1h = last1hData?.filter(r => r.cache_hit === true).length || 0;
        const allowRate1h = total1h > 0 ? ((allow1h / total1h) * 100).toFixed(2) : '0.00';
        const posted1h = last1hData?.filter(r => r.posted_reply_tweet_id).length || 0;
        const postedRate1h = allow1h > 0 ? ((posted1h / allow1h) * 100).toFixed(2) : '0.00';
        const now1h = new Date();
        const learnable1h = last1hData?.filter(r => 
          r.posted_reply_tweet_id && 
          r.decision === 'ALLOW' &&
          new Date(r.created_at).getTime() < now1h.getTime() - 24 * 60 * 60 * 1000
        ).length || 0;
        
        // 🎯 ANALYTICS: Deny reason breakdown (1h)
        const denyReasonBreakdown1h = (last1hData || [])
          .filter(r => r.decision === 'DENY')
          .reduce((acc: Record<string, number>, r) => {
            const code = r.deny_reason_code || 'OTHER';
            acc[code] = (acc[code] || 0) + 1;
            return acc;
          }, {});
        
        // 🎯 ANALYTICS: Consent wall rate (1h)
        const consentWallCount1h = denyReasonBreakdown1h['CONSENT_WALL'] || 0;
        const consentWallRate1h = total1h > 0 ? ((consentWallCount1h / total1h) * 100).toFixed(2) + '%' : '0%';
        
        // 🎯 ANALYTICS: Consent wall failures by variant (parse from reason field)
        const consentWallFailuresByVariant1h: Record<string, number> = {};
        const consentWallFailuresByVariant24h: Record<string, number> = {};
        
        (last1hData || []).forEach((r: any) => {
          if (r.decision === 'DENY' && r.deny_reason_code === 'CONSENT_WALL' && r.reason) {
            const variantMatch = r.reason.match(/variant=(\w+)/);
            if (variantMatch) {
              const variant = variantMatch[1];
              consentWallFailuresByVariant1h[variant] = (consentWallFailuresByVariant1h[variant] || 0) + 1;
            } else {
              consentWallFailuresByVariant1h['unknown'] = (consentWallFailuresByVariant1h['unknown'] || 0) + 1;
            }
          }
        });
        
        (last24hData || []).forEach((r: any) => {
          if (r.decision === 'DENY' && r.deny_reason_code === 'CONSENT_WALL' && r.reason) {
            const variantMatch = r.reason.match(/variant=(\w+)/);
            if (variantMatch) {
              const variant = variantMatch[1];
              consentWallFailuresByVariant24h[variant] = (consentWallFailuresByVariant24h[variant] || 0) + 1;
            } else {
              consentWallFailuresByVariant24h['unknown'] = (consentWallFailuresByVariant24h['unknown'] || 0) + 1;
            }
          }
        });
        
        // 🎯 WARNING: Log if consent wall rate is high
        if (consentWallCount1h > 0) {
          console.warn(`[METRICS] ⚠️ Consent wall detected: ${consentWallCount1h} in last 1h (${consentWallRate1h})`);
          if (Object.keys(consentWallFailuresByVariant1h).length > 0) {
            console.warn(`[METRICS] ⚠️ Consent wall variants: ${JSON.stringify(consentWallFailuresByVariant1h)}`);
          }
        }
        
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({
          last_24h: {
            total: total24h,
            allow: allow24h,
            deny: deny24h,
            uncertain: uncertain24h,
            error: error24h,
            ok: ok24h,
            cache_hits: cacheHits24h,
            cache_hit_rate: total24h > 0 ? ((cacheHits24h / total24h) * 100).toFixed(1) + '%' : '0%',
            method_breakdown: methodBreakdown24h,
            deny_reason_breakdown: denyReasonBreakdown24h, // 🎯 ANALYTICS: Deny reason breakdown
            consent_wall_rate: consentWallRate24h, // 🎯 ANALYTICS: Consent wall rate
            consent_wall_failures_by_variant: consentWallFailuresByVariant24h, // 🎯 ANALYTICS: Consent wall failures by variant
            allow_rate: allowRate24h + '%', // 🎯 LEARNING: ALLOW rate
            posted_rate: postedRate24h + '%', // 🎯 LEARNING: Posting success rate
            learnable_count: learnable24h, // 🎯 LEARNING: Learnable count (posted 24h+ ago)
            pool_health: poolHealth, // 🎯 POOL HEALTH: Browser pool stats
            ancestry_attempts: ancestryAttemptsLast1h, // 🎯 PART A: Ancestry attempt counter
            ancestry_used_pool: ancestryUsedPoolLast1h, // 🎯 PART A: Ancestry pool usage counter
          },
          last_1h: {
            total: total1h,
            allow: allow1h,
            deny: deny1h,
            uncertain: uncertain1h,
            error: error1h,
            ok: ok1h,
            cache_hits: cacheHits1h,
            cache_hit_rate: total1h > 0 ? ((cacheHits1h / total1h) * 100).toFixed(1) + '%' : '0%',
            deny_reason_breakdown: denyReasonBreakdown1h, // 🎯 ANALYTICS: Deny reason breakdown
            consent_wall_rate: consentWallRate1h, // 🎯 ANALYTICS: Consent wall rate
            consent_wall_failures_by_variant: consentWallFailuresByVariant1h, // 🎯 ANALYTICS: Consent wall failures by variant
            allow_rate: allowRate1h + '%', // 🎯 LEARNING: ALLOW rate
            posted_rate: postedRate1h + '%', // 🎯 LEARNING: Posting success rate
            learnable_count: learnable1h, // 🎯 LEARNING: Learnable count (posted 24h+ ago)
            pool_health: poolHealth, // 🎯 POOL HEALTH: Browser pool stats
            ancestry_attempts: ancestryAttemptsLast1h, // 🎯 PART A: Ancestry attempt counter
            ancestry_used_pool: ancestryUsedPoolLast1h, // 🎯 PART A: Ancestry pool usage counter
          },
          timestamp: new Date().toISOString(),
        }));
      } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });

  // 🎯 STARTUP CHECK: Verify reply_templates table has rows
  (async () => {
    try {
      const { getSupabaseClient } = await import('./db');
      const supabase = getSupabaseClient();
      const { data: templates, error } = await supabase
        .from('reply_templates')
        .select('id')
        .limit(1);
      
      if (error) {
        console.error(`[STARTUP] ❌ Failed to check reply_templates: ${error.message}`);
      } else if (!templates || templates.length === 0) {
        console.error(`[STARTUP] ❌ CRITICAL: reply_templates table is empty! Template selection will fail.`);
      } else {
        console.log(`[STARTUP] ✅ reply_templates table has ${templates.length}+ templates`);
      }
    } catch (checkError: any) {
      console.error(`[STARTUP] ⚠️ Template check failed: ${checkError.message}`);
    }
  })();

  healthServer.listen(port, host, () => {
    console.log(`[HEALTH] Starting health server on ${host}:${port}...`);
    console.log(`[HEALTH] ✅ Listening on ${host}:${port}`);
    console.log(`[HEALTH] Git SHA: ${gitSha.substring(0, 8)}`);
    console.log(`[HEALTH] Git SHA (full): ${gitSha}`);
    console.log(`[HEALTH] APP_VERSION: ${process.env.APP_VERSION || 'NOT SET'}`);
    console.log(`[HEALTH] RAILWAY_GIT_COMMIT_SHA: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'NOT SET'}`);
    console.log(`[HEALTH] Boot ID: ${bootId}`);
    console.log(`[HEALTH] Service: ${serviceName}`);
    console.log(`[HEALTH] Boot time: ${bootTime}`);
    console.log(`[HEALTH] Hostname: ${hostname}`);
    console.log(`[HEALTH] PID: ${pid}`);
    console.log(`[HEALTH] Healthcheck endpoint: http://${host}:${port}/status`);
  });

  healthServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[HEALTH] ❌ Port ${port} already in use`);
    } else {
      console.error(`[HEALTH] ❌ Server error: ${error.message}`);
    }
  });
}

// Start health server IMMEDIATELY
startHealthServer();

// PART 1: Boot diagnostics for Playwright browser paths
setImmediate(async () => {
  try {
    console.log('[BOOT][PLAYWRIGHT] Checking Playwright browser installation...');
    
    // Check Playwright version
    try {
      const playwrightPkg = require('playwright/package.json');
      console.log(`[BOOT][PLAYWRIGHT] Playwright version: ${playwrightPkg.version}`);
    } catch (e: any) {
      console.warn(`[BOOT][PLAYWRIGHT] Could not read Playwright version: ${e.message}`);
    }
    
    // Check PLAYWRIGHT_BROWSERS_PATH
    const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || '(not set)';
    console.log(`[BOOT][PLAYWRIGHT] PLAYWRIGHT_BROWSERS_PATH: ${browsersPath}`);
    
    // Check common browser paths
    const fs = require('fs');
    const paths = [
      '/ms-playwright',
      '/ms-playwright/chromium-*/chrome-linux/chrome',
      '/ms-playwright/chromium-*/chrome-linux/headless_shell',
      '/ms-playwright/chromium_headless_shell-*/chrome-linux/headless_shell',
    ];
    
    console.log('[BOOT][PLAYWRIGHT] Checking browser paths...');
    for (const pathPattern of paths) {
      try {
        // Try to find matching directories/files
        if (pathPattern.includes('*')) {
          const baseDir = pathPattern.split('*')[0];
          if (fs.existsSync(baseDir)) {
            const entries = fs.readdirSync(baseDir, { withFileTypes: true });
            const matches = entries.filter(e => e.name.startsWith('chromium'));
            console.log(`[BOOT][PLAYWRIGHT] Found ${matches.length} chromium directories in ${baseDir}`);
            for (const match of matches.slice(0, 3)) { // Limit to first 3
              const fullPath = `${baseDir}${match.name}`;
              const exists = fs.existsSync(fullPath);
              console.log(`[BOOT][PLAYWRIGHT]   ${fullPath}: ${exists ? 'EXISTS' : 'MISSING'}`);
            }
          } else {
            console.log(`[BOOT][PLAYWRIGHT]   ${baseDir}: MISSING`);
          }
        } else {
          const exists = fs.existsSync(pathPattern);
          console.log(`[BOOT][PLAYWRIGHT]   ${pathPattern}: ${exists ? 'EXISTS' : 'MISSING'}`);
        }
      } catch (e: any) {
        console.log(`[BOOT][PLAYWRIGHT]   ${pathPattern}: ERROR (${e.message})`);
      }
    }
    
    // Try to list /ms-playwright directory if it exists
    try {
      if (fs.existsSync('/ms-playwright')) {
        const entries = fs.readdirSync('/ms-playwright', { withFileTypes: true });
        console.log(`[BOOT][PLAYWRIGHT] /ms-playwright contents (${entries.length} entries):`);
        for (const entry of entries.slice(0, 10)) { // Limit to first 10
          const type = entry.isDirectory() ? 'DIR' : 'FILE';
          console.log(`[BOOT][PLAYWRIGHT]   ${type}: ${entry.name}`);
        }
        
        // STEP 3: Check for chromium executables
        console.log('[BOOT][PLAYWRIGHT] Checking for chromium executables...');
        const { execSync } = require('child_process');
        try {
          const lsOutput = execSync('ls -la /ms-playwright | head -20', { encoding: 'utf8', timeout: 5000 });
          console.log(`[BOOT][PLAYWRIGHT] ls -la /ms-playwright (first 20 lines):`);
          console.log(lsOutput.split('\n').slice(0, 20).join('\n'));
        } catch (e: any) {
          console.warn(`[BOOT][PLAYWRIGHT] ls failed: ${e.message}`);
        }
        
        try {
          const findOutput = execSync('find /ms-playwright -maxdepth 3 -type f \\( -name headless_shell -o -name chrome \\) | head -10', { encoding: 'utf8', timeout: 5000 });
          const found = findOutput.trim().split('\n').filter(Boolean);
          console.log(`[BOOT][PLAYWRIGHT] Found ${found.length} chromium executables:`);
          found.slice(0, 10).forEach((path: string) => {
            console.log(`[BOOT][PLAYWRIGHT]   ${path}`);
          });
        } catch (e: any) {
          console.warn(`[BOOT][PLAYWRIGHT] find failed: ${e.message}`);
        }
      } else {
        console.log('[BOOT][PLAYWRIGHT] /ms-playwright: MISSING');
      }
    } catch (e: any) {
      console.warn(`[BOOT][PLAYWRIGHT] Could not list /ms-playwright: ${e.message}`);
    }
    
    console.log('[BOOT][PLAYWRIGHT] Browser path check complete');
  } catch (error: any) {
    console.error(`[BOOT][PLAYWRIGHT] Error during browser path check: ${error.message}`);
  }
});

// Log session file status at boot (for consent persistence verification)
// 🎯 SEED SESSION ON BOOT: If SEED_SESSION_ON_BOOT=true and file doesn't exist, create it
setImmediate(async () => {
  try {
    const { getSessionPathInfo } = await import('./utils/sessionPathResolver');
    const info = getSessionPathInfo();
    
    console.log(`[BOOT] SESSION_CANONICAL_PATH env: ${info.envVar || '(not set)'}`);
    console.log(`[BOOT] Resolved session path: ${info.resolvedPath}`);
    console.log(`[BOOT] Session file exists: ${info.exists}`);
    console.log(`[BOOT] Directory writable: ${info.writable}`);
    
    if (info.exists && info.size !== undefined && info.mtime) {
      console.log(`[BOOT] Session file size: ${info.size} bytes`);
      console.log(`[BOOT] Session file last modified: ${info.mtime}`);
    } else {
      console.log(`[BOOT] Session file not found - will be created on first consent acceptance`);
      
      // 🎯 SEED SESSION ON BOOT: Create session file if SEED_SESSION_ON_BOOT=true
      // Run in background with timeout to avoid blocking boot
      if (process.env.SEED_SESSION_ON_BOOT === 'true') {
        console.log(`[BOOT] SEED_SESSION_ON_BOOT=true - creating session file in background...`);
        // Run in background (don't await) to avoid blocking boot
        (async () => {
          try {
            // Wait a bit for services to initialize
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const { UnifiedBrowserPool } = await import('./browser/UnifiedBrowserPool');
            const pool = UnifiedBrowserPool.getInstance();
            const testUrl = 'https://x.com/DrBryanJohnson';
            
            // Use shorter timeout for boot seeding (30s instead of default)
            const seedPromise = pool.withContext('boot_session_seed', async (context) => {
              const page = await context.newPage();
              await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
              await page.waitForTimeout(2000);
              
              const { ensureConsentAccepted, saveTwitterState } = await import('./playwright/twitterSession');
              await ensureConsentAccepted(page, async () => {
                await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await page.waitForTimeout(2000);
              });
              
              const saved = await saveTwitterState(context);
              if (saved) {
                const infoAfter = getSessionPathInfo();
                console.log(`[BOOT] ✅ Session file created: ${infoAfter.resolvedPath}, size=${infoAfter.size} bytes`);
              } else {
                console.warn(`[BOOT] ⚠️ Failed to save session file`);
              }
            });
            
            // Timeout after 60s
            await Promise.race([
              seedPromise,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Boot seeding timeout')), 60000))
            ]);
          } catch (seedError: any) {
            console.error(`[BOOT] ❌ Failed to seed session: ${seedError.message}`);
            // Don't throw - boot seeding failure shouldn't block service startup
          }
        })();
      }
    }
  } catch (error: any) {
    console.warn(`[BOOT] Could not check session file status: ${error.message}`);
  }
});

// Minimal boot logging (health server already started)

// Background initialization (NON-BLOCKING - health server already running)
setImmediate(async () => {
  try {
    // Determine service type using role resolver (single source of truth)
    const { resolveServiceRole } = await import('./utils/serviceRoleResolver');
    const roleInfo = resolveServiceRole();
    
    // 🔒 HARD DISABLE: Check DISABLE_ALL_JOBS override
    const disableAllJobs = process.env.DISABLE_ALL_JOBS === 'true';
    const isWorkerService = roleInfo.role === 'worker' && !disableAllJobs;

    console.log(`[BOOT] Service type: ${isWorkerService ? 'WORKER' : 'MAIN'}`);
    console.log(`[BOOT] Resolved role: ${roleInfo.role} (source: ${roleInfo.source})`);
    console.log(`[BOOT] SERVICE_ROLE: ${roleInfo.raw.SERVICE_ROLE || 'NOT SET'}`);
    console.log(`[BOOT] RAILWAY_SERVICE_NAME: ${roleInfo.raw.RAILWAY_SERVICE_NAME || 'NOT SET'}`);
    console.log(`[BOOT] Service name: ${process.env.RAILWAY_SERVICE_NAME || 'unknown'}`);
    console.log(`[BOOT] DISABLE_ALL_JOBS: ${process.env.DISABLE_ALL_JOBS || 'NOT SET'}`);
    const jobsEnabledReason = isWorkerService ? 'worker' : (disableAllJobs ? 'DISABLE_ALL_JOBS=true' : 'non-worker');
    console.log(`[BOOT] jobs_enabled=${isWorkerService} reason=${jobsEnabledReason}`);
    
    // Update boot fingerprint log with final jobs_enabled status
    console.log(`[BOOT] sha=${process.env.APP_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? 'unknown'} build_time=${process.env.APP_BUILD_TIME ?? 'unknown'} service_role=${roleInfo.role} railway_service=${process.env.RAILWAY_SERVICE_NAME || 'unknown'} jobs_enabled=${isWorkerService}`);

    if (isWorkerService) {
      // WORKER SERVICE: Start job manager
      console.log('[BOOT] Starting worker jobs AFTER health is up...');
      
      // Import and start worker
      const { startWorker } = await import('./jobs/jobManagerWorker');
      await startWorker();
      
      console.log('[BOOT] Worker service started successfully');
    } else {
      // MAIN SERVICE: Just keep alive (health server handles healthchecks)
      console.log('[BOOT] Main service - jobs disabled (worker-only architecture)');
      console.log('[BOOT] Health server running - service will remain alive');
      
      // Optionally start Express server for admin endpoints (non-blocking)
      try {
        const express = require('express');
        const app = express();
        const PORT = Number(process.env.PORT ?? 3000);
        const HOST = '0.0.0.0';
        
        app.use(express.json());
        
        // Admin endpoints (if needed)
        app.get('/admin/status', (req, res) => {
          res.json({
            ok: true,
            service: 'main',
            jobs_enabled: false,
            git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
          });
        });
        
        // Note: We already have health server on same port, so Express will fail
        // But that's OK - health server is what Railway checks
        console.log('[BOOT] Express server not started (health server already on PORT)');
      } catch (expressError: any) {
        // Ignore - health server is what matters
        console.log('[BOOT] Express server skipped (health server handles healthchecks)');
      }
    }
  } catch (error: any) {
    console.error('[BOOT] ❌ Background init error:', error.message);
    console.error('[BOOT] Stack:', error.stack);
    // Don't exit - health server keeps process alive
  }
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[PROCESS] SIGTERM received, shutting down gracefully...');
  if (healthServer) {
    healthServer.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('[PROCESS] SIGINT received, shutting down gracefully...');
  if (healthServer) {
    healthServer.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Handle uncaught errors (don't crash - health server must stay up)
process.on('uncaughtException', (error) => {
  console.error('[PROCESS] uncaughtException:', error.message);
  console.error('[PROCESS] Stack:', error.stack);
  // Don't exit - keep health server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[PROCESS] unhandledRejection:', reason);
  // Don't exit - keep health server running
});

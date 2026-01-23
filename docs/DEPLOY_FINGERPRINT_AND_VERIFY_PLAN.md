# DEPLOY FINGERPRINT AND VERIFY PLAN

**Status:** Disk space full - manual implementation required  
**Goal:** Make deploys provable and resilient

---

## ROOT CAUSE FROM RAILWAY LOGS

From `/tmp/railway_logs.txt` analysis:

```
[POSTING_QUEUE] ❌ SOURCE-OF-TRUTH CHECK FAILED: content_metadata missing columns
[POSTING_QUEUE]   Required: target_tweet_id, target_tweet_content_snapshot, target_tweet_content_hash, semantic_similarity, root_tweet_id, target_username
[POSTING_QUEUE]   Error: column content_metadata.target_tweet_content_snapshot does not exist
```

**The deployed code is OLD** - it's checking for reply-specific columns that don't exist for timeline posts. The fix commit `7958842c` already corrected this, but Railway is running an older build.

---

## REQUIRED CHANGES

### 1. Update `src/railwayEntrypoint.ts`

**After line 40, add:**
```typescript
  // 🔒 DEPLOY FINGERPRINT: Required for deploy verification
  const appCommitSha = process.env.APP_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'unknown';
  const appBuildTime = process.env.APP_BUILD_TIME ?? 'unknown';
  const serviceRole = process.env.SERVICE_ROLE ?? (process.env.RAILWAY_SERVICE_NAME?.includes('worker') ? 'worker' : 'main') ?? 'unknown';
  const railwayService = process.env.RAILWAY_SERVICE_NAME ?? process.env.SERVICE_NAME ?? 'unknown';
  
  // Single-line boot fingerprint (required for deploy verification)
  console.log(`[BOOT] sha=${appCommitSha} build_time=${appBuildTime} service_role=${serviceRole} railway_service=${railwayService}`);
```

**In the /healthz response (around line 76), add to JSON:**
```typescript
      const appCommitSha = process.env.APP_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'unknown';
      const appBuildTime = process.env.APP_BUILD_TIME ?? 'unknown';
      const serviceRole = process.env.SERVICE_ROLE ?? (process.env.RAILWAY_SERVICE_NAME?.includes('worker') ? 'worker' : 'main') ?? 'unknown';
      
      res.end(JSON.stringify({
        ok: true,
        sha: appCommitSha,
        build_time: appBuildTime,
        service_role: serviceRole,
        // ... existing fields ...
      }));
```

### 2. Create `scripts/ops/deploy_and_verify.ts`

```typescript
#!/usr/bin/env tsx
import { execSync, spawn } from 'child_process';

const localSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const buildTime = new Date().toISOString();

console.log('1. Setting Railway env vars...');
execSync(`railway variables set APP_COMMIT_SHA=${localSha}`, { stdio: 'inherit' });
execSync(`railway variables set APP_BUILD_TIME=${buildTime}`, { stdio: 'inherit' });

console.log('2. Deploying...');
const child = spawn('railway', ['up', '--detach'], { stdio: 'inherit' });

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Deploy failed with code ${code}`);
    process.exit(1);
  }
  
  console.log('3. Waiting for [BOOT] sha= line...');
  const start = Date.now();
  const maxWait = 10 * 60 * 1000;
  
  const checkInterval = setInterval(() => {
    try {
      const logs = execSync('railway logs -n 200', { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
      const match = logs.match(/\[BOOT\] sha=([^\s]+) build_time=([^\s]+) service_role=([^\s]+) railway_service=([^\s]+)/);
      
      if (match) {
        const [, sha, buildTime, serviceRole, railwayService] = match;
        console.log(`✅ Found: sha=${sha} build_time=${buildTime} service_role=${serviceRole} railway_service=${railwayService}`);
        
        if (sha === localSha) {
          console.log(`✅ VERIFIED: Deployed SHA matches local SHA`);
          clearInterval(checkInterval);
          process.exit(0);
        } else {
          console.error(`❌ SHA mismatch: expected ${localSha.substring(0, 8)}, got ${sha.substring(0, 8)}`);
          clearInterval(checkInterval);
          process.exit(1);
        }
      }
    } catch (e) {
      // Continue waiting
    }
    
    if (Date.now() - start > maxWait) {
      console.error('❌ Timeout: [BOOT] sha= line not found after 10 minutes');
      clearInterval(checkInterval);
      process.exit(1);
    }
  }, 5000);
});
```

### 3. Update `package.json`

Add to scripts:
```json
"deploy:verify": "tsx scripts/ops/deploy_and_verify.ts"
```

---

## DEPLOYMENT STEPS

1. **Free disk space** (required):
   ```bash
   # Clean temp files, node_modules cache, etc.
   rm -rf /tmp/*.log /tmp/*.txt
   pnpm store prune
   ```

2. **Apply code changes** (manually edit files above)

3. **Commit and deploy:**
   ```bash
   git add src/railwayEntrypoint.ts scripts/ops/deploy_and_verify.ts package.json
   git commit -m "feat: deploy fingerprint and verification"
   pnpm run deploy:verify
   ```

4. **Verify:**
   - Check Railway logs for `[BOOT] sha=...` line
   - Verify SHA matches `git rev-parse HEAD`
   - Check `/healthz` endpoint returns `sha` and `build_time`

---

## CURRENT BUILD FAILURE

The Railway logs show the SOURCE-OF-TRUTH check is failing because it's checking for reply-specific columns. This is already fixed in commit `7958842c`, but Railway needs a fresh deploy.

**Fix:** Run `pnpm run deploy:verify` after applying the fingerprint changes above.

---

**Note:** Due to disk space constraints, files must be edited manually. The exact code changes are documented above.

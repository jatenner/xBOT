# Quick Check Script Fix - Dec 30, 2025

## Problem
`scripts/quick-check.ts` would hang indefinitely when run via `railway run`, never terminating.

## Root Causes
1. **Supabase client keeps connection pools open** - No automatic cleanup
2. **No timeout mechanism** - Can hang on slow queries forever
3. **No explicit process.exit()** - Node waits for all handles to close
4. **No error handling** - Failures would cause hanging state
5. **No cleanup logic** - Resources never released

## Solution Implemented

### 1. Hard 30-Second Timeout Guard
```typescript
const TIMEOUT_MS = 30000;
const timeoutGuard = setTimeout(() => {
  console.error('❌ TIMEOUT: quick-check exceeded 30 seconds');
  process.exit(1);
}, TIMEOUT_MS);
```

### 2. Per-Query Timeouts (10 seconds each)
```typescript
await Promise.race([
  supabase.from('content_metadata').select(...),
  new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Query timeout')), 10000)
  )
]);
```

### 3. Clear Logging Checkpoints
- `START quick-check` - Script begins
- `CHECK 1: Recent posts` - PASS/FAIL
- `CHECK 2: Queue status` - PASS/FAIL
- `CHECK 3: Rate limit compliance` - PASS/FAIL
- `DONE quick-check (exit=0|1)` - Final status

### 4. Proper Exit Codes
- Exit 0: All checks passed
- Exit 1: Any check failed or error occurred

### 5. Explicit Cleanup
```typescript
finally {
  clearTimeout(timeoutGuard);
  console.log(`DONE quick-check (exit=${exitCode})`);
  process.exit(exitCode); // Force exit
}
```

### 6. Error Handling
- Try/catch around each check
- Failures don't crash script, just set exit code to 1
- Uncaught errors handled at top level

## Changes Summary

### Before
```typescript
async function quickCheck() {
  // No timeout
  const { data: posts } = await supabase.from(...); // Can hang
  console.log(...); // Minimal logging
  // No cleanup
}
quickCheck(); // No exit handling
```

### After
```typescript
// Global 30s timeout guard
const timeoutGuard = setTimeout(() => process.exit(1), 30000);

async function quickCheck(): Promise<number> {
  console.log('START quick-check');
  let exitCode = 0;
  
  try {
    // CHECK 1 with timeout
    const result = await Promise.race([
      supabase.from(...),
      timeoutPromise(10000)
    ]);
    console.log('CHECK 1: PASS/FAIL');
    
    // CHECK 2 with timeout
    // CHECK 3 with timeout
  } catch (error) {
    exitCode = 1;
  }
  
  return exitCode;
}

async function main() {
  try {
    const exitCode = await quickCheck();
  } finally {
    clearTimeout(timeoutGuard);
    process.exit(exitCode); // Force exit
  }
}

main().catch(() => process.exit(1));
```

## Testing

Run the script:
```bash
railway run --service xBOT pnpm tsx scripts/quick-check.ts
```

Expected output:
```
START quick-check
────────────────────────────────────────────────────────────

CHECK 1: Recent posts in database
CHECK 1: PASS - Found 5 recent posts
  1. 2005838304093020371 | single | 12m ago
  ...

CHECK 2: Queue status
CHECK 2: PASS - 3 items in queue
  1. thread in 5 min
  ...

CHECK 3: Rate limit compliance (last hour)
CHECK 3: PASS - 1/2 posts in last hour

────────────────────────────────────────────────────────────
✅ ALL CHECKS PASSED
DONE quick-check (exit=0)
```

Script will **always** terminate within 30 seconds with proper exit code.

## Benefits
1. ✅ Never hangs - Hard 30s timeout
2. ✅ Clear diagnostics - Checkpoint logging
3. ✅ Proper exit codes - 0 for pass, 1 for fail
4. ✅ Fast failure - Individual query timeouts
5. ✅ Resource cleanup - Explicit process.exit()
6. ✅ Error resilient - Handles all error cases


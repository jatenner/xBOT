# 🧠 MEMORY OPTIMIZATION INTEGRATION PLAN

## ✅ FIXED: Syntax Error
- **File:** `src/utils/memoryOptimization.ts`
- **Issue:** Line 1 had `does the /**` instead of `/**`
- **Status:** ✅ FIXED

---

## 🎯 INTEGRATION STRATEGY

### Phase 1: Core Integration (Immediate)

#### 1. **Memory Safety Checks in Heavy Jobs**

**Files to Update:**
- `src/jobs/metricsScraperJob.ts` - Scrapes multiple tweets, loads data
- `src/jobs/learnJob.ts` - Loads training data, processes outcomes
- `src/jobs/replyOpportunityHarvester.ts` - Processes large opportunity lists
- `src/jobs/planJob.ts` - Already partially integrated ✅

**Pattern:**
```typescript
import { isMemorySafeForOperation, clearArrays } from '../utils/memoryOptimization';

// At start of job:
const memoryCheck = await isMemorySafeForOperation(100, 400);
if (!memoryCheck.safe) {
  console.warn(`[JOB_NAME] ⚠️ Low memory (${memoryCheck.currentMB}MB), skipping this run`);
  return;
}

// After processing large arrays:
clearArrays(largeArray1, largeArray2, largeArray3);
```

#### 2. **Pagination for Large Queries**

**Files to Update:**
- `src/jobs/learnJob.ts` - Uses `limit(50)`, should use pagination
- `src/jobs/metricsScraperJob.ts` - Loads multiple post batches
- `src/jobs/replyOpportunityHarvester.ts` - Processes opportunities

**Pattern:**
```typescript
import { paginatedQuery } from '../utils/memoryOptimization';

// BEFORE:
const { data } = await supabase
  .from('outcomes')
  .select('*')
  .limit(50);

// AFTER:
const data = await paginatedQuery('outcomes', {
  select: '*',
  batchSize: 20,
  maxBatches: 3 // 60 items max
});
```

#### 3. **Batch Processing for Large Operations**

**Files to Update:**
- `src/jobs/metricsScraperJob.ts` - Scrapes multiple tweets
- `src/jobs/replyJob.ts` - Processes multiple opportunities

**Pattern:**
```typescript
import { processInBatches, memoryAwareBatchProcessor } from '../utils/memoryOptimization';

// For database queries:
for await (const batch of processInBatches(
  async (offset, limit) => {
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .range(offset, offset + limit - 1);
    return { data, error };
  },
  20 // batch size
)) {
  // Process batch
  await processBatch(batch);
  // Batch automatically cleared from memory
}

// For arrays:
for await (const batch of memoryAwareBatchProcessor(largeArray, 20)) {
  await processBatch(batch);
  // Memory-aware: checks memory before each batch
}
```

---

### Phase 2: Advanced Integration (Next)

#### 4. **LRU Cache for Frequently Accessed Data**

**Use Cases:**
- Generator weights (update every 6h, cache for 1h)
- Top performing tweets (update daily, cache for 6h)
- Account pool data (update weekly, cache for 24h)

**Pattern:**
```typescript
import { LRUCache } from '../utils/memoryOptimization';

const generatorWeightsCache = new LRUCache<string, any>(10); // Max 10 entries

// Check cache first
const cached = generatorWeightsCache.get('weights');
if (cached) {
  return cached;
}

// Load from database
const weights = await loadGeneratorWeights();

// Cache it
generatorWeightsCache.set('weights', weights);
```

#### 5. **Memory Monitoring Integration**

**Enhancement:** Add memory monitoring to job manager

```typescript
// In jobManager.ts, before each job:
const { MemoryMonitor } = await import('../utils/memoryMonitor');
const { isMemorySafeForOperation } = await import('../utils/memoryOptimization');

const memory = MemoryMonitor.checkMemory();
if (memory.status === 'critical') {
  console.warn(`[JOB_MANAGER] 🚨 Critical memory (${memory.rssMB}MB), skipping ${jobName}`);
  await MemoryMonitor.emergencyCleanup();
  return;
}

const safeCheck = await isMemorySafeForOperation(100, 400);
if (!safeCheck.safe) {
  console.warn(`[JOB_MANAGER] ⚠️ Low memory (${safeCheck.currentMB}MB), deferring ${jobName}`);
  // Reschedule job for later
  return;
}
```

---

## 🔗 SYSTEM CONNECTIONS

### MemoryMonitor ↔ memoryOptimization

**Current State:**
- `memoryOptimization.ts` imports `MemoryMonitor` ✅
- `memoryOptimization.isMemorySafeForOperation()` uses `MemoryMonitor.checkMemory()` ✅

**Enhancement:**
- Add bidirectional integration
- `MemoryMonitor.emergencyCleanup()` should use `memoryOptimization.clearArrays()`
- `memoryOptimization` should trigger `MemoryMonitor.emergencyCleanup()` if memory critical

### Jobs ↔ memoryOptimization

**Current State:**
- `planJob.ts` uses `clearArrays()` ✅
- `replyJob.ts` uses `paginatedQuery()` and `clearArrays()` ✅

**Needs Integration:**
- `metricsScraperJob.ts` - Add memory checks and pagination
- `learnJob.ts` - Add pagination for training data
- `replyOpportunityHarvester.ts` - Add batch processing

### Browser Pool ↔ memoryOptimization

**Current State:**
- `UnifiedBrowserPool` has memory monitoring ✅
- `MemoryMonitor` cleans browser pool ✅

**Enhancement:**
- Use `isMemorySafeForOperation()` before acquiring browser contexts
- Clear browser-related arrays using `clearArrays()`

---

## 📋 IMPLEMENTATION CHECKLIST

### Immediate (Today)
- [x] Fix syntax error in `memoryOptimization.ts`
- [ ] Add memory checks to `metricsScraperJob.ts`
- [ ] Add pagination to `learnJob.ts`
- [ ] Add batch processing to `replyOpportunityHarvester.ts`
- [ ] Add memory checks to `jobManager.ts` (before each job)

### Short-term (This Week)
- [ ] Integrate LRU cache for generator weights
- [ ] Add memory-aware batch processing to all heavy jobs
- [ ] Enhance `MemoryMonitor` ↔ `memoryOptimization` integration
- [ ] Add memory monitoring dashboard endpoint

### Long-term (Next Week)
- [ ] Create memory optimization middleware for all jobs
- [ ] Add automatic memory cleanup triggers
- [ ] Implement memory budgeting per component
- [ ] Add memory metrics to performance dashboard

---

## 🎯 EXPECTED IMPROVEMENTS

### Memory Usage
- **Current:** ~300MB idle, spikes to 450MB+
- **Target:** ~200MB idle, spikes to 400MB max
- **Method:** Pagination, batch processing, aggressive cleanup

### Performance
- **Current:** Some jobs load 50-100 items at once
- **Target:** All jobs use pagination (20 items/batch)
- **Method:** `paginatedQuery()`, `processInBatches()`

### Reliability
- **Current:** Jobs can fail if memory is tight
- **Target:** Jobs check memory before starting, skip if unsafe
- **Method:** `isMemorySafeForOperation()` checks

---

## 🔍 MONITORING

### Metrics to Track
1. **Memory Usage:**
   - Average RSS memory per job
   - Peak memory per job
   - Memory freed by cleanup operations

2. **Job Performance:**
   - Jobs skipped due to low memory
   - Batch processing efficiency
   - Pagination effectiveness

3. **System Health:**
   - Memory warnings triggered
   - Emergency cleanups executed
   - Browser pool memory usage

### Logging
All memory operations should log:
```typescript
console.log(`[MEMORY_OPT] Operation: ${operation}, Memory: ${currentMB}MB, Safe: ${safe}`);
```

---

## 🚀 ROLLOUT PLAN

### Step 1: Fix & Test (Today)
1. ✅ Fix syntax error
2. Test `memoryOptimization.ts` functions
3. Verify `MemoryMonitor` integration

### Step 2: Integrate Core Jobs (Today-Tomorrow)
1. Add memory checks to `metricsScraperJob.ts`
2. Add pagination to `learnJob.ts`
3. Add batch processing to `replyOpportunityHarvester.ts`
4. Test each integration

### Step 3: Enhance Integration (This Week)
1. Add memory checks to `jobManager.ts`
2. Integrate LRU cache
3. Enhance `MemoryMonitor` ↔ `memoryOptimization` connection
4. Monitor and optimize

### Step 4: Full Rollout (Next Week)
1. Integrate remaining jobs
2. Add memory monitoring dashboard
3. Create memory optimization middleware
4. Document best practices

---

## ✅ SUCCESS CRITERIA

1. **Memory Usage:** Average idle memory < 250MB
2. **Reliability:** Zero OOM crashes
3. **Performance:** All heavy jobs use pagination
4. **Monitoring:** Memory metrics visible in dashboard
5. **Integration:** All jobs check memory before starting

---

**Status:** Phase 1 in progress  
**Next Steps:** Integrate memory checks into core jobs  
**Timeline:** Complete Phase 1 today, Phase 2 this week


# 🔄 BROWSER MIGRATION PLAN - UnifiedBrowserPool

**Status:** In Progress  
**Target:** Migrate all browser usage to UnifiedBrowserPool ONLY

---

## ✅ **ALREADY MIGRATED:**
1. `src/jobs/analyticsCollectorJobV2.ts` - Uses UnifiedBrowserPool ✅
2. `src/ai/realTwitterDiscovery.ts` - Uses UnifiedBrowserPool ✅

---

## 🔄 **TO MIGRATE:**

### **Priority 1: Critical Jobs (P0-P1)**
1. `src/jobs/velocityTrackerJob.ts` - Uses `../browser/browserManager`
2. `src/jobs/metricsScraperJob.ts` - Check current implementation
3. `src/posting/orchestrator.ts` - Check current implementation

### **Priority 2: Scrapers**
4. `src/metrics/realTwitterMetricsCollector.ts` - Uses `../posting/BrowserManager`
5. `src/analytics/twitterAnalyticsScraper.ts` - Check current implementation
6. `src/intelligence/tweetPerformanceTracker.ts` - Check current implementation
7. `src/metrics/followerScraper.ts` - Check current implementation

### **Priority 3: Posting Systems**
8. `src/posting/nativeThreadComposer.ts` - Check current implementation
9. `src/posting/enhancedThreadComposer.ts` - Check current implementation
10. `src/engagement/strategicEngagementEngine.ts` - Check current implementation

---

## 📋 **MIGRATION PATTERN:**

### **BEFORE (Old Browser Manager):**
```typescript
import { BrowserManager } from '../browser/browserManager';
const browserManager = BrowserManager.getInstance();
const page = await browserManager.getPage();
// ... use page ...
```

### **AFTER (UnifiedBrowserPool):**
```typescript
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
const pool = UnifiedBrowserPool.getInstance();
const page = await pool.acquirePage('operation_name');
try {
  // ... use page ...
} finally {
  await page.close(); // UnifiedBrowserPool handles context cleanup
}
```

---

## 🎯 **IMPLEMENTATION ORDER:**
1. Migrate Priority 1 (Critical Jobs)
2. Migrate Priority 2 (Scrapers)
3. Migrate Priority 3 (Posting Systems)
4. Mark old implementations as deprecated
5. Remove old implementations after validation




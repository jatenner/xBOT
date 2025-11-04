# 📋 POSTING QUEUE REFACTOR PLAN

**Current Size:** 1,372 lines (too large)  
**Target:** <500 lines per module  
**Status:** Planned (to be implemented in dedicated refactor session)

---

## 🎯 PROPOSED MODULE STRUCTURE

```
src/jobs/postingQueue/
├── index.ts (100 lines) - Main orchestrator
├── rateLimiter.ts (150 lines) - Rate limit checking
├── queueFetcher.ts (200 lines) - Fetch ready decisions
├── duplicateChecker.ts (150 lines) - Prevent duplicates
├── decisionProcessor.ts (300 lines) - Process & post decisions
├── statusUpdater.ts (150 lines) - Update database status
└── types.ts (50 lines) - Shared interfaces
```

---

## 📝 REFACTOR STEPS

### **Step 1: Extract Types**
Move all interfaces to types.ts

### **Step 2: Extract Rate Limiting**
Move checkPostingRateLimits() → rateLimiter.ts

### **Step 3: Extract Queue Fetching**
Move getReadyDecisions() → queueFetcher.ts

### **Step 4: Extract Duplicate Checking**
Move duplicate prevention logic → duplicateChecker.ts

### **Step 5: Extract Processing**
Move processDecision() → decisionProcessor.ts

### **Step 6: Extract Status Updates**
Move updateDecisionStatus() → statusUpdater.ts

### **Step 7: Main Orchestrator**
Keep processPostingQueue() as thin orchestrator

---

**Note:** This is a significant refactor requiring careful testing.  
**Recommendation:** Implement in separate focused session with full test suite.

Current system is functional - refactor is optimization, not critical bug fix.


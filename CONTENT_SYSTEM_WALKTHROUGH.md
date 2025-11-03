# 🎯 COMPLETE CONTENT SYSTEM WALKTHROUGH

## Overview: The Content Pipeline

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: JOB SCHEDULER (Every 30 min)                   │
│  ↓                                                       │
│  STEP 2: CONTENT PLANNING (Generate ideas)              │
│  ↓                                                       │
│  STEP 3: CONTENT GENERATION (Create tweets)             │
│  ↓                                                       │
│  STEP 4: VISUAL FORMATTING (Polish for Twitter)         │
│  ↓                                                       │
│  STEP 5: DUPLICATE CHECK (Ensure unique)                │
│  ↓                                                       │
│  STEP 6: QUEUE & SCHEDULE (Time to post)                │
│  ↓                                                       │
│  STEP 7: POSTING (Post to Twitter)                      │
│  ↓                                                       │
│  STEP 8: LEARNING (Track performance)                   │
└─────────────────────────────────────────────────────────┘
```

---

## STEP 1: JOB SCHEDULER - How It All Starts

### File: `src/jobs/jobManager.ts`

### What Happens:
```
Every 30 minutes:
  ↓
JobManager triggers → planJobUnified.ts
  ↓
Generates 1 post per cycle
  ↓
Result: 2 posts/hour (1 post × 2 cycles)
```

### Code:
```typescript
// Line ~140 in jobManager.ts
this.scheduleStaggeredJob(
  'unified_plan',
  async () => {
    const { planContentUnified } = await import('./planJobUnified');
    await planContentUnified(); // ← Generates 1 post
  },
  30 * MINUTE,  // Every 30 minutes
  0 * MINUTE    // No offset
);
```

### Key Settings:
- ✅ Runs every 30 minutes
- ✅ Generates 1 post per run
- ✅ Total: 2 posts/hour, 48 posts/day

### Issues Here:
- ❓ None at this level - scheduling is fine

---

**READY FOR STEP 2?** (Content Planning - where topic/generator selection happens)

Let me know when you want to continue!


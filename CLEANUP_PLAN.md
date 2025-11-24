# 🧹 POSTING SYSTEMS CLEANUP PLAN

## ✅ SYSTEMS TO KEEP (3)

1. **UltimateTwitterPoster.ts** - Used in postingQueue.ts (2 places)
2. **BulletproofThreadComposer.ts** - Used in postingQueue.ts
3. **XApiPoster.ts** - Used in postingQueue.ts (optional feature flag)

## ❌ SYSTEMS TO DELETE (32+)

### Posters to Delete:
- bulletproofPoster.ts
- poster.ts (different from bulletproofPoster)
- simplifiedBulletproofPoster.ts
- lightweightPoster.ts
- fastTwitterPoster.ts
- emergencyWorkingPoster.ts
- playwrightOnlyPoster.ts
- headlessXPoster.ts
- stealthTwitterPoster.ts
- railwayCompatiblePoster.ts
- bulletproofHttpPoster.ts
- remoteBrowserPoster.ts
- playwrightPoster.ts
- postThread.ts (TwitterPoster)
- autonomousTwitterPoster.ts (in agents/)

### Composers to Delete:
- bulletproofTwitterComposer.ts
- BulletproofThreadComposer_FIXED.ts
- threadComposer.ts
- enhancedThreadComposer.ts
- nativeThreadComposer.ts
- TwitterComposer.ts
- bulletproofComposer.ts
- threadComposer.ts (in content/)

### Thread Posters to Delete:
- simpleThreadPoster.ts (in posting/)
- simpleThreadPoster.ts (in jobs/)
- fixedThreadPoster.ts

### Reply Posters to Delete:
- resilientReplyPoster.ts

### Facades/Orchestrators to Delete:
- PostingFacade.ts (if not used)
- router.ts (PostingRouter)
- orchestrator.ts

### Other to Delete:
- ultimatePostingFix.ts (duplicate?)
- postNow.ts (if not used)
- emergencyPost.ts (if not used)

## ⚠️ FILES TO CHECK FIRST

Before deleting, verify these aren't used:
- PostingFacade.ts
- postNow.ts
- emergencyPost.ts


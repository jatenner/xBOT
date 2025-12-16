# Phase 5 – Content & Voice Brain Strategy

**Date:** 2025-01-16  
**Status:** Strategy Design + Step 0 Implementation Complete  
**Context:** Post-data-plumbing-fix, Phase 4 routing enabled, experiments disabled

---

## Implementation Status – Voice Ontology & VoiceGuide

**Date:** 2025-01-16  
**Status:** ✅ Phase 5 Step 0 Complete

### Files Created

1. **`src/config/voiceOntology.ts`**
   - Type-safe enums/union types for `ContentSlotType`, `HookType`, `ToneType`, `StructureType`
   - `VOICE_ONTOLOGY` object defining allowed hooks, tones, and preferred structures per slot
   - Based on Phase 5 strategy recommendations
   - Helper functions: `getAllowedHooks()`, `getAllowedTones()`, `getPreferredStructures()`

2. **`src/ai/voiceGuide.ts`**
   - `VoiceDecision` interface
   - `chooseVoiceForContent()` function with conservative logic
   - Fallback handling for missing/invalid slots
   - Comprehensive logging: `[VOICE_GUIDE]` prefix

### Integration Points

1. **`src/jobs/planJob.ts`**
   - Voice guide called before building insert payload (around line 1065)
   - Sets `hook_type` and `structure_type` in `content_metadata` insert
   - Logs voice decisions for tracking
   - Graceful error handling (continues with defaults if voice guide fails)

2. **`src/jobs/replyJob.ts`**
   - Voice guide called before inserting reply (around line 1199)
   - Sets `hook_type='none'` and `structure_type='reply'` for replies
   - Uses `slot='reply'` and `decisionType='reply'` for all replies
   - Graceful error handling

### Current Behavior

- **Conservative approach**: Voice guide tags metadata but doesn't drastically change content generation
- **Metadata tracking**: `hook_type` and `structure_type` stored in `content_metadata` for v2 learning
- **Logging**: All voice decisions logged with `[VOICE_GUIDE]` prefix for analysis
- **Backward compatible**: System continues working even if voice guide has errors

### Next Steps

- **Phase 5A**: Use performance data to adjust hook/tone/structure probabilities
- **Phase 5B**: Integrate voice guide into prompt construction (minimal changes)
- **Phase 5C**: Add voice performance tracking and automated optimization

### Example Log Output

```
[VOICE_GUIDE] slot=framework generator=coach decisionType=single hook=framework tone=educational structure=single
[VOICE_GUIDE] slot=reply generator=data_nerd decisionType=reply hook=none tone=practical structure=reply
```

---

## Implementation Status – Generator Policy

**Date:** 2025-01-16  
**Status:** ✅ Phase 5A.1 Complete

### Files Created

1. **`src/learning/generatorPolicy.ts`**
   - `GENERATOR_POLICY_BASE_WEIGHTS` config with Tier 1/2/3 allocations
   - `computeGeneratorWeightsFromPolicyAndLearning()` function to blend policy + learning
   - Weight adjustment logic with safety clamps (0.25x–2x of base weight)
   - Normalization to ensure weights sum to 1.0

2. **`src/learning/generatorPerformanceFetcher.ts`**
   - `fetchGeneratorPerformanceSummary()` read-only function
   - Queries `vw_learning` for generator performance metrics
   - Aggregates `avg(primary_objective_score)`, `avg(followers_gained_weighted)`, `count(*)`
   - Graceful error handling (returns empty array on failure)

### Integration Points

1. **`src/intelligence/generatorMatcher.ts`**
   - Feature flag: `ENABLE_PHASE5_GENERATOR_POLICY` (default: `false`)
   - Lazy initialization of policy weights on first use
   - Priority order: weight map (priority 1) → policy weights (priority 2) → random (fallback)
   - Weighted random selection when policy is enabled
   - Comprehensive logging: `[GEN_POLICY]` prefix

### Current Behavior

- **Feature-flagged**: Policy only active when `ENABLE_PHASE5_GENERATOR_POLICY=true`
- **Backward compatible**: When flag is OFF, behavior is identical to before
- **Safe fallbacks**: If policy initialization fails, falls back to original behavior
- **Weighted selection**: Uses policy+learning weights with 80% exploit / 20% explore

### Base Weights (Tier 1/2/3)

- **Tier 1 (60%)**: `thoughtLeader` (20%), `coach` (20%), `philosopher` (10%), `dataNerd` (10%)
- **Tier 2 (30%)**: `provocateur` (8%), `mythBuster` (7%), `culturalBridge` (5%), `newsReporter` (5%), `contrarian` (5%)
- **Tier 3 (10%)**: `storyteller` (3%), `explorer` (2%), `dynamicContent` (2%), `interestingContent` (1%)

### Next Steps

- **Phase 5A.2**: Per-slot generator policy (different weights per content slot)
- **Phase 5A.3**: Dynamic weight updates (refresh weights periodically)
- **Phase 5B**: Slot policy implementation

### Example Log Output

```
[GEN_POLICY] 🎯 Initializing generator policy...
[GEN_PERF_FETCHER] ✅ Fetched 12 generator summaries (150 rows aggregated)
[GEN_POLICY] Adjusted thoughtLeader: base=0.200 → adjusted=0.215 (score=0.550, n=45)
[GEN_POLICY] Adjusted coach: base=0.200 → adjusted=0.185 (score=0.450, n=38)
[GEN_POLICY] ✅ Initialized generator weights: {"thoughtLeader":0.215,"coach":0.185,...}
[GEN_POLICY] Selected generator=thoughtLeader weight=21.5% (policy+learning)
```

---

## Implementation Status – Slot Policy

**Date:** 2025-01-16  
**Status:** ✅ Phase 5A.2 Complete

### Files Created

1. **`src/learning/contentSlotPolicy.ts`**
   - `SLOT_POLICY_BASE_WEIGHTS` config with High/Medium/Low-value allocations
   - `computeSlotWeightsFromPolicyAndLearning()` function to blend policy + learning
   - Weight adjustment logic with safety clamps (0.25x–2x of base weight)
   - Normalization to ensure weights sum to 1.0

2. **`src/learning/contentSlotPerformanceFetcher.ts`**
   - `fetchSlotPerformanceSummary()` read-only function
   - Queries `vw_learning` for slot performance metrics
   - Aggregates `avg(primary_objective_score)`, `avg(followers_gained_weighted)`, `count(*)`
   - Graceful error handling (returns empty array on failure)

### Integration Points

1. **`src/utils/contentSlotManager.ts`**
   - Feature flag: `ENABLE_PHASE5_SLOT_POLICY` (default: `false`)
   - Lazy initialization of slot weights on first use
   - Modified `selectContentSlot()` to be async and use policy weights when enabled
   - Weighted random selection within available slots (respects calendar constraints)
   - Comprehensive logging: `[SLOT_POLICY]` prefix

2. **`src/jobs/planJob.ts`**
   - Updated to `await selectContentSlot()` (now async)
   - Policy weights applied within calendar constraints (available slots for today)

### Current Behavior

- **Feature-flagged**: Policy only active when `ENABLE_PHASE5_SLOT_POLICY=true`
- **Backward compatible**: When flag is OFF, behavior is identical to before
- **Respects calendar**: Policy weights applied within `getContentSlotsForToday()` constraints
- **Safe fallbacks**: If policy initialization fails, falls back to original behavior
- **Weighted selection**: Uses policy+learning weights for slot selection

### Base Weights (High/Medium/Low-value)

- **High-value (40%)**: `framework` (15%), `practical_tip` (15%), `research` (10%)
- **Medium-value (40%)**: `myth_busting` (12%), `deep_dive` (10%), `case_study` (8%), `comparison` (5%), `educational` (5%)
- **Low-value (20%)**: `question` (8%), `trend_analysis` (6%), `story` (4%), `news` (2%)

### Next Steps

- **Phase 5A.3**: Dynamic weight updates (refresh weights periodically)
- **Phase 5B**: Voice guide integration into prompt construction
- **Phase 5C**: Voice performance tracking and automated optimization

### Example Log Output

```
[SLOT_POLICY] 🎯 Initializing slot policy...
[SLOT_PERF_FETCHER] ✅ Fetched 8 slot summaries (150 rows aggregated)
[SLOT_POLICY] Adjusted framework: base=0.150 → adjusted=0.165 (score=0.550, n=25)
[SLOT_POLICY] Adjusted practical_tip: base=0.150 → adjusted=0.135 (score=0.450, n=30)
[SLOT_POLICY] ✅ Initialized slot weights: {"framework":0.165,"practical_tip":0.135,...}
[SLOT_POLICY] Selected slot=framework weight=16.5% (policy+learning)
```

---

*Phase 5 Step 0 (Voice Ontology & VoiceGuide), Phase 5A.1 (Generator Policy), and Phase 5A.2 (Slot Policy) implemented and integrated. Ready for Phase 5A.3 (dynamic weight updates).*


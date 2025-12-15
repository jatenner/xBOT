# Phase 4 AI Strategy Specification

**Date:** 2025-12-15  
**Status:** Design Phase (Not Yet Implemented)  
**Goal:** Simplify AI layer, add intelligent model routing, integrate v2 learning signals, add lightweight experimentation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Simplified AI Architecture](#simplified-ai-architecture)
3. [AI Routing Configuration](#ai-routing-configuration)
4. [Budget-Aware Routing Design](#budget-aware-routing-design)
5. [V2 Learning Signal Integration](#v2-learning-signal-integration)
6. [Experimentation Layer Design](#experimentation-layer-design)
7. [Implementation Plan](#implementation-plan)

---

## Executive Summary

**Current State:**
- 22 content generators active
- Multiple unused orchestrators creating confusion
- Uniform model selection (all gpt-4o-mini)
- v2 learning signals exist but not used in generation decisions
- No experimentation layer

**Phase 4 Goals:**
1. **Simplify:** Two primary orchestrators (CoreContentOrchestrator, ExpertOrchestrator)
2. **Intelligent Routing:** GPT-4o-mini for 80-90% of content, GPT-4o for high-value cases
3. **Learning-Driven:** Use v2 metrics (followers_gained_weighted, primary_objective_score, priority_score) in decisions
4. **Experimentation:** Lightweight A/B testing for hooks and formats

**Key Principle:** Keep it simple, maintainable, and data-driven.

---

## Simplified AI Architecture

### Two Primary Orchestrators

#### 1. CoreContentOrchestrator

**File:** `src/ai/phase4/CoreContentOrchestrator.ts`

**Purpose:** Handle 80-90% of all content generation using GPT-4o-mini

**Responsibilities:**
- Generate single tweets, threads, and replies
- Route to appropriate generator based on content_slot and learning signals
- Apply quality gates and formatting
- Use GPT-4o-mini for cost efficiency

**Function Signature:**
```typescript
interface CoreContentRequest {
  decision_type: 'single' | 'thread' | 'reply';
  content_slot: ContentSlotType;
  topic?: string;
  angle?: string;
  tone?: string;
  target_username?: string; // For replies
  priority_score?: number; // For replies
  learning_signals?: {
    slot_performance?: number; // Avg primary_objective_score for this slot
    generator_performance?: number; // Avg performance for selected generator
  };
}

interface CoreContentResponse {
  content: string | string[]; // Single string or thread parts
  generator_used: GeneratorType;
  visual_format: string;
  quality_score: number;
  metadata: {
    model_used: 'gpt-4o-mini';
    tokens_used: number;
    cost_usd: number;
  };
}

async function generateCoreContent(
  request: CoreContentRequest
): Promise<CoreContentResponse>
```

**Implementation Notes:**
- Wraps existing generator system (22 generators)
- Uses `GeneratorMatcher` with v2 weight maps
- Applies content slot preferences (soft bias)
- Uses `createBudgetedChatCompletion` with `gpt-4o-mini`
- Applies visual formatting and quality gates

#### 2. ExpertOrchestrator

**File:** `src/ai/phase4/ExpertOrchestrator.ts`

**Purpose:** Handle high-value content using GPT-4o (10-20% of generations)

**When to Use:**
- High-value content slots (configurable, e.g., `deep_dive`, `mega_thread`)
- High-priority replies (priority_score > threshold, e.g., 0.8)
- Post-hoc analysis of "banger" tweets (primary_objective_score > threshold, e.g., 0.7)

**Function Signature:**
```typescript
interface ExpertContentRequest extends CoreContentRequest {
  upgrade_reason: 'high_value_slot' | 'high_priority_reply' | 'banger_analysis';
  context?: {
    original_content?: string; // For banger analysis
    original_metrics?: {
      primary_objective_score: number;
      followers_gained_weighted: number;
    };
  };
}

interface ExpertContentResponse extends CoreContentResponse {
  metadata: {
    model_used: 'gpt-4o';
    tokens_used: number;
    cost_usd: number;
    upgrade_reason: string;
  };
}

async function generateExpertContent(
  request: ExpertContentRequest
): Promise<ExpertContentResponse>
```

**Implementation Notes:**
- Uses GPT-4o via `createBudgetedChatCompletion`
- Can enhance existing content (for banger analysis)
- Applies same quality gates as CoreContentOrchestrator
- Logs upgrade reason for cost analysis

### Orchestrator Selection Logic

**File:** `src/ai/phase4/orchestratorRouter.ts`

```typescript
interface RoutingDecision {
  orchestrator: 'core' | 'expert';
  model: 'gpt-4o-mini' | 'gpt-4o';
  reason: string;
}

async function selectOrchestrator(
  request: CoreContentRequest,
  budgetStatus: BudgetStatus,
  routingConfig: AIRoutingConfig
): Promise<RoutingDecision>
```

**Decision Tree:**
1. **Is this a high-priority reply?** (priority_score > routingConfig.priorityThreshold)
   - Yes → ExpertOrchestrator (GPT-4o)
   - No → Continue
2. **Is this a high-value content slot?** (content_slot in routingConfig.expertSlots)
   - Yes → Check budget → ExpertOrchestrator if budget allows
   - No → Continue
3. **Is budget low?** (remainingUSD < routingConfig.budgetReserveThreshold)
   - Yes → CoreContentOrchestrator (GPT-4o-mini) - Force downgrade
   - No → Continue
4. **Default:** CoreContentOrchestrator (GPT-4o-mini)

---

## AI Routing Configuration

### Configuration File

**File:** `src/config/aiRoutingConfig.ts`

```typescript
export interface SlotRoutingConfig {
  primary_model: 'gpt-4o-mini' | 'gpt-4o';
  fallback_model?: 'gpt-4o-mini' | 'gpt-4o';
  max_tokens: number;
  expected_length: 'short' | 'medium' | 'long';
  experimentation_enabled: boolean;
  priority_boost_rules?: {
    min_priority_score?: number; // Upgrade to GPT-4o if priority_score > this
    min_slot_performance?: number; // Upgrade if slot avg performance > this
  };
}

export interface DecisionTypeRoutingConfig {
  single: SlotRoutingConfig;
  thread: SlotRoutingConfig;
  reply: SlotRoutingConfig;
}

export interface AIRoutingConfig {
  // Per (decision_type, content_slot) routing
  routing: Record<string, Record<ContentSlotType, SlotRoutingConfig>>;
  
  // Global thresholds
  priorityThreshold: number; // priority_score > this → GPT-4o for replies
  budgetReserveThreshold: number; // Reserve $X for expert content
  expertSlots: ContentSlotType[]; // Slots that can use GPT-4o
  
  // Budget rules
  dailyExpertBudget: number; // Max $X/day for GPT-4o
  forceDowngradeThreshold: number; // If remaining < this, force GPT-4o-mini
}

// Default configuration
export const DEFAULT_ROUTING_CONFIG: AIRoutingConfig = {
  routing: {
    single: {
      myth_busting: {
        primary_model: 'gpt-4o-mini',
        max_tokens: 400,
        expected_length: 'medium',
        experimentation_enabled: true
      },
      framework: {
        primary_model: 'gpt-4o-mini',
        max_tokens: 500,
        expected_length: 'medium',
        experimentation_enabled: true
      },
      research: {
        primary_model: 'gpt-4o-mini',
        max_tokens: 450,
        expected_length: 'medium',
        experimentation_enabled: false
      },
      practical_tip: {
        primary_model: 'gpt-4o-mini',
        max_tokens: 350,
        expected_length: 'short',
        experimentation_enabled: true
      },
      deep_dive: {
        primary_model: 'gpt-4o', // HIGH VALUE
        max_tokens: 800,
        expected_length: 'long',
        experimentation_enabled: false,
        priority_boost_rules: {
          min_slot_performance: 0.6 // Upgrade if slot avg > 0.6
        }
      },
      // ... other slots
    },
    thread: {
      deep_dive: {
        primary_model: 'gpt-4o', // HIGH VALUE
        max_tokens: 2000,
        expected_length: 'long',
        experimentation_enabled: false
      },
      framework: {
        primary_model: 'gpt-4o-mini',
        max_tokens: 1500,
        expected_length: 'long',
        experimentation_enabled: true
      },
      // ... other slots
    },
    reply: {
      reply: { // All replies use same slot
        primary_model: 'gpt-4o-mini',
        max_tokens: 300,
        expected_length: 'short',
        experimentation_enabled: false,
        priority_boost_rules: {
          min_priority_score: 0.8 // Upgrade if priority_score > 0.8
        }
      }
    }
  },
  
  priorityThreshold: 0.8,
  budgetReserveThreshold: 1.0, // Reserve $1 for expert content
  expertSlots: ['deep_dive', 'mega_thread'], // Configurable
  
  dailyExpertBudget: 2.0, // Max $2/day for GPT-4o
  forceDowngradeThreshold: 0.5 // If remaining < $0.50, force GPT-4o-mini
};
```

### Example Routing Decisions

| decision_type | content_slot | priority_score | Budget Remaining | Selected Orchestrator | Model | Reason |
|---------------|--------------|----------------|------------------|----------------------|-------|--------|
| single | practical_tip | N/A | $4.50 | CoreContentOrchestrator | gpt-4o-mini | Default routing |
| single | deep_dive | N/A | $3.00 | ExpertOrchestrator | gpt-4o | High-value slot |
| thread | framework | N/A | $2.50 | CoreContentOrchestrator | gpt-4o-mini | Default routing |
| reply | reply | 0.9 | $2.00 | ExpertOrchestrator | gpt-4o | High priority (0.9 > 0.8) |
| reply | reply | 0.6 | $0.30 | CoreContentOrchestrator | gpt-4o-mini | Low budget (< $0.50) |
| single | deep_dive | N/A | $0.40 | CoreContentOrchestrator | gpt-4o-mini | Budget too low (forced downgrade) |

---

## Budget-Aware Routing Design

### AI Budget Controller

**File:** `src/budget/aiBudgetController.ts`

**Purpose:** Single source of truth for AI budget decisions

**Responsibilities:**
1. Track daily spend (reuse existing `OpenAIBudgetedClient` mechanisms)
2. Enforce daily budget limit (e.g., $5-6)
3. Reserve budget for high-priority content
4. Provide routing recommendations

**Interface:**
```typescript
export interface BudgetRecommendation {
  allowed_model: 'gpt-4o-mini' | 'gpt-4o';
  reason: 'budget_ok' | 'budget_low' | 'budget_reserved' | 'budget_exceeded';
  remaining_expert_budget: number;
  daily_spend: number;
  can_upgrade: boolean;
}

export class AIBudgetController {
  async getBudgetRecommendation(
    requested_model: 'gpt-4o-mini' | 'gpt-4o',
    purpose: string
  ): Promise<BudgetRecommendation>
  
  async checkCanUpgrade(
    current_model: 'gpt-4o-mini',
    requested_model: 'gpt-4o',
    routingConfig: AIRoutingConfig
  ): Promise<boolean>
  
  async reserveExpertBudget(amount: number): Promise<boolean>
  
  async getDailySpending(): Promise<{
    total: number;
    by_model: Record<string, number>;
    expert_reserved: number;
    remaining: number;
  }>
}
```

### Budget Rules

1. **Daily Limit:** $5-6 total (configurable)
2. **Expert Reserve:** Reserve $1-2 for high-priority content (configurable)
3. **Force Downgrade:** If remaining < $0.50, force all content to GPT-4o-mini
4. **Upgrade Logic:**
   - High-priority reply (priority_score > 0.8) → Allow GPT-4o if budget available
   - High-value slot (deep_dive, mega_thread) → Allow GPT-4o if budget available
   - Otherwise → Use GPT-4o-mini

### Integration with openaiBudgetedClient

**Current State:**
- `OpenAIBudgetedClient` tracks spending and enforces limits
- Throws `BudgetExceededError` when limit exceeded

**Phase 4 Changes:**
- Add `AIBudgetController` as a wrapper/adapter
- `AIBudgetController` uses `OpenAIBudgetedClient.getBudgetStatus()`
- Routing decisions check `AIBudgetController` before selecting model
- `createBudgetedChatCompletion` remains the execution layer (no changes)

**Flow:**
```
1. orchestratorRouter.selectOrchestrator()
   ↓
2. AIBudgetController.checkCanUpgrade()
   ↓
3. If upgrade allowed → ExpertOrchestrator
   If not → CoreContentOrchestrator
   ↓
4. Orchestrator calls createBudgetedChatCompletion(model)
   ↓
5. OpenAIBudgetedClient enforces budget (existing logic)
```

---

## V2 Learning Signal Integration

### Learning Signals Available

1. **followers_gained_weighted** (from `outcomes` table)
   - Weighted follower gain per tweet
   - Used for: Slot performance, generator performance

2. **primary_objective_score** (from `outcomes` table)
   - Combined engagement + follower metric (0-1 scale)
   - Used for: Slot performance, generator performance, upgrade decisions

3. **priority_score** (from `discovered_accounts` table)
   - Reply target priority (0-1 scale)
   - Used for: Reply model selection

4. **learning_model_weights** (from `learning_model_weights` table)
   - Generator weights, slot weights, decision_type weights
   - Used for: Generator selection (already integrated)

### Integration Points

#### 1. Slot Performance Tracking

**New Function:** `src/learning/slotPerformanceTracker.ts`

```typescript
interface SlotPerformance {
  slot: ContentSlotType;
  avg_primary_objective_score: number;
  avg_followers_gained_weighted: number;
  sample_size: number;
  last_updated: Date;
}

async function getSlotPerformance(slot: ContentSlotType): Promise<SlotPerformance | null>
```

**Usage:**
- Query `vw_learning` filtered by `content_slot`
- Calculate averages of `primary_objective_score` and `followers_gained_weighted`
- Cache results (refresh every 6 hours)
- Use in routing decisions (upgrade to GPT-4o if slot performance > threshold)

#### 2. Generator Performance Tracking

**Existing:** `src/learning/generatorPerformanceTracker.ts`

**Enhancement:**
- Already tracks generator performance
- Add v2 metrics integration:
  - Use `primary_objective_score` instead of just engagement_rate
  - Weight by `followers_gained_weighted`

#### 3. Slot Selection Enhancement

**File:** `src/utils/contentSlotManager.ts`

**Current:** Random selection with diversity enforcement

**Phase 4 Enhancement:**
```typescript
async function selectContentSlotWithLearning(
  availableSlots: ContentSlotType[],
  recentSlots?: ContentSlotType[]
): Promise<ContentSlotType>
```

**Logic:**
1. Get slot performance for each available slot
2. Weight selection by `avg_primary_objective_score` (70% exploit, 30% explore)
3. Still enforce diversity (avoid last 5 slots)
4. Fall back to random if no performance data

#### 4. Generator Selection Enhancement

**File:** `src/intelligence/generatorMatcher.ts`

**Current:** Uses v2 weight maps (already integrated)

**Phase 4 Enhancement:**
- Add content_slot influence:
  - If slot has preferred generators, boost their weights by 20%
  - Still use weight map as primary signal
- Add slot performance influence:
  - If slot performance is high, prefer generators that perform well for that slot

#### 5. Model Upgrade Decisions

**New Function:** `src/ai/phase4/upgradeDecider.ts`

```typescript
interface UpgradeDecision {
  should_upgrade: boolean;
  reason: string;
  confidence: number;
}

async function shouldUpgradeToExpert(
  request: CoreContentRequest,
  slotPerformance: SlotPerformance | null,
  generatorPerformance: number | null,
  routingConfig: AIRoutingConfig
): Promise<UpgradeDecision>
```

**Logic:**
1. Check if slot performance > threshold → Upgrade
2. Check if generator performance > threshold → Upgrade
3. Check if priority_score > threshold (replies) → Upgrade
4. Check budget availability → Final gate

---

## Experimentation Layer Design

### Database Schema

**No new tables required.** Reuse existing columns:

- `content_metadata.experiment_id` (TEXT) - Already exists
- `content_metadata.experiment_arm` (TEXT) - Already exists
- Add: `content_metadata.hook_variant` (TEXT) - New column
- Add: `content_metadata.format_variant` (TEXT) - New column (or reuse experiment_arm)

**Migration:**
```sql
-- Add experiment variant columns
ALTER TABLE content_generation_metadata_comprehensive
ADD COLUMN IF NOT EXISTS hook_variant TEXT,
ADD COLUMN IF NOT EXISTS format_variant TEXT;

-- Add indexes for experiment analysis
CREATE INDEX IF NOT EXISTS idx_cgmc_experiment 
ON content_generation_metadata_comprehensive(experiment_id, experiment_arm)
WHERE experiment_id IS NOT NULL;
```

### Experiment Definition

**File:** `src/experiments/experimentConfig.ts`

```typescript
export interface Experiment {
  id: string;
  name: string;
  enabled: boolean;
  content_slots: ContentSlotType[]; // Which slots to run experiment on
  variants: {
    hook?: string[]; // e.g., ['HOOK_PUNCHY', 'HOOK_STORY', 'HOOK_QUESTION']
    format?: string[]; // e.g., ['single', 'thread']
  };
  allocation: 'equal' | 'weighted'; // How to split traffic
  min_sample_size: number; // Minimum samples per variant
}

export const ACTIVE_EXPERIMENTS: Experiment[] = [
  {
    id: 'hook_variants_2025',
    name: 'Hook Style Experiment',
    enabled: true,
    content_slots: ['practical_tip', 'myth_busting'],
    variants: {
      hook: ['HOOK_PUNCHY', 'HOOK_STORY', 'HOOK_QUESTION']
    },
    allocation: 'equal',
    min_sample_size: 20
  },
  {
    id: 'format_variants_2025',
    name: 'Thread vs Single Experiment',
    enabled: true,
    content_slots: ['framework', 'deep_dive'],
    variants: {
      format: ['single', 'thread']
    },
    allocation: 'equal',
    min_sample_size: 15
  }
];
```

### Experiment Assignment

**File:** `src/experiments/experimentAssigner.ts`

```typescript
interface ExperimentAssignment {
  experiment_id: string | null;
  hook_variant: string | null;
  format_variant: string | null;
  assignment_reason: string;
}

async function assignExperiments(
  content_slot: ContentSlotType,
  decision_type: 'single' | 'thread'
): Promise<ExperimentAssignment>
```

**Logic:**
1. Check if content_slot has active experiments
2. If yes, randomly assign variant (equal allocation)
3. Track assignment in database
4. Log assignment reason

### Experiment Analysis

**File:** `src/experiments/experimentAnalyzer.ts`

**Query vw_learning for experiment results:**

```sql
SELECT 
  experiment_id,
  hook_variant,
  format_variant,
  COUNT(*) as sample_size,
  AVG(primary_objective_score) as avg_score,
  AVG(followers_gained_weighted) as avg_followers
FROM vw_learning
WHERE experiment_id IS NOT NULL
  AND posted_at > NOW() - INTERVAL '7 days'
GROUP BY experiment_id, hook_variant, format_variant
HAVING COUNT(*) >= 10; -- Minimum sample size
```

**Analysis Function:**
```typescript
interface ExperimentResult {
  experiment_id: string;
  variant: string;
  sample_size: number;
  avg_primary_objective_score: number;
  avg_followers_gained_weighted: number;
  winner?: boolean;
}

async function analyzeExperiment(experiment_id: string): Promise<ExperimentResult[]>
```

### Keeping It Simple

**Principles:**
1. **No complex statistical tests** - Just compare averages
2. **No automatic winner selection** - Human reviews results
3. **No dynamic reallocation** - Fixed allocation during experiment
4. **Clear experiment boundaries** - One experiment per content_slot type
5. **Simple storage** - Use existing columns, add 2 new ones

**What We're NOT Building:**
- Multi-armed bandits for experiments
- Bayesian A/B testing
- Automatic experiment termination
- Complex variant combinations

---

## Implementation Plan

### Step 1: Create AI Routing Configuration

**Files:**
- `src/config/aiRoutingConfig.ts` (new)

**Tasks:**
- Define `AIRoutingConfig` interface
- Create `DEFAULT_ROUTING_CONFIG` with all slot combinations
- Add helper functions: `getRoutingConfig()`, `getSlotConfig()`

**Risk:** Low  
**Dependencies:** None  
**Estimated Time:** 2 hours

---

### Step 2: Implement CoreContentOrchestrator

**Files:**
- `src/ai/phase4/CoreContentOrchestrator.ts` (new)
- `src/ai/phase4/orchestratorRouter.ts` (new)

**Tasks:**
- Create `CoreContentOrchestrator` class
- Wrap existing generator system (call `callDedicatedGenerator`)
- Use GPT-4o-mini via `createBudgetedChatCompletion`
- Apply quality gates and formatting
- Integrate with `orchestratorRouter` for selection

**Risk:** Medium  
**Dependencies:** Step 1 (routing config)  
**Estimated Time:** 4 hours

---

### Step 3: Implement ExpertOrchestrator

**Files:**
- `src/ai/phase4/ExpertOrchestrator.ts` (new)

**Tasks:**
- Create `ExpertOrchestrator` class
- Use GPT-4o via `createBudgetedChatCompletion`
- Support content enhancement (for banger analysis)
- Apply same quality gates as CoreContentOrchestrator
- Log upgrade reasons

**Risk:** Medium  
**Dependencies:** Step 2 (CoreContentOrchestrator pattern)  
**Estimated Time:** 3 hours

---

### Step 4: Implement AI Budget Controller

**Files:**
- `src/budget/aiBudgetController.ts` (new)

**Tasks:**
- Create `AIBudgetController` class
- Wrap `OpenAIBudgetedClient.getBudgetStatus()`
- Implement `checkCanUpgrade()` logic
- Implement `reserveExpertBudget()` logic
- Add daily expert budget tracking

**Risk:** Low  
**Dependencies:** Existing `OpenAIBudgetedClient`  
**Estimated Time:** 3 hours

---

### Step 5: Implement Orchestrator Router

**Files:**
- `src/ai/phase4/orchestratorRouter.ts` (enhance)

**Tasks:**
- Implement `selectOrchestrator()` decision tree
- Integrate `AIBudgetController` checks
- Integrate routing config
- Add comprehensive logging

**Risk:** Medium  
**Dependencies:** Steps 1, 2, 3, 4  
**Estimated Time:** 4 hours

---

### Step 6: Integrate v2 Learning Signals

**Files:**
- `src/learning/slotPerformanceTracker.ts` (new)
- `src/utils/contentSlotManager.ts` (enhance)
- `src/intelligence/generatorMatcher.ts` (enhance)
- `src/ai/phase4/upgradeDecider.ts` (new)

**Tasks:**
- Create `slotPerformanceTracker` to query vw_learning
- Enhance `selectContentSlot` to use performance data
- Enhance `generatorMatcher` to consider slot performance
- Create `upgradeDecider` for model upgrade logic
- Add caching (6-hour TTL)

**Risk:** Medium  
**Dependencies:** vw_learning stable (✅ done), v2 outcomes populated (✅ done)  
**Estimated Time:** 5 hours

---

### Step 7: Add Experiment Metadata Fields

**Files:**
- `supabase/migrations/20250116_add_experiment_variants.sql` (new)
- `src/experiments/experimentConfig.ts` (new)
- `src/experiments/experimentAssigner.ts` (new)

**Tasks:**
- Create migration to add `hook_variant` and `format_variant` columns
- Create experiment configuration system
- Create experiment assigner (runs in planJob)
- Update `planJob.ts` to call experiment assigner

**Risk:** Low  
**Dependencies:** Database migration system  
**Estimated Time:** 3 hours

---

### Step 8: Integrate into planJob

**Files:**
- `src/jobs/planJob.ts` (modify)

**Tasks:**
- Replace direct generator calls with `orchestratorRouter.selectOrchestrator()`
- Pass v2 learning signals to orchestrator
- Call experiment assigner before generation
- Store experiment metadata in content_metadata insert

**Risk:** High (touching core generation flow)  
**Dependencies:** Steps 1-7  
**Estimated Time:** 4 hours

---

### Step 9: Integrate into replyJob

**Files:**
- `src/jobs/replyJob.ts` (modify)

**Tasks:**
- Use `orchestratorRouter` for reply generation
- Pass `priority_score` to routing decision
- Use ExpertOrchestrator for high-priority replies
- Store experiment metadata (if applicable)

**Risk:** Medium  
**Dependencies:** Steps 1-7  
**Estimated Time:** 3 hours

---

### Step 10: Create Experiment Analyzer

**Files:**
- `src/experiments/experimentAnalyzer.ts` (new)
- `scripts/analyze-experiments.ts` (new)

**Tasks:**
- Create analyzer to query vw_learning for experiment results
- Calculate variant performance (avg primary_objective_score)
- Generate simple comparison report
- Add script to run analysis manually

**Risk:** Low  
**Dependencies:** Step 7 (experiment metadata), vw_learning  
**Estimated Time:** 2 hours

---

### Step 11: Deprecate Unused Orchestrators

**Files:**
- Multiple files in `src/ai/` (mark as deprecated)

**Tasks:**
- Add `@deprecated` JSDoc tags to unused orchestrators
- Add migration guide comments
- Create `DEPRECATED_ORCHESTRATORS.md` documenting removal plan
- **DO NOT DELETE** - Keep for reference, remove in future cleanup

**Risk:** Low  
**Dependencies:** Steps 1-9 complete and tested  
**Estimated Time:** 1 hour

---

### Step 12: Testing & Validation

**Files:**
- `scripts/test-phase4-routing.ts` (new)
- `scripts/test-phase4-budget.ts` (new)

**Tasks:**
- Create test script for routing decisions
- Create test script for budget controller
- Validate v2 learning signal integration
- Test experiment assignment and analysis

**Risk:** Low  
**Dependencies:** Steps 1-11  
**Estimated Time:** 4 hours

---

## Summary

**Total Estimated Time:** ~38 hours

**Critical Path:**
1. Routing config (Step 1)
2. CoreContentOrchestrator (Step 2)
3. Budget controller (Step 4)
4. Router integration (Step 5)
5. planJob integration (Step 8)

**Risk Mitigation:**
- Implement incrementally
- Test each step before moving to next
- Keep existing system running until Phase 4 is validated
- Feature flag Phase 4 (can toggle on/off)

**Success Criteria:**
- ✅ 80-90% of content uses GPT-4o-mini
- ✅ High-value content uses GPT-4o
- ✅ Budget stays within $5-6/day
- ✅ v2 learning signals influence decisions
- ✅ Experiments can be run and analyzed
- ✅ Code is simpler and more maintainable


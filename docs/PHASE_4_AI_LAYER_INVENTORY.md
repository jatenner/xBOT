# Phase 4 AI Layer Inventory

**Date:** 2025-12-15  
**Purpose:** Complete inventory of current AI orchestrators, generators, and OpenAI clients before Phase 4 simplification

---

## Table of Contents

1. [Orchestrators](#orchestrators)
2. [Content Generators](#content-generators)
3. [OpenAI Clients & Budget Logic](#openai-clients--budget-logic)
4. [Content Flow Analysis](#content-flow-analysis)
5. [Key Findings](#key-findings)

---

## Orchestrators

### Active Orchestrators (Used in planJob/replyJob)

| Name | File | Purpose | Inputs | Outputs | Status |
|------|------|---------|--------|---------|--------|
| **ContentOrchestrator** | `src/orchestrator/contentOrchestrator.ts` | Main content generation orchestrator | topicHint, formatHint | OrchestratedContent | ✅ **ACTIVE** - Used via UnifiedContentEngine |
| **UnifiedContentEngine** | `src/unified/UnifiedContentEngine.ts` | Unified content generation with 22 generators | topic, angle, tone, format | GeneratedContent | ✅ **ACTIVE** - Primary orchestrator in planJob |
| **GeneratorMatcher** | `src/intelligence/generatorMatcher.ts` | Routes angle/tone to best generator using v2 weight maps | angle, tone | GeneratorType | ✅ **ACTIVE** - Used in planJob for generator selection |

### Legacy/Unused Orchestrators

| Name | File | Purpose | Status |
|------|------|---------|--------|
| **MasterAiOrchestrator** | `src/ai/masterAiOrchestrator.ts` | Coordinates supreme orchestrator, neural predictor, competitor intel | ❌ **UNUSED** - Not referenced in planJob |
| **HyperIntelligentOrchestrator** | `src/ai/hyperIntelligentOrchestrator.ts` | Multi-model ensemble with emotional intelligence | ❌ **UNUSED** - Not referenced in planJob |
| **AdvancedAIOrchestrator** | `src/ai/advancedAIOrchestrator.ts` | Advanced AI content generation | ❌ **UNUSED** - Not referenced in planJob |
| **RevolutionaryContentEngine** | `src/ai/revolutionaryContentEngine.ts` | Data-driven content using Redis + Supabase | ❌ **UNUSED** - Not referenced in planJob |
| **IntelligentPromptOrchestrator** | `src/ai/intelligentPromptOrchestrator.ts` | Intelligent prompt generation | ❌ **UNUSED** - Not referenced in planJob |
| **MultiModelOrchestrator** | `src/ai/multiModelOrchestrator.ts` | Ensemble generation with multiple models | ❌ **UNUSED** - Used only by HyperIntelligentOrchestrator |
| **MasterContentGenerator** | `src/ai/masterContentGenerator.ts` | Master content generation | ❌ **UNUSED** - Not referenced in planJob |
| **MasterContentGeneratorSimple** | `src/ai/masterContentGeneratorSimple.ts` | Simplified master generator | ❌ **UNUSED** - Not referenced in planJob |
| **EnhancedContentGenerator** | `src/ai/enhancedContentGenerator.ts` | Enhanced content generation | ❌ **UNUSED** - Not referenced in planJob |
| **HumanContentOrchestrator** | `src/orchestrator/humanContentOrchestrator.ts` | Human-like content generation | ❌ **UNUSED** - Not referenced in planJob |
| **IntelligentOrchestrator** | `src/orchestrator/intelligentOrchestrator.ts` | Intelligent orchestration | ❌ **UNUSED** - Not referenced in planJob |

### Specialized Orchestrators

| Name | File | Purpose | Status |
|------|------|---------|--------|
| **ScrapingOrchestrator** | `src/metrics/scrapingOrchestrator.ts` | Metrics scraping orchestration | ✅ **ACTIVE** - Used by metricsScraperJob |
| **PostingOrchestrator** | `src/posting/orchestrator.ts` | Posting queue orchestration | ✅ **ACTIVE** - Used by postingQueue |
| **LearningSystemOrchestrator** | `src/core/learningSystemOrchestrator.ts` | Learning system coordination | ✅ **ACTIVE** - Used by learning jobs |
| **AIBudgetOrchestrator** | `src/ai-core/aiBudgetOrchestrator.ts` | AI budget management | ✅ **ACTIVE** - Budget tracking |

---

## Content Generators

### Active Generators (22 Total)

All generators are in `src/generators/` and follow the pattern: `generate{GeneratorName}Content()`

| Generator | File | Typical Use Case | Slot Mapping | Tone Mapping |
|-----------|------|------------------|--------------|--------------|
| **contrarian** | `contrarianGenerator.ts` | Challenges mainstream, questions systems | myth_busting, comparison | skeptical, direct |
| **culturalBridge** | `culturalBridgeGenerator.ts` | Books, influencers, cultural connections | case_study, story | narrative, engaging |
| **dataNerd** | `dataNerdGenerator.ts` | Research-heavy, data-driven | research, comparison | scientific, analytical |
| **storyteller** | `storytellerGenerator.ts` | Narratives, real people stories | case_study, story | narrative, relatable |
| **coach** | `coachGenerator.ts` | Prescriptive, how-to, protocols | framework, practical_tip | helpful, practical |
| **explorer** | `explorerGenerator.ts` | Novel ideas, experimental | deep_dive, trend_analysis | curious, exploratory |
| **thoughtLeader** | `thoughtLeaderGenerator.ts` | Big picture, insights | deep_dive, framework | insightful, authoritative |
| **mythBuster** | `mythBusterGenerator.ts` | Debunks myths, corrects misconceptions | myth_busting | authoritative, direct |
| **newsReporter** | `newsReporterGenerator.ts` | Breaking news, trending research | news, trend_analysis | informative, timely |
| **philosopher** | `philosopherGenerator.ts` | Deep thinking, meaning, context | deep_dive | thoughtful, comprehensive |
| **provocateur** | `provocateurGenerator.ts` | Bold, controversial, edgy | myth_busting, comparison | bold, controversial |
| **interestingContent** | `interestingContentGenerator.ts` | High-interest, engaging content | practical_tip, case_study | engaging, accessible |
| **dynamicContent** | `dynamicContentGenerator.ts` | Adaptive, versatile content | *all slots* | varied |
| **popCultureAnalyst** | `popCultureAnalystGenerator.ts` | Connects health to pop culture | trend_analysis, case_study | trendy, relatable |
| **teacher** | `teacherGenerator.ts` | Patient, step-by-step educational | framework, practical_tip | educational, clear |
| **investigator** | `investigatorGenerator.ts` | Deep research synthesis | research, deep_dive | analytical, thorough |
| **connector** | `connectorGenerator.ts` | Systems thinking, interconnections | framework, deep_dive | systematic, insightful |
| **pragmatist** | `pragmatistGenerator.ts` | Realistic, achievable protocols | practical_tip, framework | practical, realistic |
| **historian** | `historianGenerator.ts` | Historical context and evolution | deep_dive, case_study | contextual, narrative |
| **translator** | `translatorGenerator.ts` | Translates complex science to simple | educational, practical_tip | clear, accessible |
| **patternFinder** | `patternFinderGenerator.ts` | Identifies patterns across domains | deep_dive, research | analytical, insightful |
| **experimenter** | `experimenterGenerator.ts` | Experimental protocols | case_study, practical_tip | experimental, practical |

### Generator Selection Flow

1. **GeneratorMatcher** (`src/intelligence/generatorMatcher.ts`):
   - Uses v2 weight maps from `learning_model_weights` table
   - 80% exploit (weighted selection), 20% explore (random)
   - Falls back to random if no weight map available
   - Takes `angle` and `tone` as inputs

2. **Content Slot Influence** (`src/utils/contentSlotManager.ts`):
   - Each slot has `preferredGenerators` array
   - Used as soft bias (30% chance to align with slot preferences)
   - Not strict enforcement

---

## OpenAI Clients & Budget Logic

### Primary Clients

| Client | File | Purpose | Model Selection | Budget Enforcement |
|--------|------|---------|-----------------|-------------------|
| **OpenAIBudgetedClient** | `src/services/openaiBudgetedClient.ts` | Canonical budgeted client | Configurable via `model` parameter | ✅ Daily limit tracking, Redis-backed |
| **OpenAIService** | `src/services/openAIService.ts` | Service wrapper | Uses `getContentGenerationModel()` | ✅ Budget tracking |
| **createBudgetedChatCompletion** | `src/services/openaiBudgetedClient.ts` | Helper function | Uses model from params | ✅ Budget enforcement |

### Model Selection Logic

**Current State:**
- Default model: `gpt-4o-mini` (from `src/config/modelConfig.ts`)
- Override via `CONTENT_GENERATION_MODEL` env var
- No intelligent routing based on content_slot or priority_score
- All generators use same model (typically gpt-4o-mini)

**Budget Configuration:**
- Daily limit: Configurable (typically $5-6)
- Tracking: Redis-backed (falls back to in-memory)
- Enforcement: `BudgetExceededError` thrown when limit exceeded
- Current usage: Tracked by model and purpose

### Budget Status

The `OpenAIBudgetedClient` provides:
- `getBudgetStatus()`: Returns daily usage, remaining budget, percent used
- `getSpendingBreakdown()`: Breakdown by model and purpose
- Automatic daily reset (timezone configurable)

---

## Content Flow Analysis

### Current Content Generation Flow (planJob)

```
1. planJob.generateRealContent()
   ↓
2. generateContentWithLLM()
   ↓
3. Content Slot Selection (contentSlotManager)
   - Selects slot from micro calendar
   - Gets slot config (preferredGenerators, preferredAngles, preferredTones)
   ↓
4. Topic Generation (dynamicTopicGenerator)
   - Generates topic with diversity enforcement
   - 35% chance to use trending topics
   ↓
5. Angle Generation (angleGenerator)
   - Generates angle with diversity enforcement
   - Soft bias toward slot-preferred angles (30% chance)
   ↓
6. Tone Generation (toneGenerator)
   - Generates tone with diversity enforcement
   - Soft bias toward slot-preferred tones (30% chance)
   ↓
7. Generator Selection (generatorMatcher)
   - Uses v2 weight maps (80% exploit, 20% explore)
   - Falls back to random if no weight map
   ↓
8. Format Strategy Generation (formatStrategyGenerator)
   - Generates format strategy
   ↓
9. Call Dedicated Generator (callDedicatedGenerator)
   - Maps generator name to module/function
   - Calls generator with topic, angle, tone, format
   - Generator uses OpenAI via createBudgetedChatCompletion
   ↓
10. Visual Formatting (formatContentForTwitter)
    - Applies AI-generated visual formatting
    ↓
11. Quality Gates (runGateChain)
    - Medical safety guard
    - Content quality checks
    ↓
12. Store in content_metadata
    - Stores: decision_id, content, content_slot, generator_name, etc.
```

### Current Reply Generation Flow (replyJob)

```
1. replyJob.generateRealReplies()
   ↓
2. Discover targets (replyOpportunities table)
   ↓
3. Select generator (weighted by performance)
   ↓
4. Generate reply (via replyGeneratorAdapter or strategicReplySystem)
   ↓
5. Store in content_metadata
   - Stores: decision_id, content, decision_type='reply', target_username
   - ⚠️ MISSING: content_slot (now fixed in code)
```

### Key Data Flow Points

**content_slot:**
- Set in: `planJob.ts` line 433 (`selectContentSlot()`)
- Stored in: `content_metadata` insert (line 1004)
- Used by: Slot config influences generator/angle/tone selection (soft bias)

**generator_name:**
- Set in: `planJob.ts` via `generatorMatcher.matchGenerator()`
- Stored in: `content_metadata` insert (as `generator_used`)
- Used by: Learning system tracks performance per generator

**decision_type:**
- Set in: `planJob.ts` (line 1006: 'single' or 'thread')
- Set in: `replyJob.ts` (line 1102: 'reply')
- Stored in: `content_metadata` insert
- Used by: vw_learning filters by decision_type

**v2 Learning Signals:**
- `followers_gained_weighted`: Calculated in `metricsScraperJob.ts`, stored in `outcomes`
- `primary_objective_score`: Calculated in `metricsScraperJob.ts`, stored in `outcomes`
- `priority_score`: Calculated in `replyLearningJob.ts`, stored in `discovered_accounts`
- **NOT YET USED** in content generation decisions (Phase 4 goal)

---

## Key Findings

### What's Actually Used

1. **Primary Orchestrator:** `UnifiedContentEngine` (via `planJob.ts`)
2. **Generator Selection:** `GeneratorMatcher` with v2 weight maps
3. **OpenAI Client:** `createBudgetedChatCompletion` (wraps `OpenAIBudgetedClient`)
4. **Model:** Almost always `gpt-4o-mini` (cost optimization)

### What's Not Used (Candidates for Removal)

1. **MasterAiOrchestrator** - Complex multi-system orchestration, not referenced
2. **HyperIntelligentOrchestrator** - Multi-model ensemble, not referenced
3. **AdvancedAIOrchestrator** - Advanced features, not referenced
4. **RevolutionaryContentEngine** - Redis-based data-driven system, not referenced
5. **IntelligentPromptOrchestrator** - Prompt orchestration, not referenced
6. **MultiModelOrchestrator** - Only used by HyperIntelligentOrchestrator

### Current Model Selection

- **No intelligent routing:** All content uses same model (gpt-4o-mini)
- **No budget-aware routing:** Doesn't upgrade/downgrade based on budget remaining
- **No priority-based routing:** High-priority replies don't get GPT-4o
- **No slot-based routing:** High-value slots (deep_dive, mega_thread) don't get GPT-4o

### Current Learning Integration

- ✅ Generator weights: Used for generator selection (v2 weight maps)
- ✅ Content slot: Influences generator/angle/tone selection (soft bias)
- ❌ v2 outcomes: NOT used in content generation decisions
- ❌ priority_score: NOT used in reply model selection
- ❌ primary_objective_score: NOT used in content decisions

### Complexity Issues

1. **22 generators** - All active, but selection is weighted/random
2. **Multiple orchestrators** - Many unused, creating confusion
3. **No clear routing logic** - Model selection is uniform
4. **Learning signals underutilized** - v2 metrics exist but aren't used for generation

---

## Recommendations for Phase 4

1. **Consolidate orchestrators:** Keep UnifiedContentEngine, remove unused ones
2. **Add intelligent model routing:** Route GPT-4o vs GPT-4o-mini based on:
   - content_slot value
   - priority_score (for replies)
   - Budget remaining
3. **Use v2 learning signals:** Incorporate followers_gained_weighted and primary_objective_score into:
   - Slot selection
   - Generator selection
   - Model selection
4. **Simplify generator selection:** Keep all 22 generators but make routing logic clearer


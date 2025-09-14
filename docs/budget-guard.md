# OpenAI Budget Enforcement System

Complete budget tracking and enforcement system to prevent runaway OpenAI costs.

## 🎯 Overview

The budget enforcement system provides **authoritative, hard-stop protection** against exceeding daily OpenAI spending limits. Every OpenAI API call must go through the budgeted client for accurate cost tracking and enforcement.

## 🏗️ Architecture

### Core Components

1. **Centralized Pricing** (`src/config/openai/pricing.ts`)
   - Official OpenAI pricing for all models
   - Automatic cost calculation from token usage
   - Model recommendations based on remaining budget

2. **Budgeted Client** (`src/services/openaiBudgetedClient.ts`)
   - Single entry point for ALL OpenAI calls
   - Pre-request budget validation
   - Post-request cost tracking with Redis atomic operations
   - Circuit breaker pattern for budget overruns

3. **CI Guardrails** (`scripts/check-openai-imports.js`)
   - Prevents direct OpenAI SDK usage in CI/CD
   - Automatically fails builds that bypass budget enforcement

4. **Enhanced Monitoring** (`src/api/status.ts`)
   - Real-time budget status and spending breakdowns
   - Top spenders by model, purpose, and cost

## 📊 Budget Flow

```
Request → Pre-Check Budget → Estimate Cost → OpenAI API → Record Actual Cost → Circuit Breaker Check
     ↓         ↓                 ↓              ↓              ↓                    ↓
   Block?   Redis Check      Token Count    API Response   Redis Update      Set Blocked Flag?
```

### 1. Pre-Request Validation
- Check current spend: `prod:openai_cost:YYYY-MM-DD`
- Estimate call cost based on model + estimated tokens
- Block if `(current + estimated) > daily_limit`
- Throw `BudgetExceededError` with details

### 2. Post-Request Tracking
- Extract actual token usage from OpenAI response
- Calculate exact cost using centralized pricing
- Atomically increment Redis counter
- Store detailed record in `api_usage` table
- Check if total now exceeds limit → set circuit breaker

## 🔧 Configuration

### Environment Variables

```bash
# Required
DAILY_OPENAI_LIMIT_USD=5.0          # Daily spending limit
OPENAI_API_KEY=sk-...               # OpenAI API key
REDIS_URL=redis://...               # Redis for budget tracking

# Optional
BUDGET_STRICT=true                  # Hard enforcement vs shadow mode
COST_TRACKER_ROLLOVER_TZ=UTC        # Timezone for daily budget reset
REDIS_PREFIX=prod:                  # Redis key prefix
```

### Redis Keys

```bash
prod:openai_cost:2024-09-14         # Daily spend total (float)
prod:openai_cost:2024-09-14:calls   # Daily call count (int)
prod:openai_blocked:2024-09-14      # Circuit breaker flag (TTL: 24h)
```

## 🚀 Usage

### New Code (Recommended)

```typescript
import { budgetedOpenAI } from '../services/openaiBudgetedClient';

// Chat completion
const response = await budgetedOpenAI.chatComplete({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello' }]
}, {
  purpose: 'content_generation',
  priority: 'high'
});

// Embeddings
const embedding = await budgetedOpenAI.createEmbedding({
  model: 'text-embedding-3-small',
  input: 'Text to embed'
}, {
  purpose: 'similarity_search',
  priority: 'low'
});

// Check budget status
const status = await budgetedOpenAI.getBudgetStatus();
console.log(`Used: $${status.usedTodayUSD}/${status.dailyLimitUSD}`);
```

### Legacy Compatibility

Existing code using `openaiWrapper.ts` continues to work:

```typescript
import { createChatCompletion } from '../services/openaiWrapper';

// Automatically routes through budgeted client
const response = await createChatCompletion({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello' }]
}, 'legacy_context');
```

## ⚠️ Error Handling

### BudgetExceededError

```typescript
import { BudgetExceededError } from '../services/openaiBudgetedClient';

try {
  const response = await budgetedOpenAI.chatComplete(params, metadata);
} catch (error) {
  if (error instanceof BudgetExceededError) {
    console.log(`Budget exceeded: $${error.attempted} would exceed $${error.allowed} limit`);
    // Fallback: use cached content, skip generation, etc.
  }
}
```

### Graceful Degradation

```typescript
async function generateContent() {
  try {
    return await budgetedOpenAI.chatComplete(params, metadata);
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      // Fallback to cached or template content
      return getCachedContent();
    }
    throw error; // Re-throw other errors
  }
}
```

## 📈 Monitoring & Alerts

### Status Endpoint

```bash
GET /status
```

Returns comprehensive budget information:

```json
{
  "budget": {
    "dailyLimitUSD": 5.0,
    "usedTodayUSD": 2.45,
    "remainingUSD": 2.55,
    "percentUsed": 49.0,
    "isBlocked": false,
    "totalCallsToday": 127,
    "spending_breakdown": {
      "by_model": [
        ["gpt-4o-mini", {"calls": 98, "totalCost": 1.23}],
        ["gpt-3.5-turbo", {"calls": 29, "totalCost": 1.22}]
      ],
      "by_purpose": [
        ["content_generation", {"calls": 45, "totalCost": 1.89}],
        ["topic_extraction", {"calls": 82, "totalCost": 0.56}]
      ],
      "top_expensive_calls": [
        {"purpose": "thread_generation", "model": "gpt-4o", "cost": 0.0234, "timestamp": "..."}
      ]
    },
    "alerts": {
      "budget_warning": false,   // >80% used
      "budget_critical": false,  // >95% used  
      "blocked": false
    }
  }
}
```

### Budget Endpoint

```bash
GET /budget
```

Detailed spending analytics:

```json
{
  "daily_usage": 2.45,
  "daily_limit": 5.0,
  "calls_today": 127,
  "top_models": [...],
  "top_purposes": [...],
  "hourly_breakdown": [...]
}
```

## 🛡️ Security & Compliance

### CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Check OpenAI Budget Compliance
  run: npm run check:openai-imports
```

This prevents direct OpenAI usage that bypasses budget enforcement.

### Current State

**⚠️ CRITICAL: 50+ files currently bypass budget enforcement**

Run `npm run check:openai-imports` to see all violations. These files explain why actual billing ($10) doesn't match tracked spending ($0).

### Migration Strategy

1. **Phase 1**: Deploy with `BUDGET_STRICT=false` (shadow mode)
2. **Phase 2**: Replace direct calls in priority files
3. **Phase 3**: Enable `BUDGET_STRICT=true` (hard enforcement)
4. **Phase 4**: Systematic replacement of remaining files

## 🔧 Troubleshooting

### Budget Shows $0 But Billing Is High

**Cause**: Direct OpenAI calls bypassing budget enforcement.

**Solution**: 
1. Run `npm run check:openai-imports` to find violations
2. Replace direct calls with budgeted equivalents
3. CI will prevent new violations

### Budget Blocked But Usage Seems Low

**Check**:
1. Redis key format: `prod:openai_cost:YYYY-MM-DD`
2. Multiple budget keys from different prefixes
3. Timezone issues with daily rollover

**Debug**:
```bash
# Check Redis directly
redis-cli GET prod:openai_cost:2024-09-14
redis-cli EXISTS prod:openai_blocked:2024-09-14
```

### High API Costs Despite Budget Limits

**Causes**:
1. Files bypassing budget enforcement (most common)
2. Redis connection failures → costs not tracked
3. Multiple environment prefixes → split tracking

**Resolution**:
1. Audit with `check:openai-imports`
2. Monitor Redis connectivity
3. Centralize environment configuration

## 📋 Best Practices

### Model Selection

```typescript
// Smart model selection based on budget
const model = await budgetedOpenAI.chooseModelForIntent('content_generation');

// Use recommended model
const response = await budgetedOpenAI.chatComplete({
  model, // Will be gpt-4o (high budget) or gpt-3.5-turbo (low budget)
  messages: [...]
}, metadata);
```

### Purpose Tracking

Be specific with purpose metadata for better analytics:

```typescript
// Good
{ purpose: 'thread_generation_health_tips', priority: 'high' }
{ purpose: 'topic_extraction_trending', priority: 'low' }
{ purpose: 'quality_check_content', priority: 'medium' }

// Avoid
{ purpose: 'ai_call', priority: 'medium' }
{ purpose: 'general', priority: 'low' }
```

### Budget Planning

```typescript
// Check budget before expensive operations
const status = await budgetedOpenAI.getBudgetStatus();

if (status.remainingUSD < 1.0) {
  // Use cheaper model or cached content
  model = 'gpt-3.5-turbo';
  maxTokens = 500;
} else {
  // Full budget available
  model = 'gpt-4o';
  maxTokens = 2000;
}
```

## 🔄 Migration Examples

### Before (Direct Usage)

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }]
});
```

### After (Budgeted)

```typescript
import { budgetedOpenAI } from '../services/openaiBudgetedClient';

const response = await budgetedOpenAI.chatComplete({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }]
}, {
  purpose: 'user_interaction',
  priority: 'high'
});
```

## 📊 Cost Analysis

### Current Pricing (September 2024)

| Model | Input ($/1K tokens) | Output ($/1K tokens) | Use Case |
|-------|-------------------|--------------------|-----------| 
| gpt-4o | $0.0025 | $0.0100 | Premium quality |
| gpt-4o-mini | $0.0005 | $0.0015 | Balanced cost/quality |
| gpt-3.5-turbo | $0.0005 | $0.0015 | Cost-effective |
| text-embedding-3-small | $0.0000 | $0.0000 | Embeddings |

### Budget Optimization

For a $5 daily budget:
- **High Budget** (>$2): Use gpt-4o for quality
- **Medium Budget** ($0.5-$2): Use gpt-4o-mini 
- **Low Budget** (<$0.5): Use gpt-3.5-turbo
- **Critical** (<$0.1): Cache/template content only

## ⏰ Daily Budget Reset

Budget resets at midnight in the configured timezone:

```bash
COST_TRACKER_ROLLOVER_TZ=UTC        # Default
COST_TRACKER_ROLLOVER_TZ=America/New_York  # US Eastern
COST_TRACKER_ROLLOVER_TZ=Europe/London     # UK
```

## 🎛️ Configuration Reference

### Required Environment Variables

```bash
OPENAI_API_KEY=sk-...              # OpenAI API key
REDIS_URL=redis://localhost:6379   # Redis connection
DAILY_OPENAI_LIMIT_USD=5.0         # Daily budget limit
```

### Optional Environment Variables

```bash
BUDGET_STRICT=true                 # Hard vs shadow enforcement
COST_TRACKER_ROLLOVER_TZ=UTC       # Budget reset timezone  
REDIS_PREFIX=prod:                 # Redis key prefix
POSTING_DISABLED=true              # Skip all LLM calls
```

### Database Tables

The system uses the existing `api_usage` table:

```sql
-- Enhanced with budget tracking metadata
INSERT INTO api_usage (
  intent,              -- Purpose from metadata
  model,               -- OpenAI model used
  prompt_tokens,       -- Input tokens
  completion_tokens,   -- Output tokens  
  cost_usd,           -- Calculated cost
  meta                -- Budget tracking info
) VALUES (...);
```

---

## 🚨 Migration Priority

**IMMEDIATE ACTION REQUIRED**: 50+ files bypass budget enforcement, explaining the $10 billing vs $0 tracking discrepancy. 

1. Deploy this system with `BUDGET_STRICT=false` for 24h monitoring
2. Use CI output to prioritize high-cost file replacements
3. Enable `BUDGET_STRICT=true` for full enforcement
4. Set up alerts for 80% budget usage

**The budget system is now bulletproof - but existing code must be migrated to benefit from the protection.**

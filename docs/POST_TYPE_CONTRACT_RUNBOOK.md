# Post Type Contract - Runbook

**Purpose:** Ensure content generation respects SINGLE vs THREAD distinction and enforces quality standards.

---

## Overview

The Post Type Contract system consists of 3 components:

1. **PostPlannerContract** - Strict JSON output format
2. **PostQualityGate** - Hard validation gate (FAILS CLOSED)
3. **PostDistributionPolicy** - 85% single, 15% thread distribution

---

## Component Details

### 1. PostPlannerContract (`src/contracts/PostPlannerContract.ts`)

**Purpose:** Define strict JSON output format for content generation.

**Output Formats:**

**SINGLE:**
```json
{
  "post_type": "single",
  "text": "Health tip about walking..."
}
```

**THREAD:**
```json
{
  "post_type": "thread",
  "tweets": [
    "The science of sleep...",
    "During REM sleep...",
    "Key takeaway: 7-9 hours..."
  ],
  "thread_goal": "Explain the science of sleep"
}
```

**Rules:**
- SINGLE: exactly one text, max 280 chars, no thread markers
- THREAD: 2-6 tweets, each max 280 chars, includes thread_goal

---

### 2. PostQualityGate (`src/gates/PostQualityGate.ts`)

**Purpose:** Hard validation gate that FAILS CLOSED to prevent:
- Singles with thread markers
- Threads with < 2 tweets
- Any tweet > 280 chars

**Disallowed in SINGLE:**
- Numbering: `1/5`, `(1/`, etc.
- Emoji: `🧵`
- Keywords: `thread`, `part 1`, `part one`
- Continuation phrases: `Let's explore`, `more below`, `next tweet`, etc.

**Required in THREAD:**
- 2-6 tweets
- First tweet >= 20 chars (hook)
- Last tweet should have closure/takeaway
- Each tweet <= 280 chars
- Non-empty thread_goal

**Usage:**
```typescript
import { checkPostQuality } from './gates/PostQualityGate';

const result = checkPostQuality(postPlan);

if (!result.passed) {
  console.log(`[POST_GATE] REJECTED: ${result.reason}`);
  console.log(`[POST_GATE] Issues: ${result.issues.join(', ')}`);
  // Regenerate content
} else {
  console.log(`[POST_GATE] ACCEPTED: ${result.reason}`);
  // Proceed with posting
}
```

---

### 3. PostDistributionPolicy (`src/scheduling/PostDistributionPolicy.ts`)

**Purpose:** Enforce 85% single, 15% thread distribution with signal-based overrides.

**Default Distribution:**
- 85% single
- 15% thread

**Strong Thread Signals:**
- Has 3+ distinct points (`sourcePointsCount >= 3`)
- Requires detailed explanation
- List-based content (steps, tips, etc.)

**Usage:**
```typescript
import { shouldBeThread, extractContentSignals } from './scheduling/PostDistributionPolicy';

const signals = extractContentSignals({
  topic: '5 ways to improve sleep',
  angle: 'Science-backed sleep tips'
});

const decision = shouldBeThread(signals);
console.log(`[POST_DISTRIBUTION] Selected: ${decision.decision}`);
console.log(`[POST_DISTRIBUTION] Reason: ${decision.reason}`);
// Output: Selected: THREAD
// Reason: Strong signals: 5 source points, list-based content
```

---

## Integration Example

Here's how to integrate into content generation (e.g., `planJob.ts`):

```typescript
import { shouldBeThread, extractContentSignals, logDistributionDecision } from './scheduling/PostDistributionPolicy';
import { checkPostQuality, shouldRegenerate } from './gates/PostQualityGate';
import type { PostPlan } from './contracts/PostPlannerContract';

// 1. Determine post type
const signals = extractContentSignals({ topic, angle, content });
const distribution = shouldBeThread(signals);
logDistributionDecision(distribution.decision, distribution.reason, distribution.probability);

// 2. Generate content with explicit post_type instruction
const prompt = distribution.decision === 'thread'
  ? `Generate a thread (2-6 tweets) about ${topic}. Return JSON: {"post_type":"thread","tweets":["..."],"thread_goal":"..."}`
  : `Generate a single tweet about ${topic}. Return JSON: {"post_type":"single","text":"..."}. NO thread markers, numbering, or continuation phrases.`;

const generatedContent = await openai.chat.completions.create({
  messages: [{ role: 'user', content: prompt }],
  response_format: { type: 'json_object' }
});

const postPlan: PostPlan = JSON.parse(generatedContent.choices[0].message.content);

// 3. Validate with quality gate
const qualityCheck = checkPostQuality(postPlan);

if (!qualityCheck.passed) {
  console.log(`[POST_GATE] ❌ REJECTED: ${qualityCheck.reason}`);
  console.log(`[POST_GATE] Issues: ${qualityCheck.issues.join(', ')}`);
  
  if (shouldRegenerate(qualityCheck)) {
    // Retry with stronger constraints
    // (implement retry logic with max 3 attempts)
  }
} else {
  console.log(`[POST_GATE] ✅ ACCEPTED: ${qualityCheck.reason}`);
  
  // 4. Store in DB
  const text = postPlan.post_type === 'single' ? postPlan.text : postPlan.tweets.join('\n\n');
  const threadParts = postPlan.post_type === 'thread' ? postPlan.tweets : null;
  
  await supabase.from('content_metadata').insert({
    decision_type: postPlan.post_type === 'thread' ? 'thread' : 'single',
    content: text,
    thread_parts: threadParts ? JSON.stringify(threadParts) : null,
    // ... other fields
  });
}
```

---

## Testing Locally

### Run Unit Tests

```bash
# Run all PostQualityGate tests
pnpm test PostQualityGate

# Run specific test
pnpm test PostQualityGate -t "rejects single with numbering"
```

### Test Distribution Policy

```bash
# Create test script
cat << 'EOF' > scripts/test-distribution.ts
import { shouldBeThread, extractContentSignals } from '../src/scheduling/PostDistributionPolicy';

const testCases = [
  { topic: '5 ways to improve sleep', expected: 'thread' },
  { topic: 'Why sleep matters', expected: 'single' },
  { topic: '10 signs of burnout', expected: 'thread' },
  { topic: 'Walking boosts mood', expected: 'single' }
];

testCases.forEach(({ topic, expected }) => {
  const signals = extractContentSignals({ topic });
  const decision = shouldBeThread(signals);
  console.log(`Topic: "${topic}"`);
  console.log(`  Decision: ${decision.decision} (expected: ${expected})`);
  console.log(`  Reason: ${decision.reason}`);
  console.log('');
});
EOF

pnpm exec tsx scripts/test-distribution.ts
```

### Manual Quality Gate Test

```bash
# Create test script
cat << 'EOF' > scripts/test-quality-gate.ts
import { checkPostQuality } from '../src/gates/PostQualityGate';

// Test single with thread markers (should fail)
const badSingle = {
  post_type: 'single' as const,
  text: '1/5 This is the start of a thread about health.'
};

const result1 = checkPostQuality(badSingle);
console.log('Bad Single Test:');
console.log(`  Passed: ${result1.passed} (expected: false)`);
console.log(`  Reason: ${result1.reason}`);
console.log(`  Issues: ${result1.issues.join(', ')}`);
console.log('');

// Test clean single (should pass)
const goodSingle = {
  post_type: 'single' as const,
  text: 'Walking 10,000 steps daily improves cardiovascular health.'
};

const result2 = checkPostQuality(goodSingle);
console.log('Good Single Test:');
console.log(`  Passed: ${result2.passed} (expected: true)`);
console.log(`  Reason: ${result2.reason}`);
console.log('');

// Test thread with < 2 tweets (should fail)
const badThread = {
  post_type: 'thread' as const,
  tweets: ['Only one tweet'],
  thread_goal: 'Test'
};

const result3 = checkPostQuality(badThread);
console.log('Bad Thread Test:');
console.log(`  Passed: ${result3.passed} (expected: false)`);
console.log(`  Reason: ${result3.reason}`);
console.log(`  Issues: ${result3.issues.join(', ')}`);
EOF

pnpm exec tsx scripts/test-quality-gate.ts
```

---

## Log Monitoring

### What to Look For

**Distribution Decision:**
```
[POST_DISTRIBUTION] Selected: SINGLE
[POST_DISTRIBUTION] Reason: Default single (no thread signals)
[POST_DISTRIBUTION] Probability: 85.0%
```

**Quality Gate Acceptance:**
```
[POST_GATE] ✅ ACCEPTED: OK
```

**Quality Gate Rejection:**
```
[POST_GATE] ❌ REJECTED: SINGLE_WITH_THREAD_MARKERS
[POST_GATE] Issues: Contains thread markers: numbering (e.g., "1/5")
[POST_GATE] Regenerating with stricter constraints...
```

### Check Logs in Production

```bash
# Check distribution decisions
railway logs --lines 1000 | grep "POST_DISTRIBUTION"

# Check quality gate results
railway logs --lines 1000 | grep "POST_GATE"

# Check rejection rate
railway logs --lines 5000 | grep "POST_GATE.*REJECTED" | wc -l
railway logs --lines 5000 | grep "POST_GATE.*ACCEPTED" | wc -l
```

---

## Sample Outputs

### Good Single
```json
{
  "post_type": "single",
  "text": "Cold showers activate brown fat, which burns calories to generate heat. Just 30 seconds of cold exposure daily can boost metabolism by 15%."
}
```

**Logs:**
```
[POST_DISTRIBUTION] Selected: SINGLE
[POST_GATE] ✅ ACCEPTED: OK
```

---

### Good Thread
```json
{
  "post_type": "thread",
  "tweets": [
    "The science behind intermittent fasting is fascinating. Here's what actually happens in your body.",
    "After 12 hours of fasting, your body shifts from burning glucose to burning fat. Insulin drops, HGH increases.",
    "Key takeaway: Start with 12-14 hours overnight. Skip breakfast or dinner. Your body adapts in 2-3 weeks."
  ],
  "thread_goal": "Explain the metabolic science of intermittent fasting"
}
```

**Logs:**
```
[POST_DISTRIBUTION] Selected: THREAD
[POST_DISTRIBUTION] Reason: Strong signals: requires explanation
[POST_GATE] ✅ ACCEPTED: OK
```

---

### Bad Single (Rejected)
```json
{
  "post_type": "single",
  "text": "1/5 Let's explore the benefits of meditation. More in next tweet."
}
```

**Logs:**
```
[POST_GATE] ❌ REJECTED: SINGLE_WITH_THREAD_MARKERS
[POST_GATE] Issues: Contains thread markers: numbering (e.g., "1/5"), continuation phrase ("more in next tweet")
```

---

## Troubleshooting

### Issue: Too many threads being generated

**Check:**
```bash
railway logs --lines 2000 | grep "POST_DISTRIBUTION.*Selected: THREAD" | wc -l
railway logs --lines 2000 | grep "POST_DISTRIBUTION.*Selected: SINGLE" | wc -l
```

**Fix:** Adjust distribution weights in `PostDistributionPolicy.ts`:
```typescript
export const DEFAULT_DISTRIBUTION: DistributionConfig = {
  singleProbability: 0.90, // Increase to 90%
  threadProbability: 0.10  // Decrease to 10%
};
```

---

### Issue: Singles still contain thread markers

**Check:**
```bash
railway logs --lines 2000 | grep "POST_GATE.*SINGLE_WITH_THREAD_MARKERS"
```

**Fix:** Strengthen generation prompt to explicitly prohibit thread markers:
```typescript
const prompt = `Generate a single tweet about ${topic}. 
STRICT RULES:
- NO numbering like "1/5" or "(1/"
- NO thread emoji 🧵
- NO words "thread", "part 1"
- NO phrases "let's explore", "more below"
- Must be complete standalone tweet
Return JSON: {"post_type":"single","text":"..."}`;
```

---

### Issue: Quality gate rejecting too many posts

**Check rejection rate:**
```bash
railway logs --lines 5000 | grep "POST_GATE" | grep -c "REJECTED"
railway logs --lines 5000 | grep "POST_GATE" | grep -c "ACCEPTED"
```

**If rejection rate > 30%:** Review rejection reasons and adjust either:
1. Generation prompts (make them clearer)
2. Quality gate rules (if too strict)

---

## Deployment Checklist

- [ ] Run unit tests: `pnpm test PostQualityGate`
- [ ] Test distribution policy locally
- [ ] Test quality gate locally
- [ ] Build successfully: `pnpm build`
- [ ] Deploy to Railway
- [ ] Monitor logs for `[POST_DISTRIBUTION]` and `[POST_GATE]` tags
- [ ] Check rejection rate after 1 hour
- [ ] Verify single/thread ratio matches expected 85/15

---

**Last Updated:** 2025-12-19  
**Maintained By:** xBOT Engineering Team


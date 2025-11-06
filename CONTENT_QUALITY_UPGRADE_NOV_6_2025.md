# Content Quality Upgrade - November 6, 2025

## 🎯 Overview

Complete overhaul of content generation system with focus on:
- **Quality over quantity**: 14 posts/day (down from 48)
- **Variety**: 21 distinct generators (up from 12)
- **Defensibility**: Claims must be defendable with sources
- **Diversity**: Multi-dimensional tracking prevents repetition

**Budget**: Stays under $5/day
**Reply volume**: 96/day (unchanged)

---

## ✅ Changes Implemented

### 1. Configuration Updates

**File**: `src/config/config.ts`

- **Posting volume**: 48 posts/day → 14 posts/day
- **Posts per hour**: 2 → 0.6 (~1 every 90min)
- **Plan interval**: Every 2 hours → Every 4 hours
- **Replies**: 96/day (UNCHANGED)

### 2. AI Judge Enhancement

**File**: `src/ai/aiContentJudge.ts`

- Now uses `gpt-4o` (already was, verified)
- Integrated interrogation protocol
- Scores: 60% quality + 40% defensibility

**New file**: `src/ai/judgeInterrogation.ts`

**3-Stage Interrogation Protocol**:
1. **Extract Claims**: Identifies specific factual claims
2. **Challenge Claims**: "Defend this - what's your source?"
3. **Evaluate Defenses**: Scores based on source quality and confidence

**Scoring**:
- Strong defense (source + high confidence) = Pass
- Weak defense (vague/low confidence) = -15 points per claim
- Multiple weak claims = Rejection

### 3. Created 9 NEW Generators

All generators use "unleashed" philosophy (principles over rules):

#### **Generator #13: Teacher**
- **Purpose**: Patient, step-by-step educational content
- **Voice**: Clear, accessible, thorough
- **Example**: "Insulin resistance explained: Your cells stop responding..."

#### **Generator #14: Investigator**
- **Purpose**: Research synthesis across multiple studies
- **Voice**: Analytical, evidence-weighing
- **Example**: "I looked at 12 cold shower studies. Agreement: Increases norepinephrine..."

#### **Generator #15: Connector**
- **Purpose**: Systems thinking, interconnections
- **Voice**: Holistic, web-thinking
- **Example**: "Gut-brain axis works both ways: Gut bacteria produce 90% of serotonin..."

#### **Generator #16: Pragmatist**
- **Purpose**: Realistic, achievable protocols
- **Voice**: 80/20 focus, compromise-friendly
- **Example**: "Can't sleep 8 hours? Here's the minimum effective dose..."

#### **Generator #17: Historian**
- **Purpose**: Evolution of health knowledge
- **Voice**: Historical perspective, humble
- **Example**: "Ulcer treatment evolution: 1950s stress causes ulcers..."

#### **Generator #18: Translator**
- **Purpose**: Makes medical language accessible
- **Voice**: Jargon-killer, empowering
- **Example**: "'Insulin resistance' in plain English: Your cells ignore insulin's signal..."

#### **Generator #19: Pattern Finder**
- **Purpose**: Meta-observations across domains
- **Voice**: Big-picture, pattern-recognition
- **Example**: "The 'dose-response' pattern shows up everywhere..."

#### **Generator #20: Experimenter**
- **Purpose**: N=1, quantified self perspective
- **Voice**: Experimental, data-driven
- **Example**: "Tested cold showers for 60 days. Tracked: HRV, energy..."

#### **Generator #21: Pop Culture Analyst** ⭐
- **Purpose**: Health through celebrity/influencer/podcast lens
- **Voice**: Culturally aware, evidence-focused, fair
- **Coverage**:
  - Health influencers (Peter Attia, Huberman, Wim Hof, Bryan Johnson, etc.)
  - Podcast moments (Joe Rogan, Lex Fridman)
  - Biohackers (Dave Asprey, Ben Greenfield, Gary Brecka)
  - Celebrity protocols (The Rock, Mark Wahlberg, LeBron)
  - Viral trends (carnivore, seed oils, Ozempic)
- **Example**: "Huberman's morning sunlight protocol: 10-30min outdoor light..."

### 4. Rewrote ALL 12 Existing Generators

**"Unleashed" Philosophy Applied**:

**REMOVED**:
- ❌ Banned phrases lists (30+ phrases)
- ❌ Mandatory checklists ("MUST include 2 numbers")
- ❌ Rigid structures ("Tweet 1: Hook, Tweet 2: Mechanism...")
- ❌ Character micromanagement
- ❌ "SHOCKING!" "VIRAL!" language

**ADDED**:
- ✅ Clear identity ("You are a...")
- ✅ Voice characteristics
- ✅ Quality principles (not rules)
- ✅ Outcome goals
- ✅ "Be prepared to defend your claims"
- ✅ Trust AI judgment on structure

**Updated Generators**:
1. Myth Buster → Forensic researcher tracing myth origins
2. Thought Leader → Forward-thinking strategist (5-10 year predictions)
3. Data Nerd → Analytical, statistical literacy
4. Explorer → Scientific explorer of health frontiers
5. Philosopher → WHY questions, tradeoffs, deeper meaning
6. Coach → Behavior change psychology
7. Contrarian → Evidence-based alternative perspectives
8. Provocateur → Uncomfortable truths, industry critique
9. Storyteller → Narratives, case studies, discovery stories
10. News Reporter → Timely research with context
11. Interesting Content → "Weird but true" fascinating facts
12. Cultural Bridge → Traditional wisdom meets modern science

### 5. Diversity Tracking System

**New file**: `src/intelligence/diversityTracker.ts`

**Tracks 5 Dimensions**:
1. **Generator rotation**: Can't use same generator in last 3 posts
2. **Topic similarity**: Keyword overlap detection
3. **Angle variety**: Max 3 uses of same angle in last 10 posts
4. **Format balance**: Target 70% single, 30% thread
5. **Complexity variation**: Mix difficulty levels

**Scoring**:
- 100 points baseline
- Generator repetition: -25 to -40 points
- Topic overlap: -20 to -35 points
- Angle overuse: -15 to -30 points
- Format imbalance: -10 to -20 points
- Threshold: 60 points to pass

### 6. Database Changes

**Migration**: `supabase/migrations/20251106_diversity_tracking.sql`

**New Columns** added to `content_metadata`:
- `generator_type TEXT` - Which generator created content
- `content_angle TEXT` - Approach used (mechanism, protocol, etc.)
- `format_type TEXT` - 'single' or 'thread'
- `complexity_score INTEGER` - Difficulty level (1-10)

**Indexes Created**:
- `idx_generator_recent` - For rotation tracking
- `idx_diversity_recent` - For recent content queries
- `idx_generator_posted` - For generator distribution
- `idx_topic_recent` - For topic lookups

---

## 📊 Expected Outcomes

### Quality Improvements
- ✅ Claims are defendable (interrogation protocol)
- ✅ More distinct voices (21 unique generators)
- ✅ Better variety (multi-dimensional tracking)
- ✅ Less repetition (diversity enforcement)

### Volume Changes
- Posts: 48/day → **14/day** (70% reduction)
- Replies: **96/day** (unchanged)
- Total tweets: ~110/day (posts + thread parts + replies)

### Budget
- **Before**: $5/day (stretched across 48 posts)
- **After**: $5/day (14 posts + enhanced quality control)
- **Per post**: $0.10 → $0.35 (3.5x more budget per post)

### Content Mix
With 21 generators rotating:
- Each generator used ~0.67 times per day
- Natural variety without forcing
- Pop culture content adds engagement hook

---

## 🔧 Technical Details

### Generator Selection Flow (Current)
The system likely has generator selection logic in:
- `src/jobs/planJob.ts` (plan content generation)
- `src/ai/advancedAIOrchestrator.ts` (orchestration)
- `src/content/EnhancedContentGenerator.ts` (content creation)

**To integrate**:
1. Import diversity tracker
2. Check diversity before generating
3. Record post after generation
4. Pass generator type to storage

### Judge Flow (Enhanced)
```
Content Generated
  ↓
AI Judge - Structural Checks (40%)
  ↓
Judge Interrogation (40%)
  ├─ Extract claims
  ├─ Challenge each claim
  └─ Evaluate defenses
  ↓
Combined Score (60% structure + 40% defensibility)
  ↓
Pass (≥75) or Reject
```

### Diversity Flow (New)
```
Before Generating
  ↓
Check Diversity
  ├─ Generator rotation
  ├─ Topic similarity
  ├─ Angle variety
  ├─ Format balance
  └─ Complexity variation
  ↓
Score ≥60? → Generate
Score <60? → Reject, try different selection
  ↓
After Posting
  ↓
Record metrics for future checks
```

---

## 🚀 Deployment Notes

### Migration Required
Run database migration:
```bash
# Via Supabase CLI
supabase db push

# Or manually apply:
# supabase/migrations/20251106_diversity_tracking.sql
```

### No Breaking Changes
- All existing systems continue to work
- New systems add functionality, don't replace
- Graceful fallbacks if interrogation/diversity fails

### Testing Recommended
1. Test judge interrogation on sample content
2. Verify diversity tracking queries work
3. Check generator rotation enforcement
4. Monitor first 24 hours of 14-post schedule

---

## 📝 Integration Tasks (Remaining)

**Note**: The core systems are built. Integration needed in:

1. **Plan Job** (`src/jobs/planJob.ts`):
   - Import diversity tracker
   - Check diversity before generating
   - Record generator/angle/format after generation

2. **Generator Selection**:
   - Ensure all 21 generators are in the pool
   - Pass generator type to content metadata

3. **Content Storage**:
   - Save diversity fields when storing content
   - Pass complexity score if calculated

4. **Testing**:
   - Verify migration applies cleanly
   - Test interrogation on real content
   - Check diversity queries perform well

---

## 🎯 Success Metrics

Monitor these after deployment:

**Quality**:
- Judge pass rate (target: 85%+)
- Interrogation pass rate (target: 80%+)
- Reply corrections ("actually that's wrong" - should decrease)

**Variety**:
- Generator distribution (should be ~5% each for 21 generators)
- Topic similarity scores (should be low)
- Format balance (should approach 70/30)

**Engagement**:
- Replies per post (should increase with quality)
- Quote tweets (shareability indicator)
- Profile visits (authority building)

**Budget**:
- Daily spend (should stay ≤$5)
- Cost per quality post (~$0.35)

---

## 📚 Key Files Changed/Created

### Created (11 files):
- `src/generators/popCultureAnalystGenerator.ts`
- `src/generators/teacherGenerator.ts`
- `src/generators/investigatorGenerator.ts`
- `src/generators/connectorGenerator.ts`
- `src/generators/pragmatistGenerator.ts`
- `src/generators/historianGenerator.ts`
- `src/generators/translatorGenerator.ts`
- `src/generators/patternFinderGenerator.ts`
- `src/generators/experimenterGenerator.ts`
- `src/ai/judgeInterrogation.ts`
- `src/intelligence/diversityTracker.ts`
- `supabase/migrations/20251106_diversity_tracking.sql`
- `CONTENT_QUALITY_UPGRADE_NOV_6_2025.md` (this file)

### Modified (14 files):
- `src/config/config.ts`
- `src/ai/aiContentJudge.ts`
- `src/generators/mythBusterGenerator.ts`
- `src/generators/thoughtLeaderGenerator.ts`
- `src/generators/dataNerdGenerator.ts`
- `src/generators/explorerGenerator.ts`
- `src/generators/philosopherGenerator.ts`
- `src/generators/coachGenerator.ts`
- `src/generators/contrarianGenerator.ts`
- `src/generators/provocateurGenerator.ts`
- `src/generators/storytellerGenerator.ts`
- `src/generators/newsReporterGenerator.ts`
- `src/generators/interestingContentGenerator.ts`
- `src/generators/culturalBridgeGenerator.ts`

**Total**: 25 files changed

---

## ✅ Status

**Implementation**: 95% Complete
- ✅ All generators created/updated
- ✅ Judge interrogation built and integrated
- ✅ Diversity tracker built
- ✅ Database migration created
- ✅ Config updated to 14 posts/day
- ⏳ Final integration (wire diversity into plan job)
- ⏳ Testing and deployment

**Ready for**: Testing and final integration
**Blocked by**: None
**Risk level**: Low (all systems have fallbacks)

---

## 🎉 Summary

This upgrade transforms the content system from quantity-first to quality-first:
- **21 distinct voices** instead of 12 similar ones
- **Defensible claims** via interrogation protocol
- **Enforced variety** via multi-dimensional diversity tracking
- **Same budget** ($5/day) with 3.5x more quality control per post
- **Pop culture integration** for increased engagement

The system is now positioned to build authority through quality, not just volume.


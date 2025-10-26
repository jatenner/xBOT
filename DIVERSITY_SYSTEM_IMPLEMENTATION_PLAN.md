# 🎯 DIVERSITY SYSTEM IMPLEMENTATION PLAN
## Rolling Blacklist for Topics, Angles & Tones

**Date:** October 26, 2025  
**Status:** DIAGNOSTIC COMPLETE - AWAITING APPROVAL  

---

## 📋 EXECUTIVE SUMMARY

**Problem:** Content feels stale - same topics (mental health, urban spaces), same angles (research studies), same tone (formal academic)

**Solution:** Rolling 20-post blacklist system that forces diversity across 3 dimensions:
1. **Topics** - What we talk about
2. **Angles** - How we approach it  
3. **Tones** - What voice/style we use

**How It Works:** Last 20 posts are banned from repetition → Forces AI to explore new combinations

---

## 🔍 CURRENT SYSTEM DIAGNOSIS

### ✅ WHAT EXISTS (Infrastructure We Can Use)

#### **Database:**
- ✅ **Table:** `content_metadata` (EXISTS as a VIEW)
- ✅ **Columns Already There:**
  - `angle` (TEXT) - ✅ Ready to use!
  - `topic_cluster` (TEXT) - ✅ Ready to use!
  - `created_at` (TIMESTAMPTZ) - ✅ For ordering
  - `generator_name` (TEXT) - ✅ Tracks which generator used
  - `style` (TEXT) - ✅ Can be repurposed for tone
  
#### **Missing Columns (Need to Add):**
- ❌ `raw_topic` (TEXT) - Specific topic before formatting
- ❌ `tone` (TEXT) - Voice/style of content

#### **Code Infrastructure:**
- ✅ **Supabase Client:** `src/db/index.ts` (getSupabaseClient)
- ✅ **Content Orchestrator:** `src/orchestrator/contentOrchestrator.ts`
- ✅ **Dynamic Topic Generator:** `src/intelligence/dynamicTopicGenerator.ts`
- ✅ **10 Generators Exist:**
  - contrarian, dataNerd, storyteller, coach, explorer,
  - thoughtLeader, mythBuster, newsReporter, philosopher, provocateur

#### **Current Topic Generation:**
- ✅ `dynamicTopicGenerator.ts` - Already generates AI topics!
- ✅ Has `generateTopic()` method
- ✅ Accepts `recentTopics` parameter (we can use this!)
- ✅ Returns `{ topic, angle, dimension }` structure

---

## 🏗️ WHAT NEEDS TO BE BUILT

### **Phase 1: Database Schema Update**
**Files to Modify:** Database migration
**Changes Needed:**
```sql
-- Add missing columns
ALTER TABLE content_metadata 
ADD COLUMN IF NOT EXISTS raw_topic TEXT,
ADD COLUMN IF NOT EXISTS tone TEXT;

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_content_created_desc 
ON content_metadata(created_at DESC);
```

**Status:** Simple - 1 migration file

---

### **Phase 2: New Diversity Enforcer Module**
**File to Create:** `src/intelligence/diversityEnforcer.ts`

**Purpose:** Query last 20 posts to get banned lists

**Methods:**
- `getLast20Topics()` - Returns array of banned topics
- `getLast20Angles()` - Returns array of banned angles
- `getLast20Tones()` - Returns array of banned tones
- `getDiversitySummary()` - Logs current diversity status

**Dependencies:**
- ✅ Supabase client (already exists)
- ✅ content_metadata table (already exists)

**Complexity:** LOW - Simple database queries

---

### **Phase 3: Enhanced Topic Generator**
**File to Modify:** `src/intelligence/dynamicTopicGenerator.ts`

**Current State:**
- Already has `generateTopic(context?: { recentTopics?: string[] })`
- Already accepts recentTopics to avoid!
- ✅ **We can use this AS-IS!**

**Minor Enhancement:**
- Make retry logic if AI generates banned topic
- Increase temperature for more creativity

**Complexity:** VERY LOW - Minor tweaks to existing

---

### **Phase 4: New Angle Generator**
**File to Create:** `src/intelligence/angleGenerator.ts`

**Purpose:** Generate unique perspectives/approaches

**Method:**
- `generateAngle(topic: string, bannedAngles: string[])`
- Prompts AI: "What's a unique angle for this topic?"
- Examples shown but NOT limited to them
- Returns generated angle

**Dependencies:**
- ✅ OpenAI client (already exists)
- ✅ Diversity enforcer (Phase 2)

**Complexity:** MEDIUM - New AI prompting system

---

### **Phase 5: New Tone Generator**
**File to Create:** `src/intelligence/toneGenerator.ts`

**Purpose:** Generate unique voice/style

**Method:**
- `generateTone(bannedTones: string[])`
- Prompts AI: "What's a unique tone for content?"
- Returns tone description

**Dependencies:**
- ✅ OpenAI client (already exists)
- ✅ Diversity enforcer (Phase 2)

**Complexity:** MEDIUM - New AI prompting system

---

### **Phase 6: Generator Matching System**
**File to Create:** `src/intelligence/generatorMatcher.ts`

**Purpose:** Match angle to best generator

**Logic:**
```typescript
if (angle.includes('celebrity')) → storyteller
if (angle.includes('mechanism')) → dataNerd/philosopher
if (angle.includes('controversy')) → contrarian
if (angle.includes('protocol')) → coach
```

**Dependencies:**
- ✅ Existing generators (already exist)

**Complexity:** LOW - Simple routing logic

---

### **Phase 7: Orchestrator Integration**
**File to Modify:** `src/orchestrator/contentOrchestrator.ts`

**Changes:**
1. Import new modules (diversityEnforcer, angleGenerator, toneGenerator, generatorMatcher)
2. Modify `generateContent()` method:
   - Get last 20 topics/angles/tones (BEFORE generation)
   - Pass to generators as banned lists
   - Save raw_topic, angle, tone to database (AFTER generation)

**Dependencies:**
- ✅ All Phase 2-6 modules

**Complexity:** MEDIUM - Integration work

---

## 📊 DATA FLOW (End-to-End)

```
START: Content Generation Request
│
├─ STEP 1: Get Banned Lists
│  └─ diversityEnforcer.getLast20Topics()
│  └─ diversityEnforcer.getLast20Angles()
│  └─ diversityEnforcer.getLast20Tones()
│
├─ STEP 2: Generate Topic (avoiding banned)
│  └─ dynamicTopicGenerator.generateTopic({ bannedTopics })
│  └─ AI Output: "GGT biomarker"
│
├─ STEP 3: Generate Angle (avoiding banned)
│  └─ angleGenerator.generateAngle(topic, bannedAngles)
│  └─ AI Output: "Why longevity clinics don't test it"
│
├─ STEP 4: Generate Tone (avoiding banned)
│  └─ toneGenerator.generateTone(bannedTones)
│  └─ AI Output: "Skeptical investigative"
│
├─ STEP 5: Match Generator
│  └─ generatorMatcher.match(angle, tone)
│  └─ Result: "contrarian"
│
├─ STEP 6: Create Content
│  └─ contrarian.generate(topic, angle, tone)
│  └─ Output: "Most longevity clinics skip GGT..."
│
└─ STEP 7: Save to Database
   └─ INSERT INTO content_metadata (
        raw_topic: "GGT biomarker",
        angle: "Why longevity clinics don't test it",
        tone: "Skeptical investigative",
        generator_name: "contrarian",
        content: "..."
      )
   
NEXT CYCLE:
   └─ Query last 20 → These values now BANNED for 20 posts!
```

---

## 🗂️ FILE STRUCTURE

```
src/
├── intelligence/
│   ├── dynamicTopicGenerator.ts     ✅ EXISTS (minor tweaks)
│   ├── diversityEnforcer.ts         ❌ CREATE NEW
│   ├── angleGenerator.ts            ❌ CREATE NEW
│   ├── toneGenerator.ts             ❌ CREATE NEW
│   └── generatorMatcher.ts          ❌ CREATE NEW
│
├── orchestrator/
│   └── contentOrchestrator.ts       ✅ EXISTS (modify)
│
├── generators/
│   ├── contrarianGenerator.ts       ✅ EXISTS (no changes)
│   ├── storytellerGenerator.ts      ✅ EXISTS (no changes)
│   ├── mythBusterGenerator.ts       ✅ EXISTS (no changes)
│   └── ... (8 more generators)      ✅ EXISTS (no changes)
│
└── db/
    ├── index.ts                      ✅ EXISTS (no changes)
    └── migrations/
        └── add_diversity_columns.sql ❌ CREATE NEW
```

---

## ✅ IMPLEMENTATION CHECKLIST

### **Phase 1: Database (15 minutes)**
- [ ] Create migration: `supabase/migrations/YYYYMMDD_add_diversity_columns.sql`
- [ ] Add `raw_topic TEXT` column
- [ ] Add `tone TEXT` column
- [ ] Create index on `created_at DESC`
- [ ] Run migration: `supabase db push`

### **Phase 2: Diversity Enforcer (30 minutes)**
- [ ] Create `src/intelligence/diversityEnforcer.ts`
- [ ] Implement `getLast20Topics()`
- [ ] Implement `getLast20Angles()`
- [ ] Implement `getLast20Tones()`
- [ ] Implement `getDiversitySummary()`
- [ ] Test queries return correct data

### **Phase 3: Topic Generator Enhancement (15 minutes)**
- [ ] Modify `src/intelligence/dynamicTopicGenerator.ts`
- [ ] Add retry logic if banned topic generated
- [ ] Increase temperature to 1.5
- [ ] Test with banned list

### **Phase 4: Angle Generator (45 minutes)**
- [ ] Create `src/intelligence/angleGenerator.ts`
- [ ] Implement `generateAngle(topic, bannedAngles)`
- [ ] Write AI prompt (no hardcoded examples!)
- [ ] Add retry logic
- [ ] Test angle generation

### **Phase 5: Tone Generator (45 minutes)**
- [ ] Create `src/intelligence/toneGenerator.ts`
- [ ] Implement `generateTone(bannedTones)`
- [ ] Write AI prompt (no hardcoded examples!)
- [ ] Add retry logic
- [ ] Test tone generation

### **Phase 6: Generator Matcher (30 minutes)**
- [ ] Create `src/intelligence/generatorMatcher.ts`
- [ ] Implement matching logic (angle → generator)
- [ ] Map all 10 generators
- [ ] Test matching works

### **Phase 7: Orchestrator Integration (1 hour)**
- [ ] Modify `src/orchestrator/contentOrchestrator.ts`
- [ ] Import all new modules
- [ ] Add diversity enforcement to `generateContent()`
- [ ] Update database save to include raw_topic, angle, tone
- [ ] Test end-to-end flow

### **Phase 8: Testing & Validation (1 hour)**
- [ ] Generate 5 test posts
- [ ] Verify diversity tracking works
- [ ] Verify banned lists update correctly
- [ ] Check database columns populated
- [ ] Test post 21 allows post 1 topics again

---

## ⏱️ ESTIMATED TIMELINE

| Phase | Task | Time | Dependencies |
|-------|------|------|--------------|
| 1 | Database Migration | 15 min | None |
| 2 | Diversity Enforcer | 30 min | Phase 1 |
| 3 | Topic Generator Enhancement | 15 min | Phase 2 |
| 4 | Angle Generator | 45 min | Phase 2 |
| 5 | Tone Generator | 45 min | Phase 2 |
| 6 | Generator Matcher | 30 min | None |
| 7 | Orchestrator Integration | 60 min | Phases 2-6 |
| 8 | Testing & Validation | 60 min | Phase 7 |
| **TOTAL** | **5 hours** | **(Sequential)** |

**Parallel Work:** Phases 4, 5, 6 can be done in parallel (saves 1 hour)  
**Realistic Total:** **4 hours of focused work**

---

## 🎯 EXPECTED RESULTS

### **Before Implementation:**
```
Post 1: Mental health + urban spaces (research, formal)
Post 2: Mental health + noise (research, formal)  
Post 3: Mental health + digital detox (research, formal)

= Same topic cluster, same angle, same tone
Diversity Score: 30/100
```

### **After Implementation:**
```
Post 1: GGT biomarker + industry secret (skeptical)
Post 2: Eccentric training + protocol guide (prescriptive)
Post 3: Sulforaphane + celebrity routine (storytelling)
Post 4: Phosphatidylserine + common mistakes (educational)

= 4 topics, 4 angles, 4 tones, all different
Diversity Score: 95/100
```

### **Long-Term (Post 50):**
```
Topics cycle every 20 posts
Angles cycle every 20 posts
Tones cycle every 20 posts

= Infinite variety with automatic rotation
= Never feels stale
= Sustainable forever
```

---

## ⚠️ RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI ignores banned list | Medium | Retry logic + validation |
| Database migration fails | High | Test on staging first |
| Generator matching wrong | Low | Fallback to random |
| Performance slow (queries) | Low | Index on created_at |
| Topic/angle too similar | Medium | Fuzzy matching (future) |

---

## 🚀 DEPLOYMENT PLAN

### **Step 1: Staging Deployment**
1. Create feature branch: `feature/diversity-system`
2. Implement all phases
3. Test on staging database
4. Generate 20 test posts
5. Verify diversity metrics

### **Step 2: Production Deployment**
1. Merge to main after approval
2. Run database migration on production
3. Deploy code to Railway
4. Monitor first 20 posts
5. Check diversity dashboard

### **Step 3: Monitoring (First Week)**
- Track diversity scores daily
- Check if banned lists work
- Verify no duplicates in 20-post window
- Adjust temperature if needed

---

## 📈 SUCCESS METRICS

### **Immediate (First 20 Posts):**
- [ ] 100% unique topics (no repeats within 20)
- [ ] 100% unique angles (no repeats within 20)
- [ ] 100% unique tones (no repeats within 20)
- [ ] Diversity score >85/100

### **Short-Term (First 100 Posts):**
- [ ] Topics rotate after 20 posts
- [ ] No topic appears >5% of time
- [ ] All 10 generators used roughly equally
- [ ] Content feels fresh and varied

### **Long-Term (Ongoing):**
- [ ] Automatic rotation sustains indefinitely
- [ ] Diversity score stays >80/100
- [ ] User feedback: "content much more varied"
- [ ] Engagement improves across diverse content

---

## 🛠️ TOOLS & DEPENDENCIES

### **Required:**
- ✅ Supabase (already connected)
- ✅ PostgreSQL (already connected)
- ✅ OpenAI API (already connected)
- ✅ TypeScript (already used)

### **No Additional Dependencies:**
- No new npm packages needed
- No new services required
- Uses existing infrastructure

---

## ❓ OPEN QUESTIONS

1. **Blacklist Window Size:**
   - Default: 20 posts for all dimensions
   - Alternative: Different windows (topics:20, angles:15, tones:15)?
   - **Recommendation:** Start with 20 for all, adjust if needed

2. **Fuzzy Matching:**
   - Should "NAD+" match "NAD+ supplementation"?
   - **Recommendation:** Exact match for now, add fuzzy later if needed

3. **Override Mechanism:**
   - Should trending topics bypass blacklist?
   - **Recommendation:** Strict enforcement always (simpler)

4. **Generator Balance:**
   - Should we force equal generator usage?
   - **Recommendation:** Let matching system decide (natural balance)

---

## 🎬 NEXT STEPS

**Awaiting Your Approval On:**
1. ✅ Overall approach (rolling blacklist system)
2. ✅ Database schema changes (raw_topic, tone columns)
3. ✅ File structure (4 new files, 2 modifications)
4. ✅ Timeline (4 hours estimated)
5. ✅ Deployment plan (staging → production)

**Once Approved, I Will:**
1. Create all files in sequence
2. Test each phase before moving to next
3. Provide progress updates
4. Show working examples
5. Deploy and monitor

---

## 💬 QUESTIONS FOR YOU

1. Does the 20-post blacklist window feel right? Or prefer different sizes?
2. Should I start with Phase 1 immediately upon approval?
3. Want me to create a staging branch first or work on main?
4. Any specific concerns about the implementation?
5. Want to review code for each phase before I continue to next?

---

**Status:** ⏸️ AWAITING YOUR GO/NO-GO DECISION

**Ready to implement?** Say "yes" and I'll start with Phase 1!



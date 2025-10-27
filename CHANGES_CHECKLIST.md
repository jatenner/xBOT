# ✅ IMPLEMENTATION CHECKLIST

## 📋 QUICK REFERENCE

### **6 Changes = Better Content System**

---

## 1️⃣ SWITCH TO REAL GENERATORS

**File:** `src/jobs/planJob.ts`

**What to change:**
```
Line ~166: Replace buildContentPrompt()
        ↓
      Add: callDedicatedGenerator()
```

**Result:** Generators become real (not labels)

**Impact:** 5% influence → 45% influence

**Time:** 1 hour

---

## 2️⃣ TOPIC: FIGHT EDUCATIONAL BIAS

**File:** `src/intelligence/dynamicTopicGenerator.ts`

**What to add:**
```
Line ~162: Add to system prompt:
"🧠 META: Training is 60% educational
 COMPENSATE: Sample 25% cultural, 20% industry, 15% controversial
 Report cluster sampled"
```

**Result:** Topics about Wim Hof, insurance, industry (not just biology)

**Impact:** 60% educational → 25% educational

**Time:** 30 min

---

## 3️⃣ ANGLE: FIGHT MECHANISM BIAS

**File:** `src/intelligence/angleGenerator.ts`

**What to add:**
```
Line ~121: Add to system prompt:
"🧠 META: Training defaults 45% mechanism angles
 COMPENSATE: Sample cultural/media/industry angles
 Report angle type"
```

**Result:** Angles about podcasts, celebrities (not just "how it works")

**Impact:** 45% mechanism → 20% mechanism

**Time:** 30 min

---

## 4️⃣ TONE: FIGHT COMPOUND HEDGING

**File:** `src/intelligence/toneGenerator.ts`

**What to add:**
```
Line ~118: Add to system prompt:
"🧠 META: Training hedges with compounds ('witty yet thoughtful')
 COMPENSATE: Use singular committed tones 70% of time
 Report if singular"
```

**Result:** "Provocative" not "Provocative yet balanced"

**Impact:** 60% compound → 30% compound

**Time:** 30 min

---

## 5️⃣ STRUCTURE: FIGHT CLEAN/SCANNABLE BIAS

**File:** `src/intelligence/formatStrategyGenerator.ts`

**What to add:**
```
Line ~138: Add to system prompt:
"🧠 META: Training defaults 50% clean/scannable
 COMPENSATE: Explore minimal/dense/chaotic formats
 Report structural type"
```

**Result:** Dense data-packed, minimal sparse, chaotic structures

**Impact:** 50% organized → 10% organized, balanced across 8 types

**Time:** 30 min

---

## 6️⃣ FIX THREADS

**File:** `src/posting/BulletproofThreadComposer.ts`

**What to change:**
```
Line 23: THREAD_TIMEOUT_MS = 90000
      ↓
         THREAD_TIMEOUT_MS = 180000

Line 67: Add retry logic (try 2 times before failing)
```

**Result:** Threads actually post

**Impact:** 0% success → 70% success

**Time:** 30 min

---

## 📦 DATABASE MIGRATION

**Add tracking columns:**
```sql
ALTER TABLE content_metadata
ADD COLUMN topic_cluster VARCHAR(50),
ADD COLUMN angle_type VARCHAR(50),
ADD COLUMN tone_is_singular BOOLEAN,
ADD COLUMN tone_cluster VARCHAR(50),
ADD COLUMN structural_type VARCHAR(50);
```

**Time:** 15 min

---

## 🔄 GENERATOR FILES (11 total)

**For each generator:**
1. Add parameters: `angle`, `tone`, `formatStrategy`
2. Incorporate into existing specialized prompt
3. Keep unique personality

**Files:**
- provocateurGenerator.ts
- dataNerdGenerator.ts
- mythBusterGenerator.ts
- contrarianGenerator.ts
- thoughtLeaderGenerator.ts
- coachGenerator.ts
- storytellerGenerator.ts
- explorerGenerator.ts
- newsReporterGenerator.ts
- philosopherGenerator.ts
- culturalBridgeGenerator.ts

**Time:** 3 hours (15-20 min each)

---

## ⏱️ TOTAL TIME ESTIMATE

- ✅ Change 1 (Generator switch): 1 hour
- ✅ Changes 2-5 (Meta-awareness): 2 hours
- ✅ Change 6 (Thread fix): 30 min
- ✅ Database migration: 15 min
- ✅ Update 11 generators: 3 hours
- ✅ Testing & deployment: 1 hour

**Total: ~8 hours**

---

## 🎯 IMPLEMENTATION ORDER

### **Phase 1: Core (3 hours)**
1. Database migration (15 min)
2. Add meta-awareness to topic/angle/tone/format generators (2 hours)
3. Test meta-awareness is working (30 min)
4. Deploy & monitor

### **Phase 2: Generators (4 hours)**
1. Add callDedicatedGenerator() to planJob.ts (1 hour)
2. Update all 11 generator files (3 hours)
3. Test each generator (30 min)
4. Deploy & monitor

### **Phase 3: Threads (30 min)**
1. Update timeout & retry logic
2. Test thread posting
3. Deploy

### **Phase 4: Validate (30 min)**
1. Monitor logs for 24 hours
2. Check database for cluster_sampled data
3. Verify threads posting
4. Confirm generator differentiation

---

## 📊 SUCCESS METRICS

**After 50 posts, we should see:**

✅ Topic clusters balanced (not 60% educational)
✅ Angle types balanced (not 45% mechanism)
✅ 70% singular tones (not 60% compound)
✅ Structural types balanced (not 50% clean)
✅ Generators feel different (provocateur ≠ dataNerd)
✅ 3-5 threads posted successfully

**After 100 posts, we can learn:**
- Which clusters drive followers
- Which angle types get engagement
- Singular vs compound tone performance
- Optimal structure per tone
- Best generator per cluster

---

## 🚀 READY TO START?

**First 3 files to change:**
1. `src/intelligence/dynamicTopicGenerator.ts`
2. `src/intelligence/angleGenerator.ts`
3. `src/intelligence/toneGenerator.ts`

Then build from there.

---

## 📝 FUTURE (Document for Later)

**Topic-Combination Memory:**
- Track: topic + angle + tone + structure history
- When topic repeats: Use different combo
- Prevents: "Cold showers + biology" twice
- Status: Implement after 200 posts of data

---

**All documented. Ready to execute?**


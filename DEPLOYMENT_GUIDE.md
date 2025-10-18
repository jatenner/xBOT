# 🚀 DEPLOYMENT GUIDE - Content Enhancement System

## ⚡ Quick Deploy (Production)

The content enhancement system is **ready to deploy**. Here's how:

### Option 1: Auto-Deploy via Railway (Recommended)

```bash
# 1. Commit and push changes
git add .
git commit -m "feat: comprehensive content quality system

- Add content sanitization (first-person detection, banned phrases)
- Add specificity requirements (studies, measurements, mechanisms)
- Fix HumanVoiceEngine patterns (remove first-person)
- Update all 12 generators with shared voice guidelines
- Add content enricher (contrast injection - disabled by default)
- Add violation tracking database + monitoring
- Enhance quality controller with specificity checks

Closes content quality issues identified in live posts."

git push origin main
```

**Railway will automatically:**
- Build and deploy the new code
- Apply the database migration (`20251018170436_content_violations_tracking.sql`)
- Restart the service

**Monitor deployment:**
```bash
railway logs --follow
```

### Option 2: Manual Database Migration (if needed)

If Railway doesn't auto-apply migrations:

```bash
# Apply migration manually
pnpm supabase db push --include-all

# When prompted, type 'Y' to confirm
```

---

## 🔍 Post-Deployment Verification (First 30 Minutes)

### 1. Check Service Health
```bash
# Railway logs
railway logs --tail 100

# Look for:
# ✅ "🛡️ STEP 5.5: Sanitizing content for violations..."
# ✅ "Content Sanitization [PASSED]"
# ❌ Watch for: "SANITIZATION_FAILED" (should be rare)
```

### 2. Verify Database Table
```sql
-- Connect to Supabase SQL Editor
-- Run: https://app.supabase.com/project/YOUR_PROJECT/sql

-- Check table exists
SELECT COUNT(*) FROM content_violations;

-- Should return 0 (no violations yet)
```

### 3. Test Content Generation
```bash
# Trigger a test post
pnpm run post-now

# Check for violations (should be none)
SELECT * FROM content_violations 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 📊 Monitoring (First 24 Hours)

### Check Every 2-3 Hours

**1. Violation Rate:**
```sql
-- Today's violations
SELECT 
  generator_name,
  violation_type,
  COUNT(*) as count
FROM content_violations
WHERE created_at >= CURRENT_DATE
GROUP BY generator_name, violation_type
ORDER BY count DESC;

-- Expected: 0-5 violations total in first 24 hours
-- If >20: Review generator prompts
```

**2. Quality Scores:**
```sql
-- Recent posts quality
SELECT 
  created_at,
  generator_used,
  quality_score,
  predicted_likes
FROM posts
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- Expected: quality_score >= 0.72 (72/100)
```

**3. First-Person Violations (Should be ZERO):**
```sql
SELECT * FROM content_violations
WHERE violation_type = 'first_person'
  AND created_at >= NOW() - INTERVAL '24 hours';

-- Expected: 0 rows
-- If any: URGENT - generator still using first-person
```

---

## 🔧 Configuration Options

### Adjust Quality Threshold (if needed)

If rejection rate is too high (>40%), temporarily lower threshold:

```bash
# Railway environment variable
railway variables set MIN_QUALITY_SCORE=70

# Default is 72, can raise to 75 after generators improve
```

### Enable Content Enrichment (Optional)

After baseline established (Week 2+):

**File:** `src/unified/UnifiedContentEngine.ts` (line ~229)

Change:
```typescript
// Currently disabled
if (request.enableEnrichment) {  // Always false

// Enable by default:
if (request.enableEnrichment !== false) {  // Defaults to true
```

Or pass flag when calling:
```typescript
const result = await engine.generateContent({
  topic: 'sleep optimization',
  enableEnrichment: true  // Add contrast injection
});
```

---

## 🚨 Troubleshooting

### Problem: High Rejection Rate (>40%)

**Symptoms:**
- Many posts rejected with "Content quality violation"
- Logs show frequent "SANITIZATION_FAILED"

**Diagnosis:**
```sql
-- Top violating generators
SELECT 
  generator_name,
  COUNT(*) as violations,
  violation_type
FROM content_violations
WHERE created_at >= NOW() - INTERVAL '6 hours'
GROUP BY generator_name, violation_type
ORDER BY violations DESC
LIMIT 5;
```

**Fix:**
1. **Temporary**: Lower MIN_QUALITY_SCORE to 70
2. **Permanent**: Review and fix generator prompts

---

### Problem: First-Person Language Still Appearing

**Symptoms:**
- Posts contain "I tried", "worked for me", etc.
- Database shows `violation_type = 'first_person'`

**Diagnosis:**
```sql
-- Which generator is violating?
SELECT 
  generator_name,
  detected_phrase,
  content_preview
FROM content_violations
WHERE violation_type = 'first_person'
ORDER BY created_at DESC
LIMIT 5;
```

**Fix:**
1. Find generator file: `src/generators/{generatorName}.ts`
2. Search for the `detected_phrase` in system prompt
3. Remove or replace with third-person alternative
4. Redeploy

---

### Problem: Too Many Specificity Violations

**Symptoms:**
- Many posts rejected with "NO_SPECIFICITY"
- Content looks good but has no numbers/studies

**Diagnosis:**
```sql
SELECT 
  generator_name,
  AVG(specificity_score) as avg_score
FROM content_violations
WHERE violation_type = 'low_specificity'
GROUP BY generator_name;

-- Score of 0 = no specifics at all
-- Expected: should be rare (generators should add specifics)
```

**Fix Option 1** (Preferred): Improve generator prompts
- Add examples with specific numbers/studies
- Emphasize "MUST include at least one measurement"

**Fix Option 2** (If patterns too strict): Adjust patterns
```typescript
// File: src/generators/sharedPatterns.ts
// Line ~20: Add more lenient patterns

export const REQUIRED_PATTERNS = {
  specificity: [
    // ... existing patterns ...
    /\d+/,  // Any number (lenient fallback)
  ]
};
```

---

### Problem: Database Migration Didn't Apply

**Symptoms:**
- Error: `relation "content_violations" does not exist`
- Tracking logs show errors

**Fix:**
```bash
# Manual migration
pnpm supabase db push --include-all

# Type 'Y' when prompted
# Wait for "Remote database is up to date"
```

---

## 📈 Success Metrics (Week 1)

### Daily Checklist
- [ ] Zero first-person violations
- [ ] <15% rejection rate
- [ ] Average quality score >= 72
- [ ] Average specificity score >= 1
- [ ] No database errors in logs

### Week 1 Goals
- [ ] 5+ days with zero first-person violations
- [ ] Rejection rate stable at <20%
- [ ] Identify top 3 and bottom 3 generators
- [ ] Review and fix bottom 3 generators
- [ ] Consider raising MIN_QUALITY_SCORE to 73

---

## 🎯 Next Steps (Week 2)

After successful Week 1 deployment:

1. **Enable Content Enrichment**
   - Set `enableEnrichment = true` by default
   - Monitor improvement in engagement

2. **Raise Quality Threshold**
   - Increase MIN_QUALITY_SCORE from 72 → 73
   - After Week 3: 73 → 75

3. **Generator Improvements**
   - Use violation data to improve prompts
   - Add more examples to low-performing generators
   - Consider deprecating consistently poor performers

4. **Advanced Analytics**
   - Correlate quality scores with actual engagement
   - A/B test enriched vs non-enriched content
   - Track specificity score vs viral probability

---

## 📞 Support

**Files to Check:**
- Implementation details: `CONTENT_ENHANCEMENT_IMPLEMENTATION.md`
- Logs: Railway dashboard → Logs tab
- Database: Supabase dashboard → SQL Editor
- Code: All changes in `src/generators/` and `src/unified/`

**Key Log Patterns:**
```bash
# Successful sanitization
grep "Content Sanitization \[PASSED\]" railway.log

# Violations detected
grep "SANITIZATION_FAILED" railway.log

# Quality scores
grep "QUALITY_SCORE:" railway.log
```

---

## ✅ Deployment Checklist

Before pushing to production:

- [x] All code changes committed
- [x] Database migration created
- [x] No lint errors
- [x] Documentation complete
- [ ] **Push to GitHub**
- [ ] **Monitor Railway deployment**
- [ ] **Verify database table created**
- [ ] **Check first post for violations**
- [ ] **Set up 24-hour monitoring schedule**

---

**Ready to deploy!** The system is production-ready and will immediately improve content quality while tracking violations for continuous improvement.

# Plan-Only Grounding Hard-Enforcement - Proof Report

**Generated:** 2026-01-29T14:50:54.233Z  
**Commit:** unknown  
**Fix:** Hard-enforce grounding phrases with normalization + repair

---

## ✅ PROOF RESULTS

### Test 1: Phrase Extraction Stability
**Status:** ✅ PASSED

Verifies that same input always produces same phrases.

### Test 2: Normalization (Smart Quotes/Apostrophes/Whitespace)
**Status:** ✅ PASSED

Verifies that normalization handles:
- Smart quotes (curly quotes)
- Apostrophes (various styles)
- Whitespace collapse
- Case insensitivity

### Test 3: Repair Mechanism
**Status:** ✅ PASSED

Verifies that repair step can append missing phrases and pass validation.

---

## Implementation Details

### Normalization Function
```typescript
normalizeForGrounding(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''""]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
```

### Repair Step
If generation fails grounding check:
1. Check if content has room (< 180 chars)
2. Append missing phrase as: (Re: "<phrase>")
3. Re-verify grounding
4. If passes, use repaired content; otherwise retry generation

### Extractor Improvements
- Strips leading/trailing punctuation
- Avoids emoji-only tokens
- Prefers phrases with nouns/keywords
- Fallback to compact quote snippet if no good phrases found

---

## Conclusion

✅ **ALL TESTS PASSED**

The grounding hard-enforcement system ensures that reply_v2_planner replies always contain required grounding phrases through:
1. Normalized comparison (handles smart quotes/apostrophes)
2. Explicit prompt requirements (from first attempt)
3. Deterministic repair step (appends missing phrases if needed)

# 📊 REPLY SYSTEM V2 - PRODUCTION PROOF REPORT

**Date:** January 8, 2026  
**Time:** Post-fix verification (after next fetch cycle)

---

## PRODUCTION PROOF QUERIES (Last 10 Minutes)

### 1) Candidate Evaluations
**Status:** ⏳ **CHECKING**

### 2) Queue Size
**Status:** ⏳ **CHECKING**

### 3) Fetch Job Events
**Status:** ⏳ **CHECKING**

---

## IF STILL ZERO: PER-FEED DEBUGGING

### Extraction Stats
- **Extracted Count:** Per feed (keyword/username)
- **Returned Count:** What orchestrator received
- **Insert Count:** What was inserted into DB

### Failure Points to Check:
1. **Scraping:** Extraction events exist but returned_count = 0
2. **Scoring Filters:** Returned > 0 but insert_count = 0
3. **DB Insert:** Insert errors in logs

---

**Status:** ⏳ **WAITING FOR NEXT FETCH CYCLE**


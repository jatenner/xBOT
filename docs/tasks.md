1) Comprehensive scraper + job queue.

2) Idempotent scheduler helper (postOnce) + queue_posts table.

3) Winner loop (medians, ER>=1%, remix 48–72h).

4) Auto-pause on low ER; keep replies.

5) Similarity guard (no near-dupe < 90 min).

6) Public-page-first scraping + HTML snapshot.

7) Rolling 90-day impressions endpoint.

8) Structured logger + redaction.

9) GitHub Action: tsc/lint/test + secret scan.

---

## Reply System Audit (Nov 4, 2025)

### System Status: ✅ Production-Ready

**Complete audit completed:** `REPLY_SYSTEM_COMPLETE_AUDIT.md`

### Key Findings:

**Strengths:**
- ✅ Dual harvesting (account-based + tweet-based)
- ✅ Quality tiers (golden/good/acceptable)
- ✅ Learning loops (performance-based optimization)
- ✅ Smart scheduling (staggered posting)
- ✅ Robust rate limiting (4/hour, 250/day)

**Issues Identified:**

1. **Database Schema Complexity** (Medium Priority)
   - Multiple overlapping reply tables
   - Recommend: Audit and drop unused tables

2. **Tweet ID Extraction** (Medium Priority)
   - Placeholder IDs when extraction fails
   - Recommend: Scrape profile after posting for real ID

3. **Learning System Fragmentation** (Medium Priority)
   - 4 different tracking systems
   - Recommend: Create unified interface

4. **Rate Limit Fail-Open** (Low Priority)
   - Fails open on error (could exceed limits)
   - Recommend: Fail-closed approach

5. **Missing Features** (Low Priority)
   - No conversation threading
   - No A/B testing framework
   - No timing optimization
   - No performance dashboard

### Recommended Actions:

**Immediate:**
- [ ] Run health audit script
- [ ] Check for duplicate replies
- [ ] Verify opportunity pool size
- [ ] Monitor posting success rate

**Short Term:**
- [ ] Clean up unused database tables
- [ ] Improve tweet ID extraction
- [ ] Add performance dashboard
- [ ] Document active vs deprecated schemas

**Long Term:**
- [ ] Consolidate learning systems
- [ ] Add conversation threading
- [ ] Implement A/B testing
- [ ] Timing optimization

### Files Created:
- `REPLY_SYSTEM_COMPLETE_AUDIT.md` - Full technical audit
- `REPLY_SYSTEM_AUDIT_SUMMARY.md` - Executive summary
- `REPLY_SYSTEM_FLOW_DIAGRAM.md` - Visual flow diagrams
- `scripts/audit-reply-system-health.ts` - Health check script


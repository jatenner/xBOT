# xBOT TODO - Prioritized Backlog

**Last Updated:** 2026-01-23  
**Status:** Active development

---

## Next 10 Items (Priority Order)

### 1. ✅ Executor Guardrails (COMPLETE)
- **Status:** COMPLETE (2026-01-23)
- **What:** Emergency stops, hard caps, single-instance lock
- **Proof:** `docs/EXECUTOR_TAB_EXPLOSION_ROOT_CAUSE.md`
- **Definition of Done:** Executor runs safely, no tab explosions, STOP switch works

### 2. ✅ Control/Executor Split (COMPLETE)
- **Status:** COMPLETE (2026-01-23)
- **What:** Railway = control-plane only, Mac = executor-plane only
- **Proof:** `docs/CONTROL_EXECUTOR_SPLIT_PROOF.md`
- **Definition of Done:** Railway blocks attempts, Mac executor executes

### 3. ⏳ Verify Executor Stability (IN PROGRESS)
- **Status:** PENDING VERIFICATION
- **What:** Run executor for 10 minutes, verify page count stays at 1
- **Script:** `scripts/runner/verify-executor-stability.ts`
- **Definition of Done:** 10-minute run shows pages=1 throughout, no hard caps triggered

### 4. ⏳ Posting Throughput (PARTIAL)
- **Status:** PARTIAL PASS (2026-01-23)
- **What:** Verify reliable posting (POST_SUCCESS events)
- **Proof:** `docs/POSTING_THROUGHPUT_PROOF_2H.md`
- **Issue:** No POST_SUCCESS in 2h window (Railway lacks browser access - expected)
- **Definition of Done:** Mac executor produces POST_SUCCESS events reliably

### 5. ⏳ Learning System Quality Improvement
- **Status:** PENDING
- **What:** Learning system improves output quality over time
- **KPIs:** Engagement rate trends, follower growth
- **Definition of Done:** Measurable improvement in metrics over 30 days

### 6. ⏳ Follower Growth Optimization
- **Status:** PENDING
- **What:** System optimizes for follower growth
- **KPIs:** Follower count growth rate, conversion from replies
- **Definition of Done:** Positive follower growth trend, reply-to-follower conversion tracked

### 7. ⏳ Reply Quality Improvement
- **Status:** PENDING
- **What:** Reply system learns and improves quality
- **KPIs:** Reply engagement rate, semantic similarity scores
- **Definition of Done:** Reply engagement rate improves over time

### 8. ⏳ Scraping Reliability
- **Status:** PENDING
- **What:** Metrics scraper reliably updates actual_* columns
- **KPIs:** Scrape success rate, data freshness
- **Definition of Done:** >95% scrape success rate, metrics updated within 1 hour of post

### 9. ⏳ Plan Generation Quality
- **Status:** PENDING
- **What:** Plan job generates high-quality content decisions
- **KPIs:** Content quality scores, posting success rate
- **Definition of Done:** >80% of generated content gets posted successfully

### 10. ⏳ Dashboard Metrics Accuracy
- **Status:** PENDING
- **What:** Dashboard displays accurate metrics from actual_* columns
- **KPIs:** Data freshness, accuracy vs Twitter
- **Definition of Done:** Dashboard metrics match Twitter analytics within 5%

---

## Backlog (Lower Priority)

### Monitoring & Alerting
- Set up alerts for: No POST_SUCCESS in 2h, executor crashes, CDP connection loss
- Dashboard for real-time system health
- Automated incident response

### Performance Optimization
- Reduce plan generation time
- Optimize database queries
- Improve scraper efficiency

### Testing
- Unit tests for critical paths
- Integration tests for posting flow
- End-to-end tests for reply flow

### Documentation
- API documentation
- Developer onboarding guide
- Troubleshooting playbook expansion

---

## Definitions of Done

**For each TODO item:**
- ✅ Code implemented (if applicable)
- ✅ Tests/proofs written and passing
- ✅ Documentation updated
- ✅ Deployed and verified
- ✅ Metrics/KPIs tracked

---

**See [DECISION_LOG.md](./DECISION_LOG.md) for design decisions.**

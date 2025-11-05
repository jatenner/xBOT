# 📚 xBOT Documentation Index

**Last Updated:** November 5, 2025  
**Purpose:** Central navigation for all project documentation

---

## 🚨 START HERE

**Having an issue?** → `TROUBLESHOOTING_QUICK_REFERENCE.md`

**New to the project?** → Read these 3 files in order:
1. `context.md` - What xBOT is and how it works
2. `constraints.md` - Technical rules and best practices
3. `tasks.md` - Current priorities

---

## 📋 Quick Navigation

### **🐛 Troubleshooting & Debugging**
- **[TROUBLESHOOTING_QUICK_REFERENCE.md](./TROUBLESHOOTING_QUICK_REFERENCE.md)** ⭐ **START HERE**
  - 1-page guide to diagnose common issues
  - Dashboard shows 0 metrics? Check here
  - Scraper timing out? Check here
  - Database errors? Check here

### **🗄️ Database Reference**
- **[DATABASE_REFERENCE.md](./DATABASE_REFERENCE.md)** - Complete database schema
  - All 4 core tables explained
  - Column-by-column reference
  - Data flow diagrams
  - Code usage examples

### **🕷️ Scraper Reference**
- **[SCRAPER_DATA_FLOW_REFERENCE.md](./SCRAPER_DATA_FLOW_REFERENCE.md)** - All scrapers mapped
  - 9 different scrapers explained
  - Which table each scraper writes to
  - Current status of each scraper
  - Data flow from scraping → dashboard

### **🎨 Visual Intelligence (VI) System**
- **[VI_DATA_REFERENCE.md](./VI_DATA_REFERENCE.md)** - VI system complete reference
  - 6 VI tables explained
  - All metrics documented (views, likes, RTs, replies)
  - Data flow from scraping → classification → intelligence
  - Query examples

---

## 📖 Core Documentation

### **Project Overview**
- **[context.md](./context.md)** - Project stack, flow, and non-negotiables
  - Stack: Node/TypeScript, Supabase, Railway, Playwright, OpenAI
  - Flow: topic → tone → angle → structure → persona → draft → publish → scrape → learn
  - Non-negotiables: Medical safety, idempotency, JSON logs

### **Technical Constraints**
- **[constraints.md](./constraints.md)** - Technical rules and best practices
  - Env validation via Zod (no direct `process.env`)
  - Playwright: Fresh context per retry, exponential backoff
  - SQL: Reversible migrations, indexes on key columns
  - Logs: JSON format with structured fields

### **Task Priorities**
- **[tasks.md](./tasks.md)** - Development roadmap
  - Comprehensive scraper + job queue
  - Idempotent scheduler
  - Winner loop (remix high-performing content)
  - Auto-pause on low engagement
  - Similarity guard

---

## 🔧 Infrastructure Documentation

### **Deployment & Operations**
- **[OPERATIONS.md](./OPERATIONS.md)** - Production operations guide
- **[PROD_DEPLOY.md](./PROD_DEPLOY.md)** - Deployment procedures
- **[runbook.md](./runbook.md)** - Incident response runbook

### **System Health**
- **[JOB_SCHEDULE_ANALYSIS.md](./JOB_SCHEDULE_ANALYSIS.md)** - Job scheduling analysis
- **[RESOURCE_IMPACT_ANALYSIS.md](./RESOURCE_IMPACT_ANALYSIS.md)** - Resource usage analysis

### **Browser Automation**
- **[playwright-stability-guide.md](./playwright-stability-guide.md)** - Playwright best practices
- **[browser-stability.md](./browser-stability.md)** - Browser stability patterns

### **Budget & Cost**
- **[budget.md](./budget.md)** - OpenAI API budget tracking
- **[budget-guard.md](./budget-guard.md)** - Budget protection mechanisms

---

## 🎯 System-Specific Guides

### **Visual Intelligence (VI) System**
- **[VI_DATA_REFERENCE.md](./VI_DATA_REFERENCE.md)** - Complete VI reference
- **[VI_INTEGRATION_GUIDE.md](./VI_INTEGRATION_GUIDE.md)** - Integration guide
- **[VI_INTEGRATION_SAFETY_CHECKLIST.md](./VI_INTEGRATION_SAFETY_CHECKLIST.md)** - Safety checklist
- **[VISUAL_INTELLIGENCE_SYSTEM_COMPLETE.md](./VISUAL_INTELLIGENCE_SYSTEM_COMPLETE.md)** - Implementation summary
- **[NEXT_STEPS_DEPLOY_VI.md](./NEXT_STEPS_DEPLOY_VI.md)** - Deployment steps

### **Content & Posting**
- **[POSTING_RELIABILITY_QUALITY.md](./POSTING_RELIABILITY_QUALITY.md)** - Posting system quality
- **[SOCIAL_CONTENT_OPERATOR.md](./SOCIAL_CONTENT_OPERATOR.md)** - Content strategy

### **Database**
- **[db-schema.md](./db-schema.md)** - Alternative database schema doc
- **[DATABASE_MIGRATION_CONSOLIDATION_PLAN.md](./DATABASE_MIGRATION_CONSOLIDATION_PLAN.md)** - Migration strategy

---

## 📝 Historical Documentation

### **Recent Changes**
- **[BOOTSTRAP_SUMMARY.md](./BOOTSTRAP_SUMMARY.md)** - Project context bootstrap (Nov 5)
- **[CRITICAL_FIXES_DEPLOYED.md](./CRITICAL_FIXES_DEPLOYED.md)** - Critical fixes log
- **[PHASE_1_REFACTOR_COMPLETE.md](./PHASE_1_REFACTOR_COMPLETE.md)** - Refactor summary
- **[REFACTOR_PROGRESS_SUMMARY.md](./REFACTOR_PROGRESS_SUMMARY.md)** - Refactor progress

### **Production Fixes**
- **[production-fixes-summary.md](./production-fixes-summary.md)** - Production fixes
- **[FINAL_REVIEW_BEFORE_DEPLOY.md](./FINAL_REVIEW_BEFORE_DEPLOY.md)** - Pre-deploy checklist

### **Refactoring Plans**
- **[REFACTOR_PLAN_postingQueue.md](./REFACTOR_PLAN_postingQueue.md)** - Posting queue refactor

### **Validation & Verification**
- **[VALIDATION_CHECKLIST.md](./VALIDATION_CHECKLIST.md)** - Validation checklist
- **[verification-report.md](./verification-report.md)** - Verification report

### **Deployment**
- **[ZERO_MANUAL_DEPLOYMENT.md](./ZERO_MANUAL_DEPLOYMENT.md)** - Automated deployment

---

## 🔑 Key Files in Codebase

### **Configuration**
- `src/config/env.ts` - Zod-validated environment variables
- `src/lib/logger.ts` - Structured JSON logging

### **Database**
- `src/db/index.ts` - Supabase client
- `db/migrations/000_init_core.sql` - Core schema
- `supabase/migrations/20251105_visual_intelligence_system.sql` - VI schema

### **Scrapers**
- `src/jobs/metricsScraperJob.ts` - Main metrics scraper (YOUR posts)
- `src/scrapers/bulletproofTwitterScraper.ts` - Core scraper utility
- `src/intelligence/viAccountScraper.ts` - VI scraper

### **Jobs**
- `src/jobs/jobManager.ts` - Job scheduler
- `src/jobs/planJob.ts` - Content generation
- `src/jobs/postingQueue.ts` - Posting orchestration
- `src/jobs/replyJob.ts` - Reply posting

### **CI/CD**
- `.github/workflows/ci.yml` - GitHub Actions workflow

---

## 🎓 For New Contributors

**Day 1: Understanding the System**
1. Read `context.md` - Get the big picture
2. Read `constraints.md` - Learn the rules
3. Read `DATABASE_REFERENCE.md` - Understand data flow

**Day 2: Setting Up**
1. Check `src/config/env.ts` - See required environment variables
2. Review `.github/workflows/ci.yml` - Understand CI checks
3. Read `OPERATIONS.md` - Learn deployment process

**Day 3: Common Tasks**
1. Adding a scraper? → Read `SCRAPER_DATA_FLOW_REFERENCE.md`
2. Modifying database? → Read `DATABASE_REFERENCE.md`
3. Debugging issues? → Use `TROUBLESHOOTING_QUICK_REFERENCE.md`

---

## 🚀 For AI Assistants Working on PRs

**Before making changes:**
1. ✅ Read `TROUBLESHOOTING_QUICK_REFERENCE.md` - Understand common issues
2. ✅ Read `DATABASE_REFERENCE.md` - Know which tables exist
3. ✅ Read `SCRAPER_DATA_FLOW_REFERENCE.md` - Understand scraper ecosystem

**When adding features:**
1. ✅ Update relevant docs (DATABASE_REFERENCE.md, SCRAPER_DATA_FLOW_REFERENCE.md)
2. ✅ Follow `constraints.md` (Zod env, structured logging, reversible migrations)
3. ✅ Add troubleshooting section to TROUBLESHOOTING_QUICK_REFERENCE.md

**When fixing bugs:**
1. ✅ Document the fix in SCRAPER_DATA_FLOW_REFERENCE.md (if scraper-related)
2. ✅ Update status in relevant reference docs
3. ✅ Add to "Recent Fixes" section

---

## ✅ Documentation Status (Nov 5, 2025)

**Complete & Up-to-Date:**
- ✅ TROUBLESHOOTING_QUICK_REFERENCE.md (NEW - Nov 5)
- ✅ SCRAPER_DATA_FLOW_REFERENCE.md (Updated Nov 5)
- ✅ VI_DATA_REFERENCE.md (Created Nov 5)
- ✅ DATABASE_REFERENCE.md (Updated Nov 5)
- ✅ context.md (Created Nov 5)
- ✅ constraints.md (Created Nov 5)
- ✅ tasks.md (Created Nov 5)

**May Need Updates:**
- ⚠️ OPERATIONS.md (Last updated: Unknown)
- ⚠️ db-schema.md (May be outdated - use DATABASE_REFERENCE.md instead)

**Historical (For Reference Only):**
- Most files in `docs/` starting with capital letters (DEPLOYMENT_*, IMPLEMENTATION_*, etc.)
- These document specific features/fixes and may not reflect current state

---

## 🆘 Getting Help

**System broken?**
1. Check `TROUBLESHOOTING_QUICK_REFERENCE.md`
2. Search for error message in relevant reference doc
3. Check Railway logs: `railway logs | grep "ERROR"`

**Data not flowing correctly?**
1. Read `SCRAPER_DATA_FLOW_REFERENCE.md`
2. Verify tables exist: `psql $DATABASE_URL -c "\dt"`
3. Check scraper status in logs

**Need to understand a table?**
1. Read `DATABASE_REFERENCE.md`
2. Search for table name
3. See "Used By" section for code references

---

**Last Updated:** November 5, 2025  
**Maintainers:** AI Assistant, User  
**Status:** ✅ Bootstrap Complete - Ready for Future PRs


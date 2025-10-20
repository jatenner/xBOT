# ⚡ **QUICK FIX FOR POSTING**

## **PROBLEM:**
Plan job configured for 12-hour interval, but hasn't run yet = no content = no posts

## **SOLUTION:**
Change to 60-minute interval (still posts 2x/day via rate limit)

```bash
# Already set to 60 minutes
JOBS_PLAN_INTERVAL_MIN=60 ✅

# Redeploy to restart job manager
git commit --allow-empty -m "Force restart job manager"
git push origin main
```

## **WHY THIS WORKS:**
- Generates 1 post every hour
- Rate limiter enforces max 2 posts/day
- More reliable than waiting 12 hours
- If one cycle fails, next cycle catches up

## **ALTERNATIVE (if urgent):**
Restart Railway service manually to force job registration:
```bash
railway restart
```

This will:
1. Kill current process
2. Restart with job manager
3. Register all jobs immediately
4. Plan job runs within 2 minutes (offset)


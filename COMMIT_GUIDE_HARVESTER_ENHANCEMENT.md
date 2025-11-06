# 🚀 Commit Guide: Reply Harvester Enhancement

## Summary
Enhanced reply harvester to target **health-focused accounts only**, eliminating off-topic viral tweets from politics, sports, and entertainment accounts that were getting zero engagement.

## Changes Made

### Core Enhancements:
1. ✅ Health account verification (name/handle keyword scoring)
2. ✅ Content relevance checking (multi-keyword density analysis)
3. ✅ Off-topic account blacklist (auto-filters politics, sports, entertainment)
4. ✅ Enhanced search queries (13 health-specific multi-keyword phrases)
5. ✅ Lowered engagement thresholds (quality health content over raw viral numbers)

### Files Modified:
- `src/ai/realTwitterDiscovery.ts` (health filtering logic)
- `src/jobs/replyOpportunityHarvester.ts` (enhanced search queries)

### Files Created:
- `scripts/test-enhanced-harvester.ts` (testing tool)
- `REPLY_HARVESTER_ENHANCEMENT_NOV_6_2025.md` (documentation)
- `COMMIT_GUIDE_HARVESTER_ENHANCEMENT.md` (this file)

## Quick Test (Optional)

Before committing, you can test locally:

```bash
# Test the enhanced harvester
npx tsx scripts/test-enhanced-harvester.ts
```

Or just commit and let it run on Railway - the changes are backwards compatible.

## Commit Commands

```bash
# Stage changes
git add src/ai/realTwitterDiscovery.ts
git add src/jobs/replyOpportunityHarvester.ts
git add scripts/test-enhanced-harvester.ts
git add REPLY_HARVESTER_ENHANCEMENT_NOV_6_2025.md
git add COMMIT_GUIDE_HARVESTER_ENHANCEMENT.md

# Commit with concise message
git commit -m "Enhance reply harvester: filter off-topic accounts, target health content"

# Push to Railway (auto-deploys)
git push origin main
```

## Post-Deploy Monitoring

After pushing, monitor for 24-48 hours:

### Check Opportunity Quality:
```bash
# SSH into Railway or run locally:
node -e "require('dotenv').config(); const { createClient } = require('@supabase/supabase-js'); const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); s.from('reply_opportunities').select('target_username, like_count, tier').eq('replied_to', false).order('like_count', {ascending: false}).limit(20).then(({data}) => {console.log('Top 20 opportunities:'); data.forEach((o, i) => console.log(\`\${i+1}. @\${o.target_username}: \${o.like_count} likes, tier=\${o.tier}\`));})"
```

### Expected Results:
- ✅ Usernames like @hubermanlab, @peterattia, @RhondaPatrick, @drmarkhyman
- ❌ NO accounts like @FCBarcelona, @TheDemocrats, @halsey, @WallStreetApes

### Track Reply Engagement:
```bash
# Check last 10 replies posted
node -e "require('dotenv').config(); const { createClient } = require('@supabase/supabase-js'); const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); s.from('content_metadata').select('target_username, actual_likes, actual_impressions').eq('decision_type', 'reply').order('posted_at', {ascending: false}).limit(10).then(({data}) => {console.log('Last 10 replies:'); data.forEach((r, i) => console.log(\`\${i+1}. @\${r.target_username}: \${r.actual_likes} likes, \${r.actual_impressions} impressions\`));})"
```

## Success Criteria

### After 24 hours:
- [ ] 90%+ opportunities are health/wellness accounts
- [ ] Average reply engagement increases 2-5x
- [ ] Zero political/sports accounts in pool

### After 48 hours:
- [ ] Follower growth from replies increases
- [ ] Reply impressions consistently 500+
- [ ] Health relevance score averaging 10+

## Rollback (if needed)

If something goes wrong:

```bash
# Revert the changes
git revert HEAD

# Push revert
git push origin main
```

---

**Ready to commit?** Run the commands above! 🚀


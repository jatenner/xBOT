#!/bin/bash

echo "========================================="
echo "  🛡️ RESILIENT REPLY SYSTEM MONITOR"
echo "========================================="
echo ""

# Check Railway deployment
echo "📦 Railway Deployment:"
railway status 2>&1 | grep -E "Status|Active" | head -3
echo ""

# Check database for reply status
echo "📊 Database Status:"
railway run node -e "
const {createClient} = require('@supabase/supabase-js');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Last posted reply
  const {data: last} = await c.from('content_metadata')
    .select('posted_at, target_username')
    .eq('decision_type', 'reply')
    .not('posted_at', 'is', null)
    .order('posted_at', {ascending: false})
    .limit(1);
  
  if (last && last[0]) {
    const mins = Math.round((Date.now() - new Date(last[0].posted_at).getTime()) / 60000);
    console.log('  ✅ Last reply:', mins, 'minutes ago to @' + last[0].target_username);
  } else {
    console.log('  ❌ No replies posted yet');
  }
  
  // Queued replies
  const {count} = await c.from('content_metadata')
    .select('*', {count: 'exact', head: true})
    .eq('decision_type', 'reply')
    .is('posted_at', null);
  
  console.log('  📋 Queued replies:', count || 0);
  
  // Strategy health (if table exists)
  try {
    const {data: health} = await c.from('reply_strategy_health')
      .select('*')
      .limit(5);
    
    if (health && health.length > 0) {
      console.log('\n  📊 Strategy Success Rates:');
      health.forEach(s => {
        console.log('    -', s.strategy_name + ':', s.success_rate + '%', '(' + s.total_attempts, 'attempts)');
      });
    }
  } catch (e) {}
})();
" 2>&1
echo ""

# Check recent logs for reply activity
echo "📋 Recent Reply Activity:"
railway logs --lines 200 2>&1 | grep -E "RESILIENT_REPLY|Strategy used|SUCCESS:|FAILED:" | tail -10
echo ""

echo "========================================="
echo "✅ Monitor complete"
echo "========================================="


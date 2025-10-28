#!/bin/bash
# Quick script to check if new reply system is working

cd /Users/jonahtenner/Desktop/xBOT

echo "===== NEW REPLY SYSTEM STATUS ====="
echo ""

echo "1. Checking opportunity pool..."
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

Promise.all([
  s.from('reply_opportunities').select('*', { count: 'exact', head: true }),
  s.from('reply_opportunities').select('like_count, reply_count, target_username').order('like_count', {ascending: false}).limit(5)
]).then(([count, top5]) => {
  console.log('  Total opportunities:', count.count || 0);
  console.log('');
  console.log('  Top 5 by likes:');
  top5.data?.forEach((o, i) => {
    console.log(\`    \${i+1}. @\${o.target_username}: \${o.like_count} likes, \${o.reply_count} comments\`);
  });
  console.log('');
  
  const maxLikes = top5.data?.[0]?.like_count || 0;
  if (maxLikes >= 5000) {
    console.log('  ✅ WORKING: Found high-engagement tweets (5K+ likes)');
  } else if (maxLikes >= 1000) {
    console.log('  ⚠️  PARTIAL: Found decent engagement (1K+ likes)');
  } else {
    console.log('  ❌ ISSUE: Only finding low engagement (<1K likes)');
  }
});
" 

echo ""
echo "2. Checking recent replies..."
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const twoHoursAgo = new Date(Date.now() - 2*60*60*1000).toISOString();

s.from('posted_decisions')
  .select('posted_at, target_username')
  .eq('decision_type', 'reply')
  .gte('posted_at', twoHoursAgo)
  .order('posted_at', {ascending: false})
  .then(({data}) => {
    console.log('  Replies in last 2 hours:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('');
      data.slice(0, 5).forEach((r, i) => {
        const minAgo = Math.floor((Date.now() - new Date(r.posted_at).getTime())/60000);
        console.log(\`    \${i+1}. \${minAgo} min ago to @\${r.target_username}\`);
      });
    }
  });
"

echo ""
echo "3. Check Railway logs for harvester activity:"
echo "   railway logs | grep TWEET_HARVESTER"
echo ""
echo "4. Look for these log messages:"
echo "   ✅ '[TWEET_HARVESTER] 🔍 Executing 7 broad multi-angle searches...'"
echo "   ✅ '[TWEET_HARVESTER] 💾 Stored XX opportunities'"
echo "   ✅ '[REPLY_JOB] 💬 Replying to tweet with XXXX likes'"
echo ""


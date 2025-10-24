#!/bin/bash

# Live monitoring of the resilient reply system
# Run this to see the system working in real-time

echo "========================================="
echo " 🛡️ RESILIENT REPLY SYSTEM - LIVE WATCH"
echo "========================================="
echo ""

echo "Press Ctrl+C to stop monitoring"
echo ""

# Function to check and display status
check_status() {
  clear
  echo "========================================="
  echo " 🛡️ REPLY SYSTEM STATUS"
  echo " $(date)"
  echo "========================================="
  echo ""
  
  # Check database
  railway run node -e "
const {createClient} = require('@supabase/supabase-js');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Last reply
  const {data: last} = await c.from('content_metadata')
    .select('posted_at, target_username, content')
    .eq('decision_type', 'reply')
    .not('posted_at', 'is', null)
    .order('posted_at', {ascending: false})
    .limit(1);
  
  console.log('📊 REPLY STATUS:');
  if (last && last[0]) {
    const mins = Math.round((Date.now() - new Date(last[0].posted_at).getTime()) / 60000);
    console.log('  Last reply:', mins, 'min ago');
    console.log('  Target: @' + last[0].target_username);
    console.log('  Content:', last[0].content.substring(0, 50) + '...');
  } else {
    console.log('  No replies posted yet');
  }
  
  // Queue
  const {count} = await c.from('content_metadata')
    .select('*', {count: 'exact', head: true})
    .eq('decision_type', 'reply')
    .is('posted_at', null);
  console.log('  Queued:', count || 0, 'replies');
  
  // Strategy health
  try {
    const {data: health} = await c.from('reply_strategy_health')
      .select('*')
      .order('success_rate', {ascending: false})
      .limit(5);
    
    if (health && health.length > 0) {
      console.log('\n📈 STRATEGY HEALTH:');
      health.forEach(s => {
        const rate = parseFloat(s.success_rate || 0);
        const emoji = rate > 80 ? '✅' : rate > 50 ? '⚠️' : '❌';
        console.log('  ' + emoji, s.strategy_name + ':', rate.toFixed(0) + '%', '(' + s.total_attempts, 'attempts)');
      });
    } else {
      console.log('\n📈 STRATEGY HEALTH: No data yet (waiting for first attempts)');
    }
  } catch (e) {
    console.log('\n📈 STRATEGY HEALTH: Table not ready yet');
  }
  
  // Recent activity
  const {data: recent} = await c.from('reply_strategy_metrics')
    .select('strategy_name, success, timestamp')
    .order('timestamp', {ascending: false})
    .limit(5);
  
  if (recent && recent.length > 0) {
    console.log('\n🕐 RECENT ACTIVITY:');
    recent.forEach(r => {
      const mins = Math.round((Date.now() - new Date(r.timestamp).getTime()) / 60000);
      const status = r.success ? '✅ SUCCESS' : '❌ FAILED';
      console.log('  ' + status, '-', r.strategy_name, '(' + mins + 'min ago)');
    });
  }
})().catch(e => console.log('Error:', e.message));
" 2>&1
  
  echo ""
  echo "🔄 Refreshing in 30 seconds..."
  echo "(Press Ctrl+C to stop)"
}

# Monitor loop
while true; do
  check_status
  sleep 30
done


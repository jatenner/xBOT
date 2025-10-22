#!/usr/bin/env node
/**
 * Manually trigger the plan job to generate content
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🎯 TRIGGERING PLAN JOB MANUALLY\n');

// This will trigger a plan job run on Railway via API
async function triggerPlanJob() {
  console.log('📡 Sending trigger request to Railway...\n');
  
  try {
    const response = await fetch(`${process.env.HEALTH_SERVER_URL || 'http://localhost:3001'}/api/admin/jobs/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY || 'dev-key'}`
      },
      body: JSON.stringify({
        jobName: 'plan'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Plan job triggered successfully!');
      console.log('📊 Result:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Failed to trigger job:', response.status, response.statusText);
      console.log('\n💡 Alternative: The plan job should run automatically every 15 minutes');
      console.log('   Check Railway logs to see if it\'s running');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 This is expected if running locally');
    console.log('   On Railway, the plan job runs automatically every 15 minutes');
  }
}

triggerPlanJob();


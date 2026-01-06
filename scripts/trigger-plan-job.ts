/**
 * 🚀 TRIGGER PLAN JOB - Generate Content Immediately
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function triggerPlanJob() {
  console.log('🚀 Triggering plan job to generate content...\n');
  
  try {
    // Import and run plan job
    const { planContent } = await import('../src/jobs/planJob');
    await planContent();
    
    console.log('✅ Plan job completed successfully!');
    console.log('💡 Content should be generated and queued now.');
    
    // Wait a moment then check queue
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: queued } = await supabase
        .from('content_metadata')
        .select('decision_id, decision_type')
        .eq('status', 'queued')
        .in('decision_type', ['single', 'thread'])
        .limit(5);
      
      console.log(`\n📊 Queue status: ${queued?.length || 0} items queued`);
      if (queued && queued.length > 0) {
        console.log('✅ Content generated successfully!');
      }
    }
    
  } catch (error: any) {
    console.error('❌ Failed to trigger plan job:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

triggerPlanJob();





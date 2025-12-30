import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function clearBlockingThread() {
  console.log('[CLEAR] Clearing blocking thread 6b63d7dd-1577-4dd6-bf02-83cd2ab91d9a\n');
  
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .update({
      status: 'failed_permanent',
      updated_at: new Date().toISOString()
    })
    .eq('decision_id', '6b63d7dd-1577-4dd6-bf02-83cd2ab91d9a');
  
  if (error) {
    console.error('❌ Failed:', error.message);
  } else {
    console.log('✅ Thread marked as failed_permanent');
    console.log('✅ Queue is now clear for new content');
    console.log('\n📊 Next: planJob will run in <30min to generate new content');
  }
}

clearBlockingThread();


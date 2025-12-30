import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function checkSchema() {
  console.log('[CHECK] Checking content_generation_metadata_comprehensive schema...\n');
  
  const supabase = getSupabaseClient();
  
  // Try to insert a minimal test record to see what columns are missing
  const testPayload = {
    decision_id: '00000000-0000-0000-0000-000000000000',
    decision_type: 'single',
    content: 'test',
    status: 'failed_permanent',
    structure_type: 'test' // This is the problematic column
  };
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .insert([testPayload])
    .select();
  
  if (error) {
    console.log('❌ Insert failed:', error.message);
    console.log('   Code:', error.code);
    console.log('   Details:', error.details);
    console.log('   Hint:', error.hint);
    
    if (error.message.includes('structure_type')) {
      console.log('\n💡 FIX: structure_type column does NOT exist in table');
      console.log('   Options:');
      console.log('   1. Remove structure_type from insert payload');
      console.log('   2. Add structure_type column to table (migration needed)');
    }
  } else {
    console.log('✅ Insert succeeded:', data);
  }
}

checkSchema();


import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkStructure() {
  const { getSupabaseClient } = await import('../src/db/index');
  const supabase = getSupabaseClient();
  
  // Check what columns job_heartbeats actually has
  const { data, error } = await supabase
    .from('job_heartbeats')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('job_heartbeats columns:', Object.keys(data[0]));
    console.log('Sample row:', data[0]);
  } else {
    console.log('No rows in job_heartbeats');
  }
  
  // Check recent plan jobs
  const { data: planJobs } = await supabase
    .from('job_heartbeats')
    .select('*')
    .eq('job_name', 'plan')
    .order('created_at', { ascending: false })
    .limit(3);
  
  console.log('\nRecent plan jobs:', planJobs);
  
  // Check recent posting jobs
  const { data: postingJobs } = await supabase
    .from('job_heartbeats')
    .select('*')
    .eq('job_name', 'posting')
    .order('created_at', { ascending: false })
    .limit(3);
  
  console.log('\nRecent posting jobs:', postingJobs);
}

checkStructure().catch(console.error);


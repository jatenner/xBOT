import { getSupabaseClient } from '../src/db';
import { getHeartbeat } from '../src/jobs/jobHeartbeat';
import { DiagnosticEngine } from '../src/diagnostics/diagnosticEngine';

async function diagnose() {
  const supabase = getSupabaseClient();
  const engine = DiagnosticEngine.getInstance();
  
  console.log('\n🔍 SYSTEM DIAGNOSIS\n');
  console.log('='.repeat(60));
  
  // Get diagnostics
  const diagnostics = await engine.runDiagnostics();
  console.log('\n📊 OVERALL STATUS:', diagnostics.overallStatus.toUpperCase());
  console.log('Timestamp:', diagnostics.timestamp);
  
  // Check each stage
  console.log('\n📋 STAGE-BY-STAGE ANALYSIS:');
  console.log('-'.repeat(60));
  
  Object.entries(diagnostics.stages).forEach(([key, stage]: [string, any]) => {
    const name = key === 'contentGeneration' ? 'Content Generation' :
                 key === 'posting' ? 'Posting' :
                 key === 'metrics' ? 'Metrics' :
                 key === 'learning' ? 'Learning' : key;
    
    console.log(`\n${name}:`);
    console.log(`  Status: ${stage.status.toUpperCase()}`);
    console.log(`  Health Score: ${Math.round(stage.healthScore)}%`);
    console.log(`  Last Run: ${stage.lastRun || 'Never'}`);
    console.log(`  Next Run: ${stage.nextRun || 'Unknown'}`);
    console.log(`  Issues: ${stage.issues.length}`);
    
    if (stage.issues.length > 0) {
      stage.issues.forEach((issue: any) => {
        console.log(`    - [${issue.type.toUpperCase()}] ${issue.message}`);
        if (issue.explanation) console.log(`      ${issue.explanation}`);
      });
    }
  });
  
  // Check job heartbeats
  console.log('\n\n⚙️ JOB HEARTBEATS:');
  console.log('-'.repeat(60));
  
  const jobs = ['plan', 'posting', 'analytics', 'metrics_scraper', 'learn', 'reply_posting'];
  for (const jobName of jobs) {
    const heartbeat = await getHeartbeat(jobName);
    if (heartbeat) {
      console.log(`\n${jobName}:`);
      console.log(`  Status: ${heartbeat.last_run_status}`);
      console.log(`  Last Success: ${heartbeat.last_success || 'Never'}`);
      console.log(`  Last Failure: ${heartbeat.last_failure || 'None'}`);
      console.log(`  Consecutive Failures: ${heartbeat.consecutive_failures || 0}`);
      if (heartbeat.last_error) {
        console.log(`  Last Error: ${heartbeat.last_error.substring(0, 200)}`);
      }
    } else {
      console.log(`\n${jobName}: No heartbeat found`);
    }
  }
  
  // Check posting attempts
  console.log('\n\n📝 POSTING ATTEMPTS (Last 24h):');
  console.log('-'.repeat(60));
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: attempts } = await supabase
    .from('posting_attempts')
    .select('status, error_message, created_at')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (attempts && attempts.length > 0) {
    const success = attempts.filter(a => a.status === 'success').length;
    const failed = attempts.filter(a => a.status === 'failed').length;
    const successRate = (success / attempts.length) * 100;
    
    console.log(`Total Attempts: ${attempts.length}`);
    console.log(`Successful: ${success} (${successRate.toFixed(1)}%)`);
    console.log(`Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\nRecent Failures:');
      attempts.filter(a => a.status === 'failed').slice(0, 5).forEach((attempt: any) => {
        console.log(`  - ${new Date(attempt.created_at).toLocaleString()}: ${attempt.error_message?.substring(0, 150) || 'No error message'}`);
      });
    }
  } else {
    console.log('No posting attempts found in last 24 hours');
  }
  
  // Check queued content
  console.log('\n\n📦 QUEUED CONTENT:');
  console.log('-'.repeat(60));
  
  const { data: queued } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, created_at, status')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log(`Queued Items: ${queued?.length || 0}`);
  if (queued && queued.length > 0) {
    const singles = queued.filter((q: any) => q.decision_type === 'single').length;
    const threads = queued.filter((q: any) => q.decision_type === 'thread').length;
    const replies = queued.filter((q: any) => q.decision_type === 'reply').length;
    console.log(`  Singles: ${singles}, Threads: ${threads}, Replies: ${replies}`);
    console.log(`Oldest Queued: ${queued[queued.length - 1]?.created_at || 'N/A'}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Diagnosis Complete\n');
  
  process.exit(0);
}

diagnose().catch(err => {
  console.error('❌ Diagnosis failed:', err);
  process.exit(1);
});

// Dry-run content planning
const log_compat = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function runDryRunPlan(limit: number = 3) {
  try {
    log_compat(`📝 DRYRUN_PLAN: Generating ${limit} dry-run content items...`);
    
    // Check if posting is disabled for safety
    const postingDisabled = process.env.POSTING_DISABLED === 'true';
    const dryRun = process.env.DRY_RUN === 'true';
    
    if (!postingDisabled || !dryRun) {
      log_compat('⚠️ DRYRUN_PLAN: WARNING - Not in safe dry-run mode');
    }
    
    // Simulate content generation
    for (let i = 1; i <= limit; i++) {
      log_compat(`📄 DRYRUN_PLAN: Planning item ${i}/${limit}...`);
      
      // Mock content item
      const mockContent = {
        id: `dry_${Date.now()}_${i}`,
        type: 'thread',
        topic: `Health Topic ${i}`,
        hook: `Did you know that health fact #${i}?`,
        content: `This is a mock thread about important health information. Thread ${i} of ${limit}.`,
        quality_score: 0.75 + (Math.random() * 0.2),
        bandit_arm: `content_arm_${i % 3}`,
        predicted_er: 0.03 + (Math.random() * 0.02)
      };
      
      log_compat(`✨ DRYRUN_PLAN: Item ${i} - ${mockContent.hook.substring(0, 50)}...`);
      log_compat(`   Quality: ${mockContent.quality_score.toFixed(3)}, Predicted ER: ${mockContent.predicted_er.toFixed(4)}`);
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    log_compat(`✅ DRYRUN_PLAN: Generated ${limit} content items successfully`);
    return true;
  } catch (error) {
    log_compat(`❌ DRYRUN_PLAN: FAIL - ${error.message}`);
    return false;
  }
}

if (require.main === module) {
  const limit = parseInt(process.argv[2]) || 3;
  
  runDryRunPlan(limit)
    .then(success => {
      log_compat(`📝 DRYRUN_PLAN: ${success ? 'COMPLETED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      log_compat(`💥 DRYRUN_PLAN: Fatal error - ${err.message}`);
      process.exit(1);
    });
}

export { runDryRunPlan };
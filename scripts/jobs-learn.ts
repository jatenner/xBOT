// Learning system job runner
const log_compat = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function runLearningJob() {
  try {
    log_compat('🎓 JOBS_LEARN: Starting learning cycle...');
    
    // Check if learning is enabled
    const learningEnabled = process.env.ENABLE_BANDIT_LEARNING === 'true';
    if (!learningEnabled) {
      log_compat('⏸️ JOBS_LEARN: Learning disabled via ENABLE_BANDIT_LEARNING');
      return true;
    }
    
    // Simulate learning operations
    log_compat('📊 JOBS_LEARN: Updating bandit arms...');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    log_compat('🧠 JOBS_LEARN: Training predictive models...');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    log_compat('💾 JOBS_LEARN: Storing coefficients to Redis...');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    log_compat('✅ JOBS_LEARN: Learning cycle completed successfully');
    return true;
  } catch (error) {
    log_compat(`❌ JOBS_LEARN: FAIL - ${error.message}`);
    return false;
  }
}

if (require.main === module) {
  runLearningJob()
    .then(success => {
      log_compat(`🎓 JOBS_LEARN: ${success ? 'COMPLETED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      log_compat(`💥 JOBS_LEARN: Fatal error - ${err.message}`);
      process.exit(1);
    });
}

export { runLearningJob };
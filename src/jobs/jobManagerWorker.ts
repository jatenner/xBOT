/**
 * 🔧 RAILWAY WORKER SERVICE
 * Dedicated worker process that ONLY runs jobManager
 * Use this if main service isn't starting jobs properly
 */

import 'dotenv/config';

async function startWorker() {
  console.log('========================================');
  console.log('RAILWAY WORKER: Starting Job Manager');
  console.log('========================================\n');
  
  // Boot logging: Railway environment info
  console.log('RAILWAY BOOT INFO:');
  console.log(`RAILWAY_GIT_COMMIT_SHA: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'NOT SET'}`);
  console.log(`RAILWAY_ENVIRONMENT_NAME: ${process.env.RAILWAY_ENVIRONMENT_NAME || 'NOT SET'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
  console.log(`JOBS_AUTOSTART env var: "${process.env.JOBS_AUTOSTART || 'NOT SET'}"`);
  const computedJobsAutostart = process.env.JOBS_AUTOSTART === 'false' 
    ? false 
    : (process.env.JOBS_AUTOSTART === 'true' || process.env.RAILWAY_ENVIRONMENT_NAME === 'production');
  console.log(`Computed JOBS_AUTOSTART: ${computedJobsAutostart}`);
  console.log(`MODE: ${process.env.MODE || 'NOT SET'}\n`);
  
  try {
    // Import and start job manager
    const { JobManager } = await import('./jobManager');
    const jobManager = JobManager.getInstance();
    
    console.log('🕒 WORKER: Calling jobManager.startJobs()...');
    await jobManager.startJobs();
    
    console.log('✅ WORKER: Job Manager started successfully');
    console.log('🕒 WORKER: Jobs are now running. Worker will stay alive to keep jobs active.');
    
    // Keep process alive
    process.on('SIGTERM', () => {
      console.log('🕒 WORKER: SIGTERM received, shutting down gracefully...');
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.log('🕒 WORKER: SIGINT received, shutting down gracefully...');
      process.exit(0);
    });
    
    // Keep alive
    setInterval(() => {
      // Heartbeat - jobs are managed by timers, this just keeps process alive
    }, 60000);
    
  } catch (error: any) {
    console.error('❌ WORKER: Failed to start job manager:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

startWorker().catch((error) => {
  console.error('❌ WORKER: Fatal error:', error);
  process.exit(1);
});


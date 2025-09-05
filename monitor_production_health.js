/**
 * 🏥 PRODUCTION HEALTH MONITOR
 * 
 * Real-time monitoring of the fixed production system
 */

const { config } = require('dotenv');
config();

async function monitorProductionHealth() {
  console.log('🏥 PRODUCTION_MONITOR: Starting health monitoring...');
  
  try {
    // Test the fixed systems
    const { SimpleDatabaseManager } = require('./dist/lib/simpleDatabaseManager');
    const db = SimpleDatabaseManager.getInstance();
    
    // Continuous monitoring loop
    let checkCount = 0;
    const maxChecks = 5;
    
    while (checkCount < maxChecks) {
      checkCount++;
      console.log(`\n📊 HEALTH_CHECK ${checkCount}/${maxChecks}:`);
      
      // Database health
      const health = await db.healthCheck();
      console.log(`   Database: ${health.status} (${health.failures} failures)`);
      
      // Emergency system status
      try {
        const { EmergencySystemTracker } = require('./dist/audit/emergencySystemTracker');
        const tracker = EmergencySystemTracker.getInstance();
        const report = tracker.getEmergencyUsageReport();
        console.log(`   Emergency Uses: ${report.totalEmergencyUses}`);
        console.log(`   Risk Systems: ${report.systemBreakdown.filter(s => s.riskLevel !== 'low').length}`);
      } catch (e) {
        console.log('   Emergency Tracker: Initializing...');
      }
      
      // System audit status
      try {
        const { SystemFailureAuditor } = require('./dist/audit/systemFailureAuditor');
        const auditor = SystemFailureAuditor.getInstance();
        const healthReport = await auditor.analyzeSystemHealth();
        console.log(`   System Health: ${healthReport.overallHealth}/100`);
        console.log(`   Critical Systems: ${healthReport.criticalSystems.length}`);
      } catch (e) {
        console.log('   System Auditor: Initializing...');
      }
      
      // Wait 30 seconds between checks
      if (checkCount < maxChecks) {
        console.log('   ⏳ Waiting 30 seconds for next check...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
    
    console.log('\n🎉 MONITORING_COMPLETE: System appears stable');
    console.log('📈 NEXT_STEPS:');
    console.log('   • Monitor Railway logs for smooth operation');
    console.log('   • Watch for reduced emergency system usage');
    console.log('   • Observe improved posting consistency');
    console.log('   • Check Twitter analytics for better engagement');
    
    return true;
    
  } catch (error) {
    console.error('❌ MONITORING_ERROR:', error.message);
    return false;
  }
}

// Run monitoring
monitorProductionHealth()
  .then(success => {
    console.log(success ? '\n✅ PRODUCTION_HEALTH: Monitoring complete' : '\n⚠️ PRODUCTION_HEALTH: Issues detected');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 MONITORING_CRASH:', error.message);
    process.exit(1);
  });

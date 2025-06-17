import MasterControlDashboard from './dashboardServer';

// Create and start the master control dashboard
const dashboard = new MasterControlDashboard();

// Start on port 3001 (different from main bot health check on 3000)
dashboard.start(3001);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down Master Control Dashboard...');
  dashboard.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down Master Control Dashboard...');
  dashboard.stop();
  process.exit(0);
});

console.log('🎯 Master Control Dashboard launcher started');
console.log('📊 Access dashboard at: http://localhost:3001');
console.log('🤖 AI Assistant with OpenAI integration ready');
console.log('⚡ Real-time system monitoring active'); 
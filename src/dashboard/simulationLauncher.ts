import { TwitterSimulator } from './twitterSimulator';

const simulator = new TwitterSimulator();

console.log('🎯 === TWITTER VIRAL SIMULATION DASHBOARD ===');
console.log('🚀 Preparing for July 1st viral domination...');
console.log('📊 Real-time viral content testing and optimization');
console.log('🧠 Building the perfect god-tier strategy');
console.log('');
console.log('🔥 Features:');
console.log('  • Real-time viral content generation & testing');
console.log('  • Strategic timing simulation');
console.log('  • Template performance analytics');
console.log('  • July 1st launch projections');
console.log('  • Live optimization suggestions');
console.log('');

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down simulation dashboard...');
  simulator.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down simulation dashboard...');
  simulator.stop();
  process.exit(0);
});

// Start the simulation dashboard
simulator.start(3001); 
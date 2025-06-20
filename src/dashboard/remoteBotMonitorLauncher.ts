import { RemoteBotMonitor } from './remoteBotMonitor';
import dotenv from 'dotenv';

dotenv.config();

const monitor = new RemoteBotMonitor();

// Start the remote monitor on port 3002 (different from main dashboard)
monitor.start(3002);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Gracefully shutting down Remote Bot Monitor...');
  monitor.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  monitor.stop();
  process.exit(0);
}); 
const { exec } = require('child_process');
const os = require('os');

function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

function startShareableDashboard() {
  console.log('🌐 === SHAREABLE BOT DASHBOARD ===');
  console.log('Setting up dashboard for easy sharing...\n');

  const localIP = getLocalIPAddress();
  
  console.log('📊 DASHBOARD ACCESS URLS:');
  console.log(`🏠 Local: http://localhost:3001`);
  console.log(`🌐 Network: http://${localIP}:3001`);
  console.log('');
  
  console.log('📱 SHARE WITH OTHERS:');
  console.log(`📋 Share this URL: http://${localIP}:3001`);
  console.log('🔗 Anyone on your network can access this');
  console.log('📺 Perfect for watching your bot\'s brain on any device');
  console.log('');
  
  console.log('🎯 DASHBOARD FEATURES:');
  console.log('✅ Real-time bot brain visualization');
  console.log('✅ Live tweet generation process');
  console.log('✅ Performance metrics streaming');
  console.log('✅ Content quality monitoring');
  console.log('✅ API usage tracking');
  console.log('✅ Render bot status');
  console.log('');
  
  console.log('🔄 GIT WORKFLOW COMMANDS:');
  console.log('📥 Get latest: ./get_latest.sh');
  console.log('📤 Push changes: ./push_changes.sh "your message"');
  console.log('🚀 Quick deploy: ./quick_deploy.sh "your improvement"');
  console.log('');
  
  // Check if dashboard is running
  exec('lsof -ti:3001', (error, stdout) => {
    if (stdout.trim()) {
      console.log('✅ Dashboard is running and ready for sharing!');
      console.log('🎬 Just open the network URL on any device to watch your bot');
    } else {
      console.log('⚠️ Dashboard not detected on port 3001');
      console.log('🚀 Starting dashboard...');
      
      // Start the dashboard
      exec('node start_enhanced_dashboard.js', (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Error starting dashboard:', error.message);
        }
      });
    }
  });
  
  console.log('');
  console.log('💡 TIP: Bookmark the network URL for easy access from any device!');
}

startShareableDashboard(); 
const { spawn } = require('child_process');
const path = require('path');

console.log('📦 Applying pending Supabase migrations…');

// Use --linked flag which is the default for pushing to the linked project
const supabase = spawn('npx', ['supabase', 'db', 'push', '--linked'], {
  stdio: 'inherit',
  cwd: process.cwd()
});

supabase.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Migrations applied');
    process.exit(0);
  } else {
    console.error(`❌ Migration failed with exit code ${code}`);
    process.exit(code);
  }
});

supabase.on('error', (err) => {
  console.error('❌ Failed to start migration process:', err.message);
  process.exit(1);
}); 
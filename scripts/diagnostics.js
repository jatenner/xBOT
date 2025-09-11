// scripts/diagnostics.js - Environment diagnostics (presence only, no secrets)
const envs = [
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY', 
  'SUPABASE_URL',
  'OPENAI_API_KEY',
  'REDIS_URL',
  'DB_SSL_MODE',
  'MIGRATION_SSL_MODE',
  'ALLOW_SSL_FALLBACK',
  'NODE_ENV',
  'POSTING_DISABLED'
];

console.log('🔍 xBOT Environment Diagnostics');
console.log('=====================================');

let criticalMissing = 0;
const critical = ['DATABASE_URL', 'OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

envs.forEach(env => {
  const present = !!(process.env[env] && process.env[env].trim() !== '');
  const status = present ? '✅' : '❌';
  console.log(`${status} ${env}: ${present}`);
  
  if (critical.includes(env) && !present) {
    criticalMissing++;
  }
});

console.log('');
if (criticalMissing > 0) {
  console.log(`❌ ${criticalMissing} critical environment variables missing`);
  process.exit(1);
} else {
  console.log('✅ All critical environment variables present');
}

// Database URL parsing (host only)
if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL.replace(/^postgres:\/\//, 'http://'));
    const isPooler = url.port === '6543' && 
                    (url.hostname.includes('pooler.supabase.co') || 
                     url.hostname.includes('.pooler.') ||
                     url.hostname.startsWith('aws-'));
    
    console.log(`📊 Database Host: ${url.hostname}:${url.port}`);
    console.log(`🔗 Transaction Pooler: ${isPooler}`);
  } catch (e) {
    console.log('❌ DATABASE_URL format invalid');
  }
}

console.log('=====================================');
console.log('🎯 Diagnostics complete');
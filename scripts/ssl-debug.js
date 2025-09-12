// SSL Debug utility for Supabase Transaction Pooler connection
const tls = require('tls');

const host = 'aws-0-us-east-1.pooler.supabase.com';
const port = 6543;

console.log(`[SSL-DEBUG] Testing TLS connection to ${host}:${port}`);

const s = tls.connect({ 
  host, 
  port, 
  servername: host, 
  rejectUnauthorized: true 
}, () => {
  const cert = s.getPeerCertificate(true);
  console.log('[SSL-DEBUG] authorized:', s.authorized);
  console.log('[SSL-DEBUG] subject:', cert.subject);
  console.log('[SSL-DEBUG] issuer:', cert.issuer);
  console.log('[SSL-DEBUG] valid_from:', cert.valid_from);
  console.log('[SSL-DEBUG] valid_to:', cert.valid_to);
  console.log('[SSL-DEBUG] SUCCESS: TLS connection established with verified certificate');
  s.end();
  process.exit(0);
});

s.on('error', (e) => { 
  console.error('[SSL-DEBUG] ERROR:', e.message); 
  console.error('[SSL-DEBUG] FAILURE: TLS connection failed');
  process.exit(1); 
});

s.on('timeout', () => {
  console.error('[SSL-DEBUG] TIMEOUT: Connection timed out');
  s.destroy();
  process.exit(1);
});

// Set timeout
s.setTimeout(10000);

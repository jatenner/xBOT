const https = require('https');

// Try to trigger an action that requires browser
https.get('https://xbot-production-844b.up.railway.app/session', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('\n📋 SESSION INFO:');
    console.log(JSON.stringify(JSON.parse(data), null, 2));
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});

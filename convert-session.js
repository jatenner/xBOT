// Convert the backup session format to Playwright format
const fs = require('fs');

console.log('🔄 Converting session format...');

// Read the backup file (Chrome extension format)
const backupData = JSON.parse(fs.readFileSync('./data/twitter_session.json.backup', 'utf8'));

// Convert to Playwright format and duplicate for both domains
const cookies = [];

backupData.forEach(cookie => {
  const baseCookie = {
    name: cookie.name,
    value: cookie.value,
    path: cookie.path || '/',
    expires: cookie.expirationDate ? Math.floor(cookie.expirationDate) : -1,
    httpOnly: cookie.httpOnly || false,
    secure: cookie.secure || false,
    sameSite: cookie.sameSite === 'no_restriction' ? 'None' : 
              cookie.sameSite === 'unspecified' ? 'Lax' :
              cookie.sameSite === 'lax' ? 'Lax' :
              cookie.sameSite === 'strict' ? 'Strict' :
              'Lax' // Default fallback
  };
  
  // Add for original domain
  cookies.push({ ...baseCookie, domain: cookie.domain });
  
  // Also add for both .twitter.com and .x.com if it's a Twitter/X cookie
  if (cookie.domain.includes('x.com') || cookie.domain.includes('twitter.com')) {
    cookies.push({ ...baseCookie, domain: '.twitter.com' });
    cookies.push({ ...baseCookie, domain: '.x.com' });
  }
});

// Remove duplicates
const uniqueCookies = cookies.filter((cookie, index, self) => 
  index === self.findIndex(c => 
    c.name === cookie.name && 
    c.domain === cookie.domain && 
    c.path === cookie.path
  )
);

const playwrightFormat = {
  cookies: uniqueCookies,
  origins: []
};

// Check for auth_token
const authToken = playwrightFormat.cookies.find(c => c.name === 'auth_token');
console.log(`✅ Found ${playwrightFormat.cookies.length} cookies`);
console.log(`🔐 Auth token present: ${!!authToken}`);

if (authToken) {
  console.log(`🎯 Auth token domain: ${authToken.domain}`);
  console.log(`🔒 Auth token httpOnly: ${authToken.httpOnly}`);
}

// Save converted format
fs.writeFileSync('./data/twitter_session.json', JSON.stringify(playwrightFormat, null, 2));
console.log('💾 Converted session saved to twitter_session.json');

// Create base64 version
const b64 = Buffer.from(JSON.stringify(playwrightFormat)).toString('base64');
console.log('');
console.log('🔐 Base64 for environment variable:');
console.log(b64.substring(0, 100) + '...');

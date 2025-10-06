// Add domain duplication to the current session
const fs = require('fs');

console.log('🔄 Adding domain duplication to session...');

const session = JSON.parse(fs.readFileSync('./data/twitter_session.json', 'utf8'));
const originalCount = session.cookies.length;

// Duplicate cookies for both domains
const newCookies = [];
session.cookies.forEach(cookie => {
  // Add original cookie
  newCookies.push(cookie);
  
  // If it's an x.com cookie, also add for twitter.com
  if (cookie.domain === '.x.com' || cookie.domain === 'x.com') {
    newCookies.push({
      ...cookie,
      domain: '.twitter.com'
    });
  }
  // If it's a twitter.com cookie, also add for x.com  
  else if (cookie.domain === '.twitter.com' || cookie.domain === 'twitter.com') {
    newCookies.push({
      ...cookie,
      domain: '.x.com'
    });
  }
});

// Remove duplicates
const uniqueCookies = newCookies.filter((cookie, index, self) => 
  index === self.findIndex(c => 
    c.name === cookie.name && 
    c.domain === cookie.domain && 
    c.path === cookie.path
  )
);

session.cookies = uniqueCookies;

// Save updated session
fs.writeFileSync('./data/twitter_session.json', JSON.stringify(session, null, 2));

console.log(`✅ Updated session: ${originalCount} → ${uniqueCookies.length} cookies`);

// Check auth tokens for both domains
const authTokens = uniqueCookies.filter(c => c.name === 'auth_token');
console.log(`🔐 Auth tokens: ${authTokens.length} (domains: ${authTokens.map(t => t.domain).join(', ')})`);

const ct0Tokens = uniqueCookies.filter(c => c.name === 'ct0');
console.log(`🛡️ CSRF tokens: ${ct0Tokens.length} (domains: ${ct0Tokens.map(t => t.domain).join(', ')})`);

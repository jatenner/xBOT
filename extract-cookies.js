// Copy and paste this into browser console on twitter.com after logging in

console.log('🍪 Extracting Twitter cookies...');

// Get all cookies for twitter.com and x.com
const cookies = [];

// Extract cookies from current domain
document.cookie.split(';').forEach(cookie => {
  const [name, value] = cookie.trim().split('=');
  if (name && value) {
    cookies.push({
      name: name,
      value: value,
      domain: '.twitter.com',
      path: '/',
      secure: true,
      httpOnly: false
    });
    // Also add for x.com domain
    cookies.push({
      name: name,
      value: value,
      domain: '.x.com',
      path: '/',
      secure: true,
      httpOnly: false
    });
  }
});

// Create session object
const session = {
  cookies: cookies,
  origins: []
};

console.log('✅ Cookies extracted!');
console.log('📋 Copy this entire JSON object:');
console.log(JSON.stringify(session, null, 2));

// Also create base64 version
const b64 = btoa(JSON.stringify(session));
console.log('');
console.log('🔐 Base64 version (for environment variable):');
console.log(b64);

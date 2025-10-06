// Run this in the browser console while logged into Twitter
// This will extract a more complete session including storage

console.log('🔍 Extracting complete browser session...');

// Get all cookies (including httpOnly ones via document.cookie)
const cookies = [];
document.cookie.split(';').forEach(cookie => {
  const [name, value] = cookie.trim().split('=');
  if (name && value) {
    // Add for both domains
    cookies.push({
      name: name,
      value: value,
      domain: '.twitter.com',
      path: '/',
      secure: true,
      httpOnly: false
    });
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

// Get localStorage
const localStorage_data = {};
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  localStorage_data[key] = localStorage.getItem(key);
}

// Get sessionStorage  
const sessionStorage_data = {};
for (let i = 0; i < sessionStorage.length; i++) {
  const key = sessionStorage.key(i);
  sessionStorage_data[key] = sessionStorage.getItem(key);
}

// Create complete session
const session = {
  cookies: cookies,
  origins: [
    {
      origin: 'https://twitter.com',
      localStorage: localStorage_data
    },
    {
      origin: 'https://x.com', 
      localStorage: localStorage_data
    }
  ]
};

console.log('✅ Complete session extracted!');
console.log(`📊 Found ${cookies.length} cookies, ${Object.keys(localStorage_data).length} localStorage items`);
console.log('📋 Copy this JSON:');
console.log(JSON.stringify(session, null, 2));

// Also show base64
const b64 = btoa(JSON.stringify(session));
console.log('');
console.log('🔐 Base64 version:');
console.log(b64);

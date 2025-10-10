// ULTIMATE X.COM SESSION EXTRACTOR - Gets ALL cookies including httpOnly
// This method uses the Application tab in DevTools instead of Console

console.log('🔥 X.COM COMPLETE SESSION EXTRACTOR');
console.log('===================================');
console.log('');
console.log('⚠️  IMPORTANT: This script needs to be run differently!');
console.log('');
console.log('📋 FOLLOW THESE STEPS EXACTLY:');
console.log('==============================');
console.log('');
console.log('1. Make sure you are on https://x.com/home and logged in');
console.log('2. Open DevTools (F12 or Cmd+Option+I)');
console.log('3. Go to the APPLICATION tab (not Console!)');
console.log('4. In the left sidebar, expand "Cookies"');
console.log('5. Click on "https://x.com"');
console.log('6. You will see ALL cookies including httpOnly ones');
console.log('7. Run this script in the CONSOLE tab while viewing cookies');
console.log('');
console.log('🔍 Looking for these critical cookies in the Application tab:');
console.log('- auth_token (httpOnly: true) - MOST IMPORTANT');
console.log('- ct0 (httpOnly: false)');
console.log('- twid (httpOnly: false)');
console.log('- kdt (httpOnly: true)');
console.log('- _twitter_sess (httpOnly: true)');
console.log('');
console.log('If you can see auth_token in the Application > Cookies > https://x.com');
console.log('then copy ALL the cookie data manually or use the export method below.');
console.log('');

// Alternative method using Chrome DevTools Protocol (if available)
if (window.chrome && window.chrome.runtime) {
  console.log('🚀 Attempting advanced cookie extraction...');
  
  // Try to get cookies via Chrome extension API (won't work in normal console)
  try {
    chrome.cookies.getAll({domain: '.x.com'}, function(cookies) {
      console.log('✅ Got cookies via Chrome API:', cookies.length);
      
      const sessionCookies = [];
      cookies.forEach(cookie => {
        // Add for .x.com
        sessionCookies.push({
          name: cookie.name,
          value: cookie.value,
          domain: '.x.com',
          path: cookie.path || '/',
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite || 'None'
        });
        
        // Add for .twitter.com (compatibility)
        sessionCookies.push({
          name: cookie.name,
          value: cookie.value,
          domain: '.twitter.com',
          path: cookie.path || '/',
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite || 'None'
        });
      });
      
      const session = {
        cookies: sessionCookies,
        origins: [],
        extractedFrom: 'x.com-chrome-api',
        extractedAt: new Date().toISOString()
      };
      
      console.log('📋 COMPLETE SESSION (with httpOnly cookies):');
      console.log(JSON.stringify(session, null, 2));
      
      // Download
      const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'x_com_complete_session.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('💾 Complete session downloaded!');
    });
  } catch (e) {
    console.log('❌ Chrome API not available');
  }
} else {
  console.log('❌ Chrome extension API not available in regular console');
}

console.log('');
console.log('🛠️ MANUAL EXTRACTION METHOD:');
console.log('=============================');
console.log('');
console.log('Since httpOnly cookies cannot be accessed via JavaScript,');
console.log('you need to manually copy them from DevTools:');
console.log('');
console.log('1. Go to Application > Cookies > https://x.com');
console.log('2. Find the auth_token cookie');
console.log('3. Copy its value');
console.log('4. Also copy ct0, twid, kdt, _twitter_sess values');
console.log('5. Use the manual session builder below');
console.log('');

// Manual session builder
window.buildXSession = function(authToken, ct0, twid, kdt, twitterSess) {
  console.log('🔧 Building X.com session manually...');
  
  if (!authToken) {
    console.error('❌ auth_token is required!');
    return;
  }
  
  const manualCookies = [
    // Critical httpOnly cookies
    {
      name: 'auth_token',
      value: authToken,
      domain: '.x.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None'
    },
    {
      name: 'auth_token',
      value: authToken,
      domain: '.twitter.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None'
    }
  ];
  
  // Add other cookies if provided
  if (ct0) {
    manualCookies.push(
      {
        name: 'ct0',
        value: ct0,
        domain: '.x.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax'
      },
      {
        name: 'ct0',
        value: ct0,
        domain: '.twitter.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax'
      }
    );
  }
  
  if (twid) {
    manualCookies.push(
      {
        name: 'twid',
        value: twid,
        domain: '.x.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'None'
      },
      {
        name: 'twid',
        value: twid,
        domain: '.twitter.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'None'
      }
    );
  }
  
  if (kdt) {
    manualCookies.push(
      {
        name: 'kdt',
        value: kdt,
        domain: '.x.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'None'
      },
      {
        name: 'kdt',
        value: kdt,
        domain: '.twitter.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'None'
      }
    );
  }
  
  if (twitterSess) {
    manualCookies.push(
      {
        name: '_twitter_sess',
        value: twitterSess,
        domain: '.x.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax'
      },
      {
        name: '_twitter_sess',
        value: twitterSess,
        domain: '.twitter.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax'
      }
    );
  }
  
  // Add all non-httpOnly cookies from document.cookie
  const browserCookies = document.cookie.split(';').map(cookie => {
    const [name, ...valueParts] = cookie.trim().split('=');
    const value = valueParts.join('=');
    return { name: name.trim(), value };
  }).filter(cookie => cookie.name && cookie.value);
  
  browserCookies.forEach(({ name, value }) => {
    // Skip if we already added it manually
    if (['auth_token', 'ct0', 'twid', 'kdt', '_twitter_sess'].includes(name)) {
      return;
    }
    
    manualCookies.push(
      {
        name,
        value,
        domain: '.x.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'None'
      },
      {
        name,
        value,
        domain: '.twitter.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'None'
      }
    );
  });
  
  const session = {
    cookies: manualCookies,
    origins: [],
    extractedFrom: 'x.com-manual',
    extractedAt: new Date().toISOString()
  };
  
  console.log('✅ Manual session built successfully!');
  console.log(`📊 Total cookies: ${manualCookies.length}`);
  console.log('');
  console.log('📋 COPY THIS JSON:');
  console.log('==================');
  console.log(JSON.stringify(session, null, 2));
  
  // Download
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'x_com_manual_session.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('💾 Manual session downloaded!');
  
  return session;
};

console.log('');
console.log('🔧 TO USE MANUAL BUILDER:');
console.log('========================');
console.log('');
console.log('1. Copy the auth_token value from Application > Cookies');
console.log('2. Copy other cookie values (ct0, twid, etc.)');
console.log('3. Run this command in console:');
console.log('');
console.log('buildXSession("YOUR_AUTH_TOKEN", "YOUR_CT0", "YOUR_TWID", "YOUR_KDT", "YOUR_TWITTER_SESS")');
console.log('');
console.log('Example:');
console.log('buildXSession("abc123...", "def456...", "u=123...", "xyz789...", "sess123...")');
console.log('');
console.log('⚠️  Only auth_token is required, others are optional but recommended');


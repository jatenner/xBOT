# Manual Cookie Extraction Instructions

Since CDP isn't accessible and persistent context isn't getting cookies, please extract cookies manually:

## Steps:

1. **Open Chrome DevTools** (F12 or Cmd+Option+I)

2. **Go to Application tab** → **Cookies** → **https://x.com**

3. **Copy these cookie values:**
   - `auth_token` (value)
   - `ct0` (value)

4. **Run this command** (replace VALUES):
```bash
cd /Users/jonahtenner/Desktop/xBOT
cat > twitter_session.json << 'EOF'
{
  "cookies": [
    {
      "name": "auth_token",
      "value": "PASTE_AUTH_TOKEN_VALUE_HERE",
      "domain": ".x.com",
      "path": "/",
      "expires": -1,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    },
    {
      "name": "ct0",
      "value": "PASTE_CT0_VALUE_HERE",
      "domain": ".x.com",
      "path": "/",
      "expires": -1,
      "httpOnly": false,
      "secure": true,
      "sameSite": "Lax"
    }
  ]
}
EOF
```

5. **Then push to Railway:**
```bash
RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json pnpm exec tsx scripts/ops/push-twitter-session-to-railway.ts
```

## Alternative: Use Browser Console

In Chrome DevTools Console (on x.com/home), run:
```javascript
copy(JSON.stringify({
  cookies: document.cookie.split('; ').map(c => {
    const [name, ...v] = c.split('=');
    return { name, value: v.join('='), domain: '.x.com', path: '/', expires: -1, httpOnly: false, secure: true, sameSite: 'Lax' };
  }).filter(c => ['auth_token', 'ct0'].includes(c.name))
}))
```

Then paste the result into `twitter_session.json` (but note: this won't get httpOnly cookies like auth_token).

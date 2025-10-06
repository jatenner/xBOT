#!/bin/bash

echo "🎯 MANUAL X.COM COOKIE EXTRACTION"
echo "================================="
echo ""
echo "The auth_token is httpOnly and cannot be accessed via document.cookie"
echo "We need to extract it manually from Chrome DevTools"
echo ""

cat << 'EOF'
📋 STEP-BY-STEP MANUAL EXTRACTION:
=================================

1. 🌐 Open Chrome and go to: https://x.com/home
   Make sure you're logged in and can see your timeline

2. 🛠️ Press F12 (or Cmd+Option+I) to open Developer Tools

3. 📱 Click the "Application" tab (not Console!)

4. 🍪 In the left sidebar, expand "Cookies"

5. 🔍 Click on "https://x.com"

6. 📋 You'll see ALL cookies including httpOnly ones. Look for:
   ✅ auth_token (httpOnly: ✓) - MOST IMPORTANT
   ✅ ct0 (httpOnly: ✗) 
   ✅ twid (httpOnly: ✗)
   ✅ kdt (httpOnly: ✓)
   ✅ _twitter_sess (httpOnly: ✓)

7. 📝 Copy the VALUES of these cookies (double-click to select)

8. 💻 Go to the "Console" tab and paste this script:

EOF

echo "// Manual Cookie Extractor Script"
cat manual-cookie-extractor.js

cat << 'EOF'

9. ⚡ After pasting the script, use the buildXSession function:

   buildXSession("YOUR_AUTH_TOKEN_VALUE", "YOUR_CT0_VALUE", "YOUR_TWID_VALUE")

   Example:
   buildXSession("c5fc132aa802f3a31f4b8c59c78fc4d10ae128a6", "483ae404cd7e1e9a02c7807b736f1c79...", "u=1932615318519808000")

10. 📥 The script will download "x_com_manual_session.json"

11. 📁 Move it to replace your current session:

EOF

echo "    mv ~/Downloads/x_com_manual_session.json $(pwd)/data/twitter_session.json"

cat << 'EOF'

💡 WHY THIS WORKS:
=================
- auth_token is httpOnly (can't access via JavaScript)
- We manually copy it from DevTools Application tab
- Then build a complete session with all cookies
- This bypasses the httpOnly restriction

⚠️ CRITICAL:
- The auth_token is the most important cookie
- Without it, authentication will fail
- Make sure to copy the FULL value (it's long!)

EOF

read -p "Press ENTER when you've completed the manual extraction and moved the file..."

# Test the manually extracted session
if [ -f "$(pwd)/data/twitter_session.json" ]; then
    echo ""
    echo "✅ Session file found! Testing manual extraction..."
    
    # Check for auth_token
    if grep -q "auth_token" "$(pwd)/data/twitter_session.json"; then
        echo "✅ auth_token found in session file"
        
        # Show first few characters for verification
        AUTH_TOKEN=$(grep -o '"auth_token"[^"]*"[^"]*"[^"]*"[^"]*"' "$(pwd)/data/twitter_session.json" | head -1 | sed 's/.*"value": *"\([^"]*\)".*/\1/')
        echo "🔍 auth_token preview: ${AUTH_TOKEN:0:20}..."
        
    else
        echo "❌ auth_token missing - please re-extract manually"
        exit 1
    fi
    
    # Kill any existing server
    pkill -f "local-browser-server" 2>/dev/null
    sleep 2
    
    # Start server in background
    echo "🚀 Starting local browser server..."
    BROWSER_SERVER_SECRET='8fb0dc0141971d595008e7d9adad54029941f455fdf510099838d1f39edc47c3' node local-browser-server.js &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Test posting with manual session
    echo "📝 Testing X.com posting with manual session..."
    RESULT=$(curl -s -X POST "http://localhost:3100/post" \
         -H "Content-Type: application/json" \
         -H "x-browser-secret: 8fb0dc0141971d595008e7d9adad54029941f455fdf510099838d1f39edc47c3" \
         -d '{"text": "🎉 ULTIMATE SUCCESS! xBOT with manually extracted X.com session! 🚀🤖 #ManualWin"}')
    
    echo "$RESULT" | jq .
    
    # Check if successful
    if echo "$RESULT" | jq -e '.success == true' > /dev/null 2>&1; then
        echo ""
        echo "🎉🎉🎉 ULTIMATE SUCCESS! 🎉🎉🎉"
        echo "================================"
        echo "✅ Manual cookie extraction worked!"
        echo "✅ auth_token successfully captured!"
        echo "✅ X.com authentication working!"
        echo "✅ xBOT posting system functional!"
        echo ""
        echo "🚀 Your hybrid xBOT system is LIVE!"
        echo "💪 Manual extraction = 100% success rate!"
        
    else
        echo ""
        echo "❌ Still having issues. Let's debug..."
        
        # More detailed debugging
        echo "🔍 Session file analysis:"
        echo "📊 File size: $(wc -c < "$(pwd)/data/twitter_session.json") bytes"
        echo "🍪 Cookie count: $(grep -o '"name":' "$(pwd)/data/twitter_session.json" | wc -l)"
        
        # Check for specific cookies
        for cookie in "auth_token" "ct0" "twid" "kdt"; do
            if grep -q "\"$cookie\"" "$(pwd)/data/twitter_session.json"; then
                echo "✅ $cookie: found"
            else
                echo "❌ $cookie: missing"
            fi
        done
        
        echo ""
        echo "💡 If any cookies are missing, please re-extract them manually"
    fi
    
    # Clean up
    kill $SERVER_PID 2>/dev/null
    
else
    echo ""
    echo "❌ Session file not found. Please:"
    echo "1. Follow the manual extraction steps above"
    echo "2. Use buildXSession() in the console"
    echo "3. Download the session file"
    echo "4. Move it to: $(pwd)/data/twitter_session.json"
    echo "5. Run this script again"
fi

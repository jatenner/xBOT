#!/bin/bash

echo "🔧 FINAL RAILWAY CLI FIX"
echo "======================="
echo ""
echo "✅ Installed Railway CLI v4.10.0 (latest)"
echo ""
echo "🔑 The tokens you created are PROJECT tokens, not PERSONAL API tokens."
echo ""
echo "Railway CLI needs browser-based OAuth authentication."
echo ""
echo "📋 STEPS:"
echo "1. I'll run: /usr/local/bin/railway login"
echo "2. Your browser will open"
echo "3. Click 'Authorize' in the browser"
echo "4. Return to terminal - it will be authenticated!"
echo ""
read -p "Press ENTER to start browser login..." 

/usr/local/bin/railway login

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Authentication successful!"
    echo ""
    echo "Now linking to your xBOT project..."
    /usr/local/bin/railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1
    
    echo ""
    echo "🧪 Testing CLI..."
    /usr/local/bin/railway whoami
    /usr/local/bin/railway status
    
    echo ""
    echo "🎉 RAILWAY CLI IS NOW FULLY OPERATIONAL!"
    echo ""
    echo "Available commands:"
    echo "  /usr/local/bin/railway logs"
    echo "  /usr/local/bin/railway variables"
    echo "  /usr/local/bin/railway status"
    echo ""
    echo "💡 To use 'railway' without full path:"
    echo "  export PATH=\"/usr/local/bin:\$PATH\""
else
    echo ""
    echo "❌ Authentication failed"
    echo ""
    echo "Alternative: Use Railway web dashboard to manage variables"
fi


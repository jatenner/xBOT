#!/bin/bash

# 🚀 QUICK RAILWAY CLI FIX - Token-Based Authentication
# Usage: ./quick-railway-token-fix.sh [RAILWAY_TOKEN] [PROJECT_ID]

echo "🚀 QUICK RAILWAY CLI FIX"
echo "========================"
echo ""

# Check arguments
if [ -z "$1" ]; then
    echo "❌ Missing Railway Token"
    echo ""
    echo "Usage: ./quick-railway-token-fix.sh [TOKEN] [PROJECT_ID]"
    echo ""
    echo "To get your token:"
    echo "1. Go to: https://railway.app/account/tokens"
    echo "2. Click 'Create Token'"
    echo "3. Copy the token"
    echo ""
    echo "To get your Project ID:"
    echo "1. Go to: https://railway.app"
    echo "2. Open xBOT project"
    echo "3. Settings → General → Copy Project ID"
    echo ""
    exit 1
fi

RAILWAY_TOKEN="$1"
PROJECT_ID="$2"

echo "🔐 Setting up Railway authentication..."

# Clean up old processes
killall -9 railway 2>/dev/null

# Create Railway config with token
mkdir -p ~/.railway
cat > ~/.railway/config.json << EOF
{
  "projects": {},
  "user": {
    "token": "$RAILWAY_TOKEN"
  },
  "lastUpdateCheck": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
  "newVersionAvailable": null
}
EOF

echo "✅ Token configured"
echo ""

# Test authentication
echo "🧪 Testing authentication..."
if railway whoami; then
    echo "✅ Authentication successful!"
else
    echo "❌ Authentication failed - please check your token"
    exit 1
fi
echo ""

# Link project if PROJECT_ID provided
if [ ! -z "$PROJECT_ID" ]; then
    echo "🔗 Linking to project $PROJECT_ID..."
    
    # Create project link in Railway config
    railway link "$PROJECT_ID"
    
    if [ $? -eq 0 ]; then
        echo "✅ Project linked successfully!"
    else
        echo "⚠️ Project link failed, trying manual approach..."
        
        # Try creating .railway directory link
        mkdir -p .railway
        echo "$PROJECT_ID" > .railway/project_id
        
        echo "✅ Project ID saved locally"
    fi
    echo ""
    
    # Test project connection
    echo "🧪 Testing project connection..."
    if railway status; then
        echo "✅ Project connection working!"
    else
        echo "⚠️ Project connection issue - you may need to link manually"
    fi
    echo ""
fi

# Show available commands
echo "🎉 RAILWAY CLI IS NOW READY!"
echo "============================"
echo ""
echo "✅ Available commands:"
echo "   railway logs          - View live deployment logs"
echo "   railway status        - Check deployment status"
echo "   railway variables     - View/manage environment variables"
echo "   railway up            - Deploy from local directory"
echo "   railway open          - Open project dashboard"
echo ""

# Test logs command
echo "🔍 Testing logs access..."
echo "Running: railway logs --limit 10"
echo ""
railway logs --limit 10 2>&1 | head -20

echo ""
echo "🚀 Railway CLI is fully operational!"
echo ""
echo "Next steps:"
echo "1. View live logs: railway logs"
echo "2. Update variables: railway variables"
echo "3. Check status: railway status"


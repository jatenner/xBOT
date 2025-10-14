#!/bin/bash

# 🔧 COMPLETE RAILWAY CLI FIX
# This script will completely fix and reconnect Railway CLI

echo "🔧 COMPLETE RAILWAY CLI FIX"
echo "==========================="
echo ""

# Step 1: Clean up any broken Railway processes
echo "🧹 Step 1: Cleaning up broken Railway processes..."
killall -9 railway 2>/dev/null
pkill -9 -f "railway" 2>/dev/null
echo "✅ Cleaned up processes"
echo ""

# Step 2: Check Railway CLI version
echo "📦 Step 2: Checking Railway CLI installation..."
if command -v railway &> /dev/null; then
    RAILWAY_VERSION=$(railway --version 2>&1 || echo "unknown")
    echo "✅ Railway CLI installed: $RAILWAY_VERSION"
else
    echo "❌ Railway CLI not found!"
    echo "Installing Railway CLI..."
    
    # Install Railway CLI
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install railway
        else
            bash <(curl -fsSL cli.new/railway/install.sh)
        fi
    else
        # Linux
        bash <(curl -fsSL cli.new/railway/install.sh)
    fi
    
    echo "✅ Railway CLI installed"
fi
echo ""

# Step 3: Remove corrupted Railway config
echo "🗑️  Step 3: Removing corrupted Railway configuration..."
if [ -d ~/.railway ]; then
    echo "Found existing Railway config at ~/.railway"
    echo "Backing up to ~/.railway.backup..."
    mv ~/.railway ~/.railway.backup 2>/dev/null
    echo "✅ Old config backed up"
fi
echo ""

# Step 4: Test Railway authentication
echo "🔐 Step 4: Testing Railway authentication..."
echo ""
echo "We need to authenticate with Railway."
echo "This will open in your browser."
echo ""
read -p "Press ENTER to start Railway login..." 

# Try standard login (with browser)
railway login

# Check if login succeeded
if railway whoami &> /dev/null; then
    echo ""
    echo "✅ Railway authentication successful!"
    railway whoami
else
    echo ""
    echo "❌ Authentication failed"
    echo ""
    echo "Let's try the token-based approach instead..."
    echo ""
    echo "Please get your Railway token:"
    echo "1. Go to: https://railway.app/account/tokens"
    echo "2. Click 'Create Token'"
    echo "3. Copy the token"
    echo "4. Paste it below:"
    echo ""
    read -p "Railway Token: " RAILWAY_TOKEN
    
    if [ ! -z "$RAILWAY_TOKEN" ]; then
        # Save token to Railway config
        mkdir -p ~/.railway
        cat > ~/.railway/config.json << EOF
{
  "projects": {},
  "user": {
    "token": "$RAILWAY_TOKEN"
  }
}
EOF
        echo "✅ Token saved"
    fi
fi
echo ""

# Step 5: Link to xBOT project
echo "🔗 Step 5: Linking to xBOT project..."
echo ""
echo "We need your Railway Project ID."
echo ""
echo "To find it:"
echo "1. Go to: https://railway.app"
echo "2. Open your xBOT project"
echo "3. Go to Settings → General"
echo "4. Copy the Project ID (looks like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
echo ""
read -p "Project ID: " PROJECT_ID

if [ ! -z "$PROJECT_ID" ]; then
    echo ""
    echo "Linking to project $PROJECT_ID..."
    railway link $PROJECT_ID
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully linked to project!"
    else
        echo "❌ Failed to link project"
        echo ""
        echo "Manual linking:"
        echo "1. Run: cd $(pwd)"
        echo "2. Run: railway link"
        echo "3. Select your xBOT project from the list"
    fi
fi
echo ""

# Step 6: Test connection
echo "🧪 Step 6: Testing Railway CLI connection..."
echo ""

echo "Testing 'railway whoami'..."
if railway whoami; then
    echo "✅ Authentication works!"
else
    echo "❌ Authentication test failed"
fi
echo ""

echo "Testing 'railway status'..."
if railway status; then
    echo "✅ Project connection works!"
else
    echo "❌ Project connection test failed"
fi
echo ""

echo "Testing 'railway variables'..."
if railway variables; then
    echo "✅ Can access variables!"
else
    echo "❌ Cannot access variables"
fi
echo ""

# Step 7: Summary
echo "📊 RAILWAY CLI FIX COMPLETE!"
echo "============================"
echo ""

if railway whoami &> /dev/null && railway status &> /dev/null; then
    echo "🎉 SUCCESS! Railway CLI is fully functional!"
    echo ""
    echo "✅ Available commands:"
    echo "   • railway logs          - View live logs"
    echo "   • railway status        - Check deployment status"
    echo "   • railway variables     - View/manage environment variables"
    echo "   • railway up            - Deploy from local"
    echo "   • railway open          - Open project in browser"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Update variables: railway variables"
    echo "   2. View logs: railway logs"
    echo "   3. Monitor status: railway status"
else
    echo "⚠️ Railway CLI partially working"
    echo ""
    echo "If issues persist, try:"
    echo "   1. Reinstall Railway CLI"
    echo "   2. Use token-based authentication"
    echo "   3. Check Railway dashboard for project status"
fi
echo ""


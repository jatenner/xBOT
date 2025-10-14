#!/bin/bash

# 🔄 RAILWAY CONTROL MONITOR
# Automatically restores Railway CLI access when rate limit clears

echo "🔄 RAILWAY CONTROL MONITOR"
echo "=========================="
echo ""

export PATH="/usr/local/bin:$PATH"

# Function to check rate limit status
check_rate_limit() {
    local result=$(railway whoami 2>&1)
    
    if echo "$result" | grep -q "ratelimited"; then
        echo "⏳ Still rate limited..."
        return 1
    elif echo "$result" | grep -q "Unauthorized"; then
        echo "✅ Rate limit cleared! Ready to authenticate."
        return 0
    else
        echo "🎉 Already authenticated!"
        railway whoami
        return 2
    fi
}

# Function to restore full control
restore_control() {
    echo ""
    echo "🚀 RESTORING FULL RAILWAY CONTROL"
    echo "================================="
    echo ""
    
    # Step 1: Authenticate
    echo "Step 1: Authenticating..."
    railway login
    
    if [ $? -eq 0 ]; then
        echo "✅ Authentication successful!"
        
        # Step 2: Link project
        echo ""
        echo "Step 2: Linking to xBOT project..."
        railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1
        
        # Step 3: Test commands
        echo ""
        echo "Step 3: Testing CLI commands..."
        echo ""
        echo "🧪 railway whoami:"
        railway whoami
        
        echo ""
        echo "🧪 railway status:"
        railway status
        
        echo ""
        echo "🧪 railway variables (first 5):"
        railway variables | head -5
        
        # Step 4: Setup git remote
        echo ""
        echo "Step 4: Setting up git deployment..."
        
        if ! git remote | grep -q "railway"; then
            git remote add railway https://railway.app/project/c987ff2e-2bc7-4c65-9187-11c1a82d4ac1
            echo "✅ Railway git remote added"
        else
            echo "✅ Railway git remote already exists"
        fi
        
        # Step 5: Success summary
        echo ""
        echo "🎉 FULL RAILWAY CONTROL RESTORED!"
        echo "================================="
        echo ""
        echo "✅ Available commands:"
        echo "   railway logs          # View live logs"
        echo "   railway variables     # Manage variables"
        echo "   railway status        # Check deployment"
        echo "   railway up            # Deploy local code"
        echo ""
        echo "✅ Git deployment:"
        echo "   git push origin main  # Auto-deploy via GitHub"
        echo "   git push railway main # Direct Railway deploy"
        echo ""
        echo "✅ Quick deploy test:"
        echo "   railway up --help     # See deploy options"
        echo ""
        
        return 0
    else
        echo "❌ Authentication failed"
        return 1
    fi
}

# Main monitoring loop
echo "Starting rate limit monitor..."
echo "Press Ctrl+C to stop monitoring"
echo ""

attempt=1
while true; do
    echo "🔍 Check #$attempt ($(date '+%H:%M:%S'))"
    
    check_rate_limit
    status=$?
    
    if [ $status -eq 0 ]; then
        # Rate limit cleared, try to restore control
        restore_control
        if [ $? -eq 0 ]; then
            echo ""
            echo "🚀 SUCCESS! Railway control fully restored!"
            echo ""
            echo "You can now use:"
            echo "• railway logs"
            echo "• railway up"
            echo "• git push origin main"
            echo ""
            break
        else
            echo "❌ Failed to restore control, will retry..."
        fi
    elif [ $status -eq 2 ]; then
        # Already authenticated
        echo ""
        echo "✅ Railway CLI already working!"
        echo ""
        echo "Testing commands..."
        railway status
        echo ""
        echo "🎉 You have full Railway control!"
        break
    fi
    
    # Wait before next check
    echo "   Waiting 2 minutes before next check..."
    echo ""
    sleep 120
    
    attempt=$((attempt + 1))
    
    # Safety limit
    if [ $attempt -gt 30 ]; then
        echo "⚠️ Reached maximum attempts. Rate limit may be longer than expected."
        echo "Try running this script again later, or use Railway web dashboard."
        break
    fi
done

echo ""
echo "Monitor stopped. Railway CLI status:"
railway whoami 2>&1 | head -1

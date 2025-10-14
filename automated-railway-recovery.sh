#!/bin/bash

# 🔄 AUTOMATED RAILWAY RECOVERY MONITOR
# Continuously monitors rate limit and automatically restores full Railway control

echo "🔄 AUTOMATED RAILWAY RECOVERY MONITOR"
echo "====================================="
echo ""
echo "This will monitor Railway rate limit and automatically restore full control."
echo "Press Ctrl+C to stop monitoring."
echo ""

export PATH="/usr/local/bin:$PATH"

# Configuration
CHECK_INTERVAL=300  # 5 minutes
MAX_ATTEMPTS=24     # 2 hours total
PROJECT_ID="c987ff2e-2bc7-4c65-9187-11c1a82d4ac1"

attempt=1
start_time=$(date)

echo "📊 MONITORING CONFIGURATION:"
echo "=============================="
echo "Check interval: $CHECK_INTERVAL seconds (5 minutes)"
echo "Maximum attempts: $MAX_ATTEMPTS (2 hours)"
echo "Project ID: $PROJECT_ID"
echo "Started: $start_time"
echo ""

# Function to check authentication status
check_auth_status() {
    local result=$(railway whoami 2>&1)
    
    if echo "$result" | grep -q "being ratelimited"; then
        echo "⏳ Rate limited"
        return 1
    elif echo "$result" | grep -q "Unauthorized"; then
        echo "✅ Rate limit cleared - ready to authenticate"
        return 0
    elif echo "$result" | grep -q "@"; then
        echo "🎉 Already authenticated: $result"
        return 2
    else
        echo "❓ Unknown status: $result"
        return 3
    fi
}

# Function to attempt full recovery
attempt_recovery() {
    echo ""
    echo "🚀 ATTEMPTING FULL RAILWAY RECOVERY"
    echo "==================================="
    echo ""
    
    # Step 1: Clean slate
    echo "Step 1: Cleaning authentication state..."
    rm -rf ~/.railway
    
    # Step 2: Authenticate
    echo "Step 2: Attempting authentication..."
    if railway login --browserless; then
        echo "✅ Browserless authentication initiated"
        echo "⚠️  Please complete authentication in browser and press ENTER"
        read -p "Press ENTER after completing browser authentication..."
        
        # Verify authentication worked
        local auth_result=$(railway whoami 2>&1)
        if echo "$auth_result" | grep -q "@"; then
            echo "✅ Authentication successful: $auth_result"
        else
            echo "❌ Authentication verification failed: $auth_result"
            return 1
        fi
    else
        echo "❌ Browserless authentication failed, trying regular login..."
        if railway login; then
            echo "✅ Browser authentication successful"
        else
            echo "❌ All authentication methods failed"
            return 1
        fi
    fi
    
    # Step 3: Link project
    echo ""
    echo "Step 3: Linking to xBOT project..."
    if railway link --project "$PROJECT_ID"; then
        echo "✅ Project linked successfully"
    else
        echo "❌ Project linking failed"
        return 1
    fi
    
    # Step 4: Verify full access
    echo ""
    echo "Step 4: Verifying full Railway access..."
    
    echo "• Testing whoami:"
    if railway whoami; then
        echo "✅ Authentication verified"
    else
        echo "❌ Authentication test failed"
        return 1
    fi
    
    echo "• Testing status:"
    if railway status; then
        echo "✅ Project status accessible"
    else
        echo "❌ Project status failed"
        return 1
    fi
    
    echo "• Testing variables:"
    if railway variables | head -3; then
        echo "✅ Variables accessible"
    else
        echo "❌ Variables access failed"
        return 1
    fi
    
    echo "• Testing logs access:"
    if railway logs --help > /dev/null 2>&1; then
        echo "✅ Logs command available"
    else
        echo "❌ Logs command failed"
        return 1
    fi
    
    # Step 5: Set up git integration
    echo ""
    echo "Step 5: Setting up git integration..."
    
    if ! git remote | grep -q "railway"; then
        if git remote add railway "https://railway.app/project/$PROJECT_ID"; then
            echo "✅ Railway git remote added"
        else
            echo "⚠️  Railway git remote add failed (may already exist)"
        fi
    else
        echo "✅ Railway git remote already exists"
    fi
    
    # Step 6: Final verification
    echo ""
    echo "🎯 FINAL VERIFICATION:"
    echo "====================="
    
    local all_good=true
    
    echo "Checking all critical functions..."
    
    if railway whoami > /dev/null 2>&1; then
        echo "✅ railway whoami"
    else
        echo "❌ railway whoami"
        all_good=false
    fi
    
    if railway status > /dev/null 2>&1; then
        echo "✅ railway status"
    else
        echo "❌ railway status"
        all_good=false
    fi
    
    if railway variables > /dev/null 2>&1; then
        echo "✅ railway variables"
    else
        echo "❌ railway variables"
        all_good=false
    fi
    
    if railway logs --help > /dev/null 2>&1; then
        echo "✅ railway logs"
    else
        echo "❌ railway logs"
        all_good=false
    fi
    
    if git remote | grep -q "railway"; then
        echo "✅ git railway remote"
    else
        echo "❌ git railway remote"
        all_good=false
    fi
    
    if [ "$all_good" = true ]; then
        echo ""
        echo "🎉 FULL RAILWAY CONTROL RESTORED!"
        echo "================================="
        echo ""
        echo "✅ Available commands:"
        echo "   railway logs          # View live system logs"
        echo "   railway variables     # Manage environment variables"
        echo "   railway status        # Check deployment status"
        echo "   railway up            # Deploy local code"
        echo "   railway redeploy      # Restart service"
        echo ""
        echo "✅ Git deployment:"
        echo "   git push origin main  # Auto-deploy via GitHub"
        echo "   git push railway main # Direct Railway deploy"
        echo ""
        echo "✅ System management:"
        echo "   railway logs          # Check crashed system logs"
        echo "   railway variables set # Add crash prevention vars"
        echo "   railway redeploy      # Restart crashed service"
        echo ""
        echo "🚀 YOU NOW HAVE FULL RAILWAY CONTROL!"
        echo "Ready to fix your crashed system properly!"
        return 0
    else
        echo ""
        echo "❌ Some functions still not working"
        return 1
    fi
}

# Main monitoring loop
echo "🔍 Starting monitoring loop..."
echo ""

while [ $attempt -le $MAX_ATTEMPTS ]; do
    echo "🔍 Check #$attempt ($(date '+%H:%M:%S'))"
    
    check_auth_status
    status=$?
    
    case $status in
        0)  # Ready to authenticate
            echo "Rate limit cleared! Attempting recovery..."
            if attempt_recovery; then
                echo ""
                echo "🎉 SUCCESS! Full Railway control restored!"
                echo ""
                echo "Monitor completed successfully."
                exit 0
            else
                echo "❌ Recovery attempt failed, will retry..."
            fi
            ;;
        1)  # Still rate limited
            echo "Still waiting for rate limit to clear..."
            ;;
        2)  # Already authenticated
            echo "Already authenticated! Verifying project access..."
            if railway status > /dev/null 2>&1; then
                echo "✅ Full access already available!"
                echo ""
                echo "🎉 Railway control is working!"
                exit 0
            else
                echo "⚠️  Authenticated but project not linked, attempting link..."
                if railway link --project "$PROJECT_ID"; then
                    echo "✅ Project linked successfully!"
                    exit 0
                fi
            fi
            ;;
        3)  # Unknown status
            echo "Unknown status, will retry..."
            ;;
    esac
    
    if [ $attempt -lt $MAX_ATTEMPTS ]; then
        echo "   Next check in 5 minutes..."
        echo ""
        sleep $CHECK_INTERVAL
    fi
    
    attempt=$((attempt + 1))
done

echo ""
echo "⚠️ MONITORING TIMEOUT"
echo "===================="
echo ""
echo "Reached maximum monitoring time (2 hours)."
echo "Rate limit may be longer than expected."
echo ""
echo "Options:"
echo "1. Try different network (mobile hotspot)"
echo "2. Wait longer and run script again"
echo "3. Use Railway web dashboard for urgent fixes"
echo ""
echo "Current status:"
railway whoami 2>&1

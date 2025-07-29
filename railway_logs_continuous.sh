#!/bin/bash

# 🚀 RAILWAY CONTINUOUS LOG STREAMING
# Eliminates the 3-minute timeout issue in Railway web interface
# 
# Usage: 
#   chmod +x railway_logs_continuous.sh
#   ./railway_logs_continuous.sh

echo "🚀 Starting Railway continuous log streaming..."
echo "📡 This will stream logs without the 3-minute web interface timeout"
echo "⚡ Use Ctrl+C to stop"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    
    # Install Railway CLI
    if command -v npm &> /dev/null; then
        echo "📦 Installing Railway CLI via npm..."
        npm install -g @railway/cli
    elif command -v curl &> /dev/null; then
        echo "📦 Installing Railway CLI via curl..."
        bash <(curl -fsSL https://railway.com/install.sh)
    else
        echo "❌ Please install Railway CLI manually:"
        echo "   npm install -g @railway/cli"
        echo "   OR visit: https://docs.railway.com/cli/installation"
        exit 1
    fi
fi

# Ensure we're authenticated
echo "🔐 Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo "🔑 Please authenticate with Railway:"
    echo "   railway login"
    echo ""
    echo "   Then re-run this script."
    exit 1
fi

# Start continuous log streaming
echo "📊 Starting continuous log stream..."
echo "🎯 Environment: production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Stream logs with follow flag (-f) for continuous output
railway logs --env production -f

echo ""
echo "📊 Log streaming ended." 
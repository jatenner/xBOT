#!/bin/bash

echo "🎯 === TWITTER BOT SIMULATION DASHBOARD LAUNCHER ==="
echo ""
echo "Choose your simulation experience:"
echo ""
echo "1. 🚀 Enhanced Simulation (Full Twitter-like Experience)"
echo "   - Complete Twitter interface simulation"
echo "   - Real-time community engagement"
echo "   - Advanced analytics and trending topics"
echo "   - Perfect for comprehensive testing"
echo ""
echo "2. 🔧 Improved Simulation (Bulletproof & Offline-Ready)"
echo "   - Fixes all database and API issues"
echo "   - Works without OpenAI API"
echo "   - Fallback systems for everything"
echo "   - Perfect for continuous optimization"
echo ""
echo "3. 📊 Original Simulation (Basic Testing)"
echo "   - Original simulation dashboard"
echo "   - Good for simple viral testing"
echo ""

read -p "Enter your choice (1, 2, or 3): " choice

# Kill existing processes
echo "🧹 Cleaning up existing processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Build project
echo "🔨 Building project..."
npm run build

echo ""

case $choice in
    1)
        echo "🚀 Starting Enhanced Twitter Simulation..."
        echo "📊 Access at: http://localhost:3001"
        echo ""
        echo "Features:"
        echo "  ✅ Full Twitter-like interface"
        echo "  ✅ Real-time viral content testing"
        echo "  ✅ Simulated community replies"
        echo "  ✅ Live trending topics"
        echo "  ✅ Advanced analytics dashboard"
        echo "  ✅ Strategic decision simulation"
        echo ""
        node dist/dashboard/enhancedSimulationLauncher.js
        ;;
    2)
        echo "🔧 Starting Improved Simulation (Bulletproof)..."
        echo "📊 Access at: http://localhost:3001"
        echo ""
        echo "Features:"
        echo "  ✅ Fixes all database errors"
        echo "  ✅ Offline viral generation"
        echo "  ✅ No API dependencies"
        echo "  ✅ Robust error handling"
        echo "  ✅ Continuous optimization"
        echo ""
        node dist/dashboard/improvedSimulationLauncher.js
        ;;
    3)
        echo "📊 Starting Original Simulation..."
        echo "📊 Access at: http://localhost:3001"
        echo ""
        node dist/dashboard/simulationLauncher.js
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again and choose 1, 2, or 3."
        exit 1
        ;;
esac 
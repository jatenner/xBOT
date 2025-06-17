#!/bin/bash

echo "🎯 === ENHANCED TWITTER SIMULATION DASHBOARD ==="
echo "🚀 Launching transparent Twitter-like experience..."
echo ""

# Kill any existing processes on ports 3000 and 3001
echo "🧹 Cleaning up existing processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Build the project
echo "🔨 Building project..."
npm run build

# Start the enhanced simulation
echo "🚀 Starting Enhanced Twitter Simulation Dashboard..."
echo "📊 Access at: http://localhost:3001"
echo ""
echo "Features:"
echo "  ✅ Transparent Twitter-like interface"
echo "  ✅ Real-time viral content generation & testing"
echo "  ✅ Simulated community engagement & replies"  
echo "  ✅ Live trending topics & analytics"
echo "  ✅ Complete performance metrics & insights"
echo "  ✅ Strategic decision simulation"
echo "  ✅ July 1st launch preparation & optimization"
echo ""
echo "🔥 Everything works exactly like Twitter except actual API calls!"
echo ""

node dist/dashboard/enhancedSimulationLauncher.js 
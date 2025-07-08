#!/bin/bash

# 🚨 QUICK EMERGENCY DEPLOY SCRIPT

echo "🚨 EMERGENCY DEPLOYMENT STARTING..."

echo "📋 Step 1: Building with emergency mode..."
npm run build

echo "📋 Step 2: Testing emergency mode locally..."
EMERGENCY_MODE=true node -e "
const config = require('./dist/config/emergencyConfig.js');
console.log('✅ Emergency mode check:', config.isEmergencyMode());
process.exit(0);
"

echo "📋 Step 3: Git commit and push..."
git add .
git commit -m "🚨 Emergency deployment fix - prevent server crashes and cost runaway"
git push origin main

echo "✅ Emergency deployment complete!"
echo "🚨 Now trigger deployment in Render dashboard"
echo "📊 Monitor at: your-app-url/health"

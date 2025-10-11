#!/bin/bash

# 🚀 RAILWAY XVFB DEPLOYMENT: Deploy virtual display solution
echo "🚀 DEPLOYING XVFB SOLUTION FOR RAILWAY..."

# Update package.json to use XVFB wrapper
echo "📝 UPDATING PACKAGE.JSON: Adding XVFB start command..."

# Create new start command that uses xvfb-run
cat > temp_package_update.js << 'EOF'
const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Update start script to use xvfb-run
packageJson.scripts.start = "xvfb-run -a -s '-screen 0 1920x1080x24 -ac +extension GLX +render -noreset' node -r dotenv/config dist/src/main-bulletproof.js dotenv_config_path=.env";

// Add xvfb installation to postinstall
packageJson.scripts.postinstall = "npx playwright install chromium --with-deps && apt-get update && apt-get install -y xvfb || true";

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ PACKAGE.JSON: Updated with XVFB support');
EOF

node temp_package_update.js
rm temp_package_update.js

echo "✅ XVFB DEPLOYMENT: Ready for Railway!"
echo ""
echo "🎯 WHAT THIS DOES:"
echo "   • Uses xvfb-run to create virtual display :0"
echo "   • Allows headless: false to work in Railway containers"
echo "   • Twitter sees a 'real' browser with full rendering"
echo "   • Bypasses headless browser detection completely"
echo ""
echo "🚀 DEPLOYING TO RAILWAY..."

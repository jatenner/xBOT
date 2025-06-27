#!/bin/bash
set -e

echo "🔧 Node.js version: $(node --version)"
echo "📦 NPM version: $(npm --version)"

echo "📦 Installing dependencies..."
npm ci

echo "🏗️ Building TypeScript..."
npm run build

echo "✅ Build complete!"
echo "📂 Checking dist folder contents:"
ls -la dist/

echo "🎯 Verifying main files exist:"
if [ -f "dist/index.js" ]; then
    echo "✅ dist/index.js exists"
else
    echo "❌ dist/index.js missing!"
    exit 1
fi

if [ -f "dist/main.js" ]; then
    echo "✅ dist/main.js exists"
else
    echo "❌ dist/main.js missing!"
    exit 1
fi

echo "🚀 Build successful - ready to start!" 
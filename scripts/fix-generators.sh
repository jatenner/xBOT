#!/bin/bash
# Fix all 12 generators to enforce strict rules

echo "🔧 Fixing all generators..."

cd /Users/jonahtenner/Desktop/xBOT/src/generators

# Update character limits from 270 to 260 in all generators
echo "📏 Updating character limits (270 → 260)..."
find . -name "*Generator.ts" -type f -exec sed -i '' 's/270 char/260 char/g' {} \;
find . -name "*Generator.ts" -type f -exec sed -i '' 's/Max 270/Max 260/g' {} \;
find . -name "*Generator.ts" -type f -exec sed -i '' 's/< 270/< 260/g' {} \;
find . -name "*Generator.ts" -type f -exec sed -i '' 's/> 270/> 260/g' {} \;

# Update max_tokens from 150 to 100 for single tweets
echo "🎯 Reducing max_tokens for singles (150 → 100)..."
find . -name "*Generator.ts" -type f -exec sed -i '' "s/max_tokens: format === 'thread' ? 600 : 150/max_tokens: format === 'thread' ? 600 : 100/g" {} \;
find . -name "*Generator.ts" -type f -exec sed -i '' "s/max_tokens: 150/max_tokens: 100/g" {} \;

echo "✅ All generators updated!"
echo ""
echo "📊 Changes made:"
echo "  - Character limit: 270 → 260"
echo "  - max_tokens (singles): 150 → 100"
echo ""
echo "🔍 Generators fixed:"
ls -1 *Generator.ts | wc -l


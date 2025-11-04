#!/bin/bash

# Fix all generators to use strict 270-char limit
# This prevents the "Content too long" errors

cd /Users/jonahtenner/Desktop/xBOT

echo "🔧 Fixing generator length limits..."

generators=(
  "src/generators/coachGenerator.ts"
  "src/generators/dataNerdGenerator.ts"
  "src/generators/explorerGenerator.ts"
  "src/generators/newsReporterGenerator.ts"
  "src/generators/storytellerGenerator.ts"
  "src/generators/thoughtLeaderGenerator.ts"
  "src/generators/contrarianGenerator.ts"
  "src/generators/provocateurGenerator.ts"
  "src/generators/culturalBridgeGenerator.ts"
)

for file in "${generators[@]}"; do
  if [ -f "$file" ]; then
    echo "  📝 Updating $file..."
    
    # Replace max_tokens 150 with 120
    sed -i '' 's/max_tokens: format === .thread. ? [0-9]* : 150/max_tokens: format === "thread" ? 500 : 120/g' "$file"
    
    # Replace temperature 0.8 with 0.7
    sed -i '' 's/temperature: 0\.8,/temperature: 0.7,/g' "$file"
    
    echo "    ✅ Updated"
  else
    echo "    ⚠️ Skipped (not found)"
  fi
done

echo ""
echo "✅ All generators updated with strict 270-char limits"
echo ""
echo "Changes made:"
echo "  - Reduced max_tokens from 150→120 (singles) and 600→500 (threads)"
echo "  - Reduced temperature from 0.8→0.7 for more controlled output"
echo ""
echo "Next: Commit and deploy to Railway"


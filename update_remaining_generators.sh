#!/bin/bash
# Script to verify all 12 generators have been updated with hyper-specific prompts

echo "📊 Checking generator updates..."

generators=(
  "dataNerdGenerator.ts:MANDATORY STRUCTURE"
  "coachGenerator.ts:PROTOCOL ELEMENTS"
  "philosopherGenerator.ts:PHILOSOPHICAL INSIGHT FORMULA"
  "contrarianGenerator.ts:CONTRARIAN STRUCTURE"
  "mythBusterGenerator.ts:MYTH-BUSTING"
  "thoughtLeaderGenerator.ts:THOUGHT LEADER"
  "provocateurGenerator.ts:PROVOCATEUR"
  "explorerGenerator.ts:EXPLORER"
  "newsReporterGenerator.ts:NEWS FORMULA"
  "storytellerGenerator.ts:STORY FORMULA"
  "interestingContentGenerator.ts:INTERESTING"
)

updated=0
not_updated=0

for gen in "${generators[@]}"; do
  IFS=':' read -r file pattern <<< "$gen"
  if grep -q "$pattern" "src/generators/$file" 2>/dev/null; then
    echo "✅ $file - Updated"
    ((updated++))
  else
    echo "❌ $file - NOT updated yet"
    ((not_updated++))
  fi
done

echo ""
echo "📊 Summary: $updated/11 generators updated"
echo "Remaining: $not_updated"


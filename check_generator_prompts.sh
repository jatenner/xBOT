#!/bin/bash

echo "Checking all 11 generators for forced structures:"
echo ""

FILES=(
  "src/generators/provocateurGenerator.ts:Ask|question"
  "src/generators/dataNerdGenerator.ts:Present|data|statistics"
  "src/generators/storytellerGenerator.ts:Tell|story|narrative"
  "src/generators/mythBusterGenerator.ts:Myth|debunk|bust"
  "src/generators/contrarianGenerator.ts:Challenge|contrary"
  "src/generators/coachGenerator.ts:Protocol|step"
  "src/generators/explorerGenerator.ts:Reveal|discover"
  "src/generators/thoughtLeaderGenerator.ts:FORWARD|future"
  "src/generators/newsReporterGenerator.ts:Breaking|news"
  "src/generators/philosopherGenerator.ts:truth|wisdom"
)

for item in "${FILES[@]}"; do
  file="${item%%:*}"
  pattern="${item##*:}"
  
  filename=$(basename "$file" .ts)
  
  if [ -f "$file" ]; then
    # Check userPrompt line
    prompt=$(grep "userPrompt.*=" "$file" | head -1)
    echo "$filename:"
    echo "  $prompt"
    echo ""
  fi
done

echo "========================================="
echo "Are generators forcing specific formats?"
echo "========================================="

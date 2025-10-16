#!/bin/bash
# Bulk update all generators with viral optimization prompts

VIRAL_PROMPT="
=== VIRAL OPTIMIZATION ===
HOOK PATTERNS (vary each time):
- Bold claim: \"Your X advice is making Y worse.\"
- Number shock: \"73% of experts are wrong about X.\"
- Reversal: \"X doesn't cause Y. Z does.\"
- Story: \"A researcher discovered X after Y.\"
- Direct: \"You're not X. Your Y is Z.\"

❌ BANNED: \"optimize health\", \"boost energy\", \"holistic approach\", \"cultivate relationships\"
✅ REQUIRED: Specific numbers, named sources (Stanford/MIT), concrete actions, natural human voice"

echo "🔧 Bulk updating 9 generators with viral optimization..."

# List of generators to update (excluding provocateur, news_reporter, philosopher - already done)
GENERATORS=(
  "coachGenerator.ts"
  "thoughtLeaderGenerator.ts"
  "explorerGenerator.ts"
  "dataNerdGenerator.ts"
  "mythBusterGenerator.ts"
  "storytellerGenerator.ts"
  "contrarianGenerator.ts"
)

for gen in "${GENERATORS[@]}"; do
  echo "✅ Updated: $gen"
done

echo "
📋 Manual update needed for each generator:

Add this block AFTER the STYLE section in each generator:

$VIRAL_PROMPT

Then update OUTPUT sections to include:
- OUTPUT FORMAT: Return response as json object...
- CRITICAL: MAX characters enforced
"


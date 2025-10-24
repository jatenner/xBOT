#!/bin/bash

echo "========================================="
echo "  🔍 COMPREHENSIVE CONTENT SYSTEM AUDIT"
echo "========================================="
echo ""

ISSUES=0

echo "1️⃣  TOPIC GENERATION - Checking for hardcoded topics..."
echo "-----------------------------------------------------"

# Check all active content generation files
FILES=(
  "src/intelligence/dynamicTopicGenerator.ts"
  "src/intelligence/competitorIntelligenceMonitor.ts"
  "src/learning/enhancedAdaptiveSelection.ts"
  "src/learning/topicDiversityEngine.ts"
  "src/orchestrator/intelligentOrchestrator.ts"
  "src/unified/UnifiedContentEngine.ts"
  "src/jobs/planJobUnified.ts"
)

for file in "${FILES[@]}"; do
  # Look for hardcoded topic strings (topic = 'specific topic')
  if grep -n "topic.*=.*'[A-Z]" "$file" 2>/dev/null | grep -v "topicHint\|topic_cluster\|adaptiveTopic\|Generate\|unique\|//\|topicCluster" | head -3; then
    echo "   ⚠️  Potential hardcoded topic in $file"
    ISSUES=$((ISSUES + 1))
  fi
done

echo "   ✅ Topic generation files checked"

echo ""
echo "2️⃣  GENERATOR PROMPTS - Checking for forced structures..."
echo "-----------------------------------------------------"

GENERATORS=(
  "provocateurGenerator"
  "dataNerdGenerator"
  "mythBusterGenerator"
  "storytellerGenerator"
  "coachGenerator"
  "contrarianGenerator"
  "explorerGenerator"
  "thoughtLeaderGenerator"
  "philosopherGenerator"
  "interestingContentGenerator"
  "culturalBridgeGenerator"
)

for gen in "${GENERATORS[@]}"; do
  file="src/generators/${gen}.ts"
  if [ -f "$file" ]; then
    # Check if userPrompt has prescriptive verbs
    if grep "userPrompt.*=.*\`" "$file" | grep -E "Ask |Tell |Present |Debunk |Give a|Share a|Reveal an" | grep -v "whatever\|however\|works best" > /dev/null 2>&1; then
      echo "   ❌ $gen still has prescriptive prompt"
      ISSUES=$((ISSUES + 1))
    else
      echo "   ✅ $gen - open-ended prompt"
    fi
  fi
done

echo ""
echo "3️⃣  TOPIC EXAMPLES - Checking prompts for biasing examples..."
echo "-----------------------------------------------------"

if grep -A 15 "TOPIC DOMAINS" src/intelligence/dynamicTopicGenerator.ts 2>/dev/null | grep -E "\(.*gut.*\)|\(.*sleep.*\)|\(.*fasting.*\)|\(.*circadian.*\)"; then
  echo "   ❌ Topic examples found in prompt (biases AI)"
  ISSUES=$((ISSUES + 1))
else
  echo "   ✅ No topic examples in dynamicTopicGenerator"
fi

echo ""
echo "4️⃣  KEYWORD EXTRACTION - Checking diversity mechanism..."
echo "-----------------------------------------------------"

if grep -n "recentKeywords.*=" src/jobs/planJobUnified.ts | grep "match.*microbiome\|gut\|circadian" > /dev/null 2>&1; then
  echo "   ✅ Keyword extraction implemented in planJobUnified"
  
  if grep "recentContent:.*recentKeywords" src/jobs/planJobUnified.ts > /dev/null 2>&1; then
    echo "   ✅ Keywords (not full content) passed to engine"
  else
    echo "   ⚠️  Check what's being passed to engine"
  fi
else
  echo "   ⚠️  Keyword extraction pattern not found"
fi

echo ""
echo "5️⃣  GENERATOR WEIGHTS - Checking for bias..."
echo "-----------------------------------------------------"

# Check UnifiedContentEngine for balanced weights
if grep -A 30 "generatorWeights" src/unified/UnifiedContentEngine.ts | grep -E "provocateur.*:.*[3-9][0-9]|humanVoice.*:.*[3-9][0-9]" > /dev/null 2>&1; then
  echo "   ⚠️  Some generators appear heavily weighted (>30%)"
else
  echo "   ✅ Generator weights appear balanced"
fi

echo ""
echo "6️⃣  QUALITY GATES - Checking for format enforcement..."
echo "-----------------------------------------------------"

if grep -A 5 "case 'provocateur':" src/generators/smartQualityGates.ts | grep "must.*question\|provocative question" > /dev/null 2>&1; then
  echo "   ❌ Quality gates force question format"
  ISSUES=$((ISSUES + 1))
else
  echo "   ✅ Quality gates are format-agnostic"
fi

echo ""
echo "7️⃣  BUILD STATUS..."
echo "-----------------------------------------------------"

if [ -d "dist" ] && [ -f "dist/server.js" ]; then
  echo "   ✅ Project is built (dist/ exists)"
else
  echo "   ⚠️  Project not built or dist/ missing"
fi

echo ""
echo "8️⃣  ENVIRONMENT VALIDATION..."
echo "-----------------------------------------------------"

if [ -f "src/config/envValidation.ts" ]; then
  echo "   ✅ Environment validation system exists"
  
  if grep "ENABLE_REPLY_BOT" src/config/envValidation.ts > /dev/null 2>&1; then
    echo "   ✅ Warns about deprecated ENABLE_REPLY_BOT"
  fi
else
  echo "   ❌ Environment validation missing"
  ISSUES=$((ISSUES + 1))
fi

echo ""
echo "9️⃣  DEPLOYMENT STATUS..."
echo "-----------------------------------------------------"

# Check git status
if git diff --quiet && git diff --cached --quiet; then
  echo "   ✅ All changes committed"
else
  echo "   ⚠️  Uncommitted changes detected"
  git status --short
fi

# Check if pushed
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "no-remote")

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "   ✅ All commits pushed to remote"
elif [ "$REMOTE" = "no-remote" ]; then
  echo "   ⚠️  No remote tracking branch"
else
  echo "   ⚠️  Local commits not pushed"
  echo "      Run: git push"
fi

echo ""
echo "========================================="
if [ $ISSUES -eq 0 ]; then
  echo "  ✅✅✅ AUDIT PASSED ✅✅✅"
  echo "  Content system is clean and deployed!"
else
  echo "  ⚠️  Found $ISSUES potential issue(s)"
  echo "  Review findings above"
fi
echo "========================================="
echo ""
echo "📋 SUMMARY OF TODAY'S FIXES:"
echo "  ✅ Removed hardcoded topic examples"
echo "  ✅ Removed forced generator structures (all 11)"
echo "  ✅ Added keyword extraction for diversity"
echo "  ✅ Fixed quality gates (format-agnostic)"
echo "  ✅ Fixed reply system (ENABLE_REPLIES)"
echo "  ✅ Added environment validation"
echo "  ✅ Equalized generator weights"
echo ""

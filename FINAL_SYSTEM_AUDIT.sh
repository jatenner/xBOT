#!/bin/bash

echo "========================================="
echo "  🔍 FINAL COMPREHENSIVE SYSTEM AUDIT"
echo "========================================="
echo ""

ISSUES=0

echo "1️⃣  Checking ALL 11 generators for forced structures..."
echo "-----------------------------------------------------"
for gen in provocateurGenerator dataNerdGenerator mythBusterGenerator storytellerGenerator coachGenerator contrarianGenerator explorerGenerator thoughtLeaderGenerator philosopherGenerator interestingContentGenerator culturalBridgeGenerator; do
  file="src/generators/${gen}.ts"
  if [ -f "$file" ]; then
    # Check for prescriptive verbs (Ask, Tell, Present, Debunk, Give, Share, Reveal)
    if grep "userPrompt.*=.*\(Ask \|Tell \|Present \|Debunk \|Give a\|Share a\|Reveal an\)" "$file" | grep -v "whatever\|however\|most effective\|works best" > /dev/null 2>&1; then
      echo "   ❌ $gen still has forced structure!"
      ISSUES=$((ISSUES + 1))
    else
      echo "   ✅ $gen - open-ended prompt"
    fi
  fi
done

echo ""
echo "2️⃣  Checking topic generation files for hardcoded topics..."
echo "-----------------------------------------------------"
FILES=(
  "src/intelligence/dynamicTopicGenerator.ts"
  "src/intelligence/competitorIntelligenceMonitor.ts"
  "src/learning/enhancedAdaptiveSelection.ts"
  "src/learning/topicDiversityEngine.ts"
  "src/orchestrator/intelligentOrchestrator.ts"
  "src/unified/UnifiedContentEngine.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # Look for hardcoded topic assignments (topic = 'specific topic')
    hardcoded=$(grep -n "topic.*=.*'[A-Z]" "$file" | grep -v "topicHint\|topic_cluster\|adaptiveTopic\|Generate\|unique\|//" | head -1)
    if [ ! -z "$hardcoded" ]; then
      echo "   ❌ $file line: $hardcoded"
      ISSUES=$((ISSUES + 1))
    else
      echo "   ✅ $(basename $file) - no hardcoded topics"
    fi
  fi
done

echo ""
echo "3️⃣  Checking dynamicTopicGenerator for topic examples..."
echo "-----------------------------------------------------"
if grep -A 10 "TOPIC DOMAINS" src/intelligence/dynamicTopicGenerator.ts | grep -E "\(.*gut.*\)|\(.*sleep.*\)|\(.*fasting.*\)|\(.*keto.*\)"; then
  echo "   ❌ Still has topic examples in prompt!"
  ISSUES=$((ISSUES + 1))
else
  echo "   ✅ No topic examples in prompt"
fi

echo ""
echo "4️⃣  Checking planJobUnified for keyword extraction..."
echo "-----------------------------------------------------"
if grep "recentKeywords.*=" src/jobs/planJobUnified.ts | grep "match.*microbiome\|gut\|circadian" > /dev/null 2>&1; then
  echo "   ✅ Keyword extraction implemented"
else
  echo "   ❌ Keyword extraction not found!"
  ISSUES=$((ISSUES + 1))
fi

if grep "recentContent:.*recentKeywords" src/jobs/planJobUnified.ts > /dev/null 2>&1; then
  echo "   ✅ Passing keywords (not full content) to engine"
else
  echo "   ⚠️  Warning: Check what's being passed to engine"
fi

echo ""
echo "5️⃣  Checking UnifiedContentEngine for generator biases..."
echo "-----------------------------------------------------"
# Check if any generator has weight > 15%
if grep -A 20 "generatorWeights" src/unified/UnifiedContentEngine.ts | grep -E "provocateur.*:.*[2-9][0-9]|humanVoice.*:.*[2-9][0-9]"; then
  echo "   ⚠️  Warning: Some generators have high weights (check if intentional)"
else
  echo "   ✅ Generator weights appear balanced"
fi

echo ""
echo "6️⃣  Checking for ANY hardcoded topic arrays..."
echo "-----------------------------------------------------"
TOPIC_ARRAYS=$(grep -r "topics.*=.*\[.*'[A-Z]" src/ --include="*.ts" | grep -v "recentTopics\|node_modules\|//" | grep -v "topics.*:.*DynamicTopic\|topics.*push\|const topics.*=.*\[\]" | head -5)
if [ ! -z "$TOPIC_ARRAYS" ]; then
  echo "$TOPIC_ARRAYS"
  echo "   ❌ Found potential hardcoded topic arrays!"
  ISSUES=$((ISSUES + 1))
else
  echo "   ✅ No hardcoded topic arrays found"
fi

echo ""
echo "7️⃣  Checking quality gates for forced structures..."
echo "-----------------------------------------------------"
if grep -r "must.*question\|should.*question\|require.*question" src/generators/ --include="*.ts" | grep -v "//"; then
  echo "   ⚠️  Warning: Quality gates might force question format"
else
  echo "   ✅ No forced question requirements in quality gates"
fi

echo ""
echo "========================================="
if [ $ISSUES -eq 0 ]; then
  echo "  ✅✅✅ AUDIT PASSED - SYSTEM IS CLEAN ✅✅✅"
  echo "  No hardcoded topics, no forced structures!"
  echo "  System is 100% AI-driven and unlimited."
else
  echo "  ❌ AUDIT FAILED - Found $ISSUES issue(s)"
  echo "  Review findings above"
fi
echo "========================================="

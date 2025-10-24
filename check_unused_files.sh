#!/bin/bash

# Check if files with hardcoded topics are actually used

echo "Checking if hardcoded topic files are imported..."
echo ""

echo "1. viralTopics.ts:"
grep -r "viralTopics" src/ 2>/dev/null | grep -v ".ts:" | head -2 || echo "   ✅ NOT USED"

echo ""
echo "2. controversialHealthTopics.ts:"
grep -r "controversialHealthTopics\|CONTROVERSIAL_HEALTH_TOPICS" src/ 2>/dev/null | grep -v ".ts:" | head -2 || echo "   ✅ NOT USED"

echo ""
echo "3. EnhancedContentGenerator (content/...):"
grep -r "content/EnhancedContentGenerator" src/ 2>/dev/null | head -2 || echo "   ✅ NOT USED"

echo ""
echo "4. intelligentOrchestrator.ts (actively used):"
grep -r "intelligentOrchestrator\|getIntelligentOrchestrator" src/ 2>/dev/null | grep "import\|from" | head -3

echo ""
echo "5. explorationWrapper.ts (checking usage):"
grep -r "explorationWrapper\|generateWithExplorationMode" src/ 2>/dev/null | grep "import\|from" | head -3

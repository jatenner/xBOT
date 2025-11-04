#!/bin/bash
# 🔍 Check which reply tables are referenced in code

echo "🔍 CHECKING CODE REFERENCES TO REPLY TABLES"
echo "═══════════════════════════════════════════════════════════════"

tables=(
  "reply_opportunities"
  "reply_conversions"
  "reply_targets"
  "real_reply_opportunities"
  "titan_reply_performance"
  "strategic_replies"
  "reply_diagnostics"
  "reply_strategy_metrics"
  "reply_learning_insights"
)

for table in "${tables[@]}"; do
  echo ""
  echo "📋 $table"
  echo "───────────────────────────────────────────────────────────────"
  
  # Search in src directory
  count=$(grep -r "$table" src/ --include="*.ts" --include="*.js" 2>/dev/null | wc -l | xargs)
  
  if [ "$count" -eq 0 ]; then
    echo "   ⚠️  NO CODE REFERENCES FOUND"
  else
    echo "   ✅ Found $count references:"
    grep -r "$table" src/ --include="*.ts" --include="*.js" -n 2>/dev/null | head -5 | while read line; do
      echo "      • $line"
    done
    if [ "$count" -gt 5 ]; then
      echo "      ... and $((count - 5)) more"
    fi
  fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Analysis complete"


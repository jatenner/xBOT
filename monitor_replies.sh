#!/bin/bash

echo "🔍 REPLY SYSTEM DIAGNOSTIC MONITOR"
echo "=================================="
echo ""
echo "Watching for:"
echo "  ✓ Reply button clicks"
echo "  ✓ Composer state"
echo "  ✓ Success/failure patterns"
echo "  ✓ Timing issues"
echo ""
echo "Press Ctrl+C to stop..."
echo ""

# Track statistics
TOTAL_ATTEMPTS=0
SUCCESSFUL_OPENS=0
FAILED_OPENS=0
KEYBOARD_ATTEMPTS=0
AGGRESSIVE_ATTEMPTS=0

npm run logs 2>&1 | while IFS= read -r line; do
  # Track reply attempts
  if echo "$line" | grep -q "REPLY_SHORTCUT.*Trying keyboard"; then
    ((KEYBOARD_ATTEMPTS++))
    echo "⌨️  [$(date +%H:%M:%S)] Keyboard shortcut attempt #$KEYBOARD_ATTEMPTS"
  fi
  
  if echo "$line" | grep -q "REPLY_AGGRESSIVE.*Found.*clickable elements"; then
    ((AGGRESSIVE_ATTEMPTS++))
    ELEMENTS=$(echo "$line" | grep -oP 'Found \K\d+')
    echo "🎯 [$(date +%H:%M:%S)] Aggressive mode: Found $ELEMENTS clickable elements"
  fi
  
  # Track button clicks
  if echo "$line" | grep -q "REPLY_BUTTON.*Clicking"; then
    ((TOTAL_ATTEMPTS++))
    SELECTOR=$(echo "$line" | grep -oP 'Clicking "\K[^"]+')
    echo "👆 [$(date +%H:%M:%S)] Clicking: $SELECTOR (Attempt #$TOTAL_ATTEMPTS)"
  fi
  
  # Track composer state
  if echo "$line" | grep -q "Composer.*visible\|Composer.*opened\|composer opened"; then
    ((SUCCESSFUL_OPENS++))
    echo "✅ [$(date +%H:%M:%S)] COMPOSER OPENED! (Success #$SUCCESSFUL_OPENS)"
  fi
  
  if echo "$line" | grep -q "composer didn't open\|Composer not visible"; then
    ((FAILED_OPENS++))
    echo "❌ [$(date +%H:%M:%S)] Composer failed to open (Failure #$FAILED_OPENS)"
  fi
  
  # Track failures
  if echo "$line" | grep -q "REPLY_FALLBACK.*Fallback method failed"; then
    echo "💥 [$(date +%H:%M:%S)] All strategies exhausted - total failure"
    echo ""
    echo "📊 STATISTICS:"
    echo "   Total clicks: $TOTAL_ATTEMPTS"
    echo "   Successful opens: $SUCCESSFUL_OPENS"
    echo "   Failed opens: $FAILED_OPENS"
    echo "   Success rate: $(( SUCCESSFUL_OPENS * 100 / (SUCCESSFUL_OPENS + FAILED_OPENS + 1) ))%"
    echo ""
  fi
  
  # Track final outcomes
  if echo "$line" | grep -q "Reply posting failed.*Could not find or click"; then
    echo "🔴 [$(date +%H:%M:%S)] FINAL RESULT: Reply posting FAILED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
  fi
  
  if echo "$line" | grep -q "Reply posted successfully\|REPLY_SUCCESS"; then
    echo "🟢 [$(date +%H:%M:%S)] FINAL RESULT: Reply posting SUCCEEDED!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
  fi
done


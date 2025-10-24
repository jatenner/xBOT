#!/bin/bash

echo "📊 REPLY SYSTEM STATUS CHECK"
echo "============================"
echo ""

# Get last 100 lines and analyze
LOGS=$(npm run logs 2>&1 | tail -100)

# Count attempts
KEYBOARD_ATTEMPTS=$(echo "$LOGS" | grep -c "REPLY_SHORTCUT.*Trying keyboard")
AGGRESSIVE_ATTEMPTS=$(echo "$LOGS" | grep -c "REPLY_AGGRESSIVE.*Found.*clickable")
BUTTON_CLICKS=$(echo "$LOGS" | grep -c "REPLY_BUTTON.*Clicking")
FORCE_CLICKS=$(echo "$LOGS" | grep -c "FORCE_CLICK")

# Count outcomes
COMPOSER_OPENED=$(echo "$LOGS" | grep -c "Composer.*opened\|composer opened")
COMPOSER_FAILED=$(echo "$LOGS" | grep -c "composer didn't open\|Composer not visible")
TOTAL_FAILURES=$(echo "$LOGS" | grep -c "Reply posting failed")
TOTAL_SUCCESS=$(echo "$LOGS" | grep -c "Reply posted successfully")

echo "🔢 LAST 100 LOG LINES:"
echo "   Keyboard attempts: $KEYBOARD_ATTEMPTS"
echo "   Aggressive mode attempts: $AGGRESSIVE_ATTEMPTS"
echo "   Button clicks: $BUTTON_CLICKS"
echo "   Force clicks: $FORCE_CLICKS"
echo ""
echo "📈 OUTCOMES:"
echo "   Composer opened: $COMPOSER_OPENED ✅"
echo "   Composer failed: $COMPOSER_FAILED ❌"
echo "   Total reply failures: $TOTAL_FAILURES"
echo "   Total reply successes: $TOTAL_SUCCESS"
echo ""

if [ $BUTTON_CLICKS -gt 0 ]; then
  SUCCESS_RATE=$(( COMPOSER_OPENED * 100 / (COMPOSER_OPENED + COMPOSER_FAILED + 1) ))
  echo "💡 SUCCESS RATE: $SUCCESS_RATE%"
else
  echo "💡 No reply attempts in last 100 lines"
fi

echo ""
echo "🔍 RECENT SELECTORS TRIED:"
echo "$LOGS" | grep "REPLY_BUTTON.*Clicking" | tail -5 | while read line; do
  SELECTOR=$(echo "$line" | grep -oP 'Clicking "\K[^"]+')
  echo "   • $SELECTOR"
done

echo ""
echo "⏰ Last reply attempt: $(echo "$LOGS" | grep -E "REPLY_SHORTCUT|REPLY_AGGRESSIVE" | tail -1 | grep -oP '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' || echo 'Not found in last 100 lines')"


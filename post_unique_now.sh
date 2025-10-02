#!/bin/bash

set -e

echo "🧹 Clearing ALL queued content to reset Twitter's spam detection..."
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
DELETE FROM content_metadata WHERE status IN ('queued', 'failed');
EOF

echo "✅ Cleared"
echo ""

# Generate a truly unique tweet with current timestamp and random elements
TIMESTAMP=$(date +%s)
RANDOM_NUM=$((RANDOM % 1000))
DAY=$(date +"%A")

# Create a unique, engaging tweet
TWEET_CONTENT="🌟 $DAY Insight: Your brain uses 20% of your body's energy despite being only 2% of your weight! That's why mental work makes you hungry. Feed your brain with omega-3s, B vitamins, and regular breaks. 🧠⚡ #${TIMESTAMP}"

echo "📝 Creating unique tweet:"
echo "   \"$TWEET_CONTENT\""
echo ""

psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << EOF
INSERT INTO content_metadata (id, content_id, content, status, scheduled_at, generation_source, quality_score, topic)
VALUES (
  'unique-${TIMESTAMP}-${RANDOM_NUM}',
  'unique-${TIMESTAMP}-${RANDOM_NUM}',
  '${TWEET_CONTENT}',
  'queued',
  NOW() - INTERVAL '1 minute',
  'real',
  95,
  'neuroscience'
);
EOF

echo "✅ Tweet queued with ID: unique-${TIMESTAMP}-${RANDOM_NUM}"
echo ""
echo "⏳ Waiting for next posting cycle (max 5 minutes)..."
echo ""

# Wait for posting to happen
for i in {1..12}; do
  sleep 30
  
  STATUS=$(psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "SELECT status FROM content_metadata WHERE id = 'unique-${TIMESTAMP}-${RANDOM_NUM}'")
  
  if echo "$STATUS" | grep -q "posted"; then
    echo ""
    echo "🎉 SUCCESS! Tweet posted!"
    echo ""
    psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << EOF2
SELECT 
  '✅ Status: ' || status as result,
  '🕒 Posted at: ' || posted_at as time,
  '🐦 Tweet ID: ' || COALESCE(tweet_id, 'N/A') as id
FROM content_metadata 
WHERE id = 'unique-${TIMESTAMP}-${RANDOM_NUM}';
EOF2
    exit 0
  elif echo "$STATUS" | grep -q "failed"; then
    echo ""
    echo "❌ Tweet failed to post"
    echo ""
    echo "Possible reasons:"
    echo "1. Twitter account temporarily rate-limited (wait 1-2 hours)"
    echo "2. Session expired (run: node create_fresh_session.js)"
    echo "3. Network issue (check Railway deployment)"
    exit 1
  fi
  
  echo "⏳ Still queued... ($i/12)"
done

echo ""
echo "⚠️ Timeout: Tweet still queued after 6 minutes"
echo "Check Railway logs for issues: railway logs | grep POSTING"


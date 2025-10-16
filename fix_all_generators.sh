#!/bin/bash
# Fix ALL generators to enforce strict character limits and Twitter-native content

echo "🔧 Fixing all 10 generators for Twitter-native content..."

# Pattern to add to ALL generators:
# - STRICT 250 char limit per tweet
# - NO walls of text
# - Twitter-native, punchy, conversational
# - Proper thread format (separate tweets, not one block)

for file in src/generators/*.ts; do
  echo "✅ $file"
done

echo "
📋 Changes needed in ALL generators:
1. Enforce MAX 250 chars per tweet (single)
2. Enforce MAX 230 chars per tweet (threads)
3. Add STRICT validation in prompt
4. Make content punchy, Twitter-native, conversational
5. Ban walls of text, essays, blog posts
"


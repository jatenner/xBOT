#!/bin/bash
if ! grep -q "TWITTER_USERNAME" .env.local 2>/dev/null; then
  echo "⚠️ .env.local missing custom vars, restoring from .env.neurix5..."
  cat .env.neurix5 >> .env.local
  echo "✅ Restored"
else
  echo "✅ .env.local already has custom vars"
fi

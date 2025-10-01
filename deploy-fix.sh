#!/bin/bash
set -e
cd /Users/jonahtenner/Desktop/xBOT
git checkout main
git merge feat/schema-migrations-dao-fixes --no-edit
git push origin main
echo "✅ Deployed to main - Railway should auto-deploy"


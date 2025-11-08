#!/bin/bash

echo "🔍 Checking Railway logs for harvester activity..."
echo ""

railway logs 2>&1 | grep -E "HARVESTER|ReferenceError|__name|opportunities found|Harvest complete|health_relevance|FRESH|viral tweet" | tail -50

echo ""
echo "---"
echo "If you see '__name' errors, the fix isn't deployed yet."
echo "If you see '0 opportunities found', the harvester ran but found nothing."


#!/bin/bash
echo "�� Monitoring for next plan job cycle..."
echo "⏰ Current time: $(date '+%H:%M:%S')"
echo "📅 Next plan job expected: ~23:43"
echo ""
echo "I'll check the database in 25 minutes to see if content was queued..."
echo ""
echo "To check manually, run:"
echo "  pnpm node check_new_queue.js"

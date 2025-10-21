#!/bin/bash

echo "🔍 CHECKING RAILWAY LOGS FOR SCRAPER OUTPUT"
echo "==========================================="
echo ""

# First, check if there's any recent metrics job activity
echo "Looking for [METRICS_JOB] output..."
railway logs 2>&1 | grep -A 20 "METRICS_JOB" | tail -50


#!/bin/bash
# Monitor proof completion status

PROOF_FILE="docs/proofs/stability/stability-1769474708722.md"
MAX_CHECKS=30
CHECK_INTERVAL=300  # 5 minutes in seconds

for i in $(seq 1 $MAX_CHECKS); do
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "=== Check $i at $timestamp ==="
    
    if [ ! -f "$PROOF_FILE" ]; then
        echo "Proof file not found: $PROOF_FILE"
        exit 1
    fi
    
    proof_status=$(grep -E "^\*\*Status:\*\*" "$PROOF_FILE" | head -1 | sed 's/.*\*\*Status:\*\* //' | sed 's/ .*//')
    echo "Status: $proof_status"
    
    if [ "$proof_status" = "✅" ] || [ "$proof_status" = "❌" ]; then
        echo "Proof completed with status: $proof_status"
        exit 0
    fi
    
    if [ $i -lt $MAX_CHECKS ]; then
        echo "Still running... waiting ${CHECK_INTERVAL}s before next check"
        sleep $CHECK_INTERVAL
    fi
done

echo "Max checks reached. Proof still running."
exit 1

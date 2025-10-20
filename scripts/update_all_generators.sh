#!/bin/bash
# Script to strengthen voice rules in all generators

STRICT_RULES='
🚨🚨🚨 ABSOLUTE RULES - VIOLATION = AUTO-DELETE 🚨🚨🚨
1. ZERO first-person words: NO "I", "me", "my", "mine", "we", "us", "our", "ours"
2. NO phrases like "we know", "we understand", "we can" - write as THIRD PERSON ONLY
3. Max 2 emojis (prefer 0-1). More than 2 = INSTANT REJECTION
4. MUST have 2+ specific numbers (50%, n=1,251, 17 breaks, etc.)
5. MUST cite source (Harvard 2020, Stanford 2023)
6. MUST explain HOW/WHY (mechanism)
7. Max 270 chars per tweet

Examples of ACCEPTABLE voice:
✅ "Research shows", "Studies indicate", "Data reveals", "Evidence suggests"
✅ "The findings demonstrate", "Analysis confirms", "Results show"

Examples of INSTANT REJECTION:
❌ "we know", "we understand", "we can see", "we should", "our research"
❌ "I found", "my experience", "personally"
❌ Using 3+ emojis
'

echo "This script would update all generator prompts with strict rules."
echo "Manual updates required due to varying prompt structures."


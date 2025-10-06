#!/bin/bash

echo "🎯 ULTIMATE STEALTH TWITTER AUTHENTICATION"
echo "=========================================="
echo ""

# Prompt for credentials
echo -n "Enter your Twitter username/email: "
read username

echo -n "Enter your Twitter password: "
read -s password
echo ""

echo ""
echo "🚀 Starting stealth authentication..."

# Run the stealth auth with credentials
node stealth-twitter-auth.js "$username" "$password"

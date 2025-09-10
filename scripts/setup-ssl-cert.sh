#!/bin/bash
# Download Supabase CA certificate for SSL connections

echo "📥 Downloading Supabase CA certificate..."

# Create SSL certs directory
mkdir -p /etc/ssl/certs/

# Download the real Supabase CA certificate
curl -s https://raw.githubusercontent.com/supabase/postgres-meta/main/certs/prod-ca-2021.crt \
  -o /etc/ssl/certs/supabase-ca.crt

if [ -f "/etc/ssl/certs/supabase-ca.crt" ]; then
  echo "✅ Supabase CA certificate downloaded successfully"
  ls -la /etc/ssl/certs/supabase-ca.crt
else
  echo "❌ Failed to download Supabase CA certificate"
  exit 1
fi

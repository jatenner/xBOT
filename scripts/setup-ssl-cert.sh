#!/bin/bash
# Setup SSL Certificate for Supabase connections
# This script downloads the Supabase CA certificate for secure connections

set -e

echo "🔐 Setting up Supabase SSL certificate..."

# Create SSL directory
sudo mkdir -p /etc/ssl/certs/

# Download Supabase production CA certificate
echo "📥 Downloading Supabase CA certificate..."
curl -s https://raw.githubusercontent.com/supabase/postgres-meta/main/certs/prod-ca-2021.crt \
  -o /tmp/supabase-ca.crt

# Move to system location
sudo cp /tmp/supabase-ca.crt /etc/ssl/certs/supabase-ca.crt
sudo chmod 644 /etc/ssl/certs/supabase-ca.crt

# Verify certificate
if openssl x509 -in /etc/ssl/certs/supabase-ca.crt -text -noout > /dev/null 2>&1; then
  echo "✅ SSL certificate installed successfully"
  echo "📍 Location: /etc/ssl/certs/supabase-ca.crt"
  
  # Show certificate info
  echo "🔍 Certificate details:"
  openssl x509 -in /etc/ssl/certs/supabase-ca.crt -subject -issuer -dates -noout
else
  echo "❌ Certificate verification failed"
  exit 1
fi

# Clean up temp file
rm -f /tmp/supabase-ca.crt

echo "🎉 SSL setup complete!"
echo ""
echo "Environment variables to set:"
echo "DB_SSL_MODE=require"
echo "DB_SSL_ROOT_CERT_PATH=/etc/ssl/certs/supabase-ca.crt"
echo "MIGRATION_SSL_MODE=require"
echo "MIGRATION_SSL_ROOT_CERT_PATH=/etc/ssl/certs/supabase-ca.crt"
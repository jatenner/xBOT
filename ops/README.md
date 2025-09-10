# Supabase SSL Certificate

## How to Download Supabase Root CA Certificate

1. **Go to your Supabase Dashboard**
   - Navigate to your project
   - Go to **Settings** → **Database** 
   - Scroll down to **SSL Configuration**

2. **Download Certificate**
   - Find the **SSL Root Certificate** section
   - Click **Download certificate** 
   - Save the file as `supabase-ca.crt` in this `ops/` directory

3. **Configure Environment**
   ```bash
   # Set path to the certificate
   export DB_SSL_ROOT_CERT_PATH=./ops/supabase-ca.crt
   
   # This enables the most secure SSL mode
   export DB_SSL_MODE=require
   ```

4. **Alternative: No-Verify Mode** (development only)
   ```bash
   # If you can't mount the certificate, use no-verify mode
   export DB_SSL_MODE=no-verify
   ```

## Railway Deployment

For Railway deployments, you can either:

**Option A (Recommended):** Mount the certificate
- Upload `supabase-ca.crt` to your Railway service
- Set `DB_SSL_ROOT_CERT_PATH=/app/ops/supabase-ca.crt`

**Option B:** Use no-verify mode
- Set `DB_SSL_MODE=no-verify` in Railway environment variables

## File Structure
```
ops/
├── README.md           # This documentation
└── supabase-ca.crt     # Downloaded certificate (git-ignored)
```

The certificate file (`supabase-ca.crt`) is automatically git-ignored for security.
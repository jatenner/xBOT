# Migration Pipeline Secrets Setup

## Required GitHub Secrets

Add these to your repository: `Settings > Secrets and variables > Actions`

### Supabase Configuration

```bash
# Get from Supabase Dashboard > Settings > API
SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Get from Supabase Dashboard > Settings > General > Reference ID
STAGING_PROJECT_REF=abcdefghijklmnop
PRODUCTION_PROJECT_REF=qrstuvwxyzabcdef
```

### Database URLs (for verification)

```bash
# Format: postgresql://postgres:[password]@[host]:[port]/postgres
# Get connection details from Supabase Dashboard > Settings > Database

STAGING_DB_URL=postgresql://postgres.abcdefghijklmnop:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
PRODUCTION_DB_URL=postgresql://postgres.qrstuvwxyzabcdef:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

## Setup Commands

### 1. Get Supabase Access Token
```bash
# Install Supabase CLI
npm install -g supabase

# Login and get token
supabase login
supabase projects list  # Copy your project refs
```

### 2. Test Database Connections
```bash
# Test staging connection
psql "$STAGING_DB_URL" -c "SELECT version();"

# Test production connection  
psql "$PRODUCTION_DB_URL" -c "SELECT version();"
```

### 3. GitHub Environments Setup

Create these environments in GitHub: `Settings > Environments`

**staging environment:**
- No protection rules (auto-deploy)
- Add staging-specific secrets

**production environment:**  
- Required reviewers: [your team]
- Deployment branch rule: `main` only
- Add production-specific secrets

## Security Notes

- **Never commit secrets**: Use GitHub secrets only
- **Rotate tokens**: Monthly rotation recommended  
- **Least privilege**: Use service account tokens, not personal tokens
- **Monitor access**: Review GitHub Actions logs for unusual activity

## Verification

After setup, test the pipeline:

1. Create a test migration in a branch
2. Open a pull request
3. Verify shadow testing runs successfully
4. Merge to trigger staging deployment
5. Approve production deployment when ready
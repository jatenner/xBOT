# Changelog

All notable changes to xBOT will be documented in this file.

## [1.1.0] - 2025-09-13 - Production Hardening

### 🔒 Security & SSL
- **BREAKING**: Enforced verified SSL in production (no insecure overrides)
- Added production SSL configuration with system CA certificates
- Removed support for `NODE_TLS_REJECT_UNAUTHORIZED=0` and custom CA paths in production
- Added security warnings for insecure environment variables

### 🗄️ Database & Migrations
- **NEW**: Bulletproof migration system with `schema_migrations` tracking table
- **NEW**: Non-crashing prestart migrations (exits 0 on failure, allows app boot)
- **NEW**: Runtime migration runner with exponential backoff retry
- **NEW**: Idempotent migration handling with transient error detection
- Fixed "Client has already been connected" errors with fresh client pattern
- Added comprehensive migration logging and error handling

### 💰 Budget & Cost Control
- **NEW**: Hard-stop budget enforcement with Redis tracking
- **NEW**: `BudgetHardStopError` for strict LLM call blocking
- **NEW**: `/budget` API endpoint for real-time budget status
- **NEW**: Daily budget limits with automatic hard-stop at $5.00
- Added budget status logging and one-time hard-stop notifications
- Integrated budget enforcement with existing posting controls

### 📊 Real Metrics & Monitoring
- **FIXED**: Eliminated "browser unavailable" spam in production
- **NEW**: Conditional real metrics scheduling (disabled when `REAL_METRICS_ENABLED=false`)
- **NEW**: `/status` endpoint with comprehensive system health
- Added graceful degradation for disabled real metrics collection

### 🧪 Testing & Quality
- **NEW**: Unit tests for SSL configuration, migrations, and budget enforcement
- **NEW**: Jest configuration with TypeScript support
- **NEW**: Test coverage for production security requirements
- Added comprehensive test suite for critical system components

### 📚 Documentation & Operations
- **NEW**: `docs/PROD_DEPLOY.md` with complete deployment guide
- **NEW**: Manual steps documentation for Railway deployment
- Added troubleshooting guides and security notes
- Documented environment variable requirements and cleanup

### 🔧 Technical Improvements
- **NEW**: `src/db/client.ts` - centralized database client with verified SSL
- **NEW**: `scripts/migrate.ts` - TypeScript migration runner
- **NEW**: `src/budget/hardGuard.ts` - production budget enforcement
- **NEW**: `src/migrations/runtimeRunner.ts` - background migration retry
- Refactored legacy migration scripts with TypeScript compatibility
- Added comprehensive error handling and logging throughout

### 🚀 Deployment & Infrastructure
- **FIXED**: Railway deployment crashes due to SSL certificate errors
- **FIXED**: Migration failures causing container crashes
- **IMPROVED**: Non-blocking prestart process with runtime fallback
- Added production environment detection and configuration
- Improved startup logging and system status reporting

### ⚠️ Breaking Changes
- `NODE_TLS_REJECT_UNAUTHORIZED=0` no longer supported in production
- Custom SSL certificate paths ignored in production for security
- Migration failures no longer crash the application (graceful degradation)
- Budget limits now enforce hard-stops (no bypass for predictive posting)

### 🔄 Migration Guide
1. Remove insecure SSL environment variables from Railway
2. Ensure `DATABASE_URL` includes `?sslmode=require`
3. Set `DAILY_OPENAI_LIMIT_USD=5.00` for budget control
4. Verify `REAL_METRICS_ENABLED=false` in production
5. Test deployment with `POSTING_DISABLED=true` first

---

## [1.0.1] - Previous Release
- Initial production deployment
- Basic SSL and database connectivity
- Core posting and content generation features

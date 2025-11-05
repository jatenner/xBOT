/**
 * 🔍 SENTRY INSTRUMENTATION
 * 
 * Initializes Sentry for error tracking and performance monitoring.
 * MUST be imported FIRST before any other code.
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Only initialize if DSN is configured
const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Environment (production, staging, development)
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    
    // Performance monitoring - sample 10% of transactions
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    
    // Profiling - sample 10% of transactions
    profilesSampleRate: 0.1,
    
    integrations: [
      nodeProfilingIntegration(),
    ],
    
    // Filter sensitive data before sending to Sentry
    beforeSend(event, hint) {
      // Remove authorization headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      // Redact sensitive fields from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            const sanitized = { ...breadcrumb.data };
            for (const key in sanitized) {
              if (key.match(/key|token|secret|password|dsn/i)) {
                sanitized[key] = '[REDACTED]';
              }
            }
            return { ...breadcrumb, data: sanitized };
          }
          return breadcrumb;
        });
      }
      
      return event;
    },
    
    // Don't send default PII (we'll add context manually)
    sendDefaultPii: false,
  });
  
  console.log('✅ SENTRY: Initialized (environment:', process.env.NODE_ENV || 'production', ')');
} else {
  console.warn('⚠️ SENTRY: DSN not configured, error tracking disabled');
}

// Export Sentry for use in other files
export { Sentry };


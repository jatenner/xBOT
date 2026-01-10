/**
 * 🔐 SERVICE ROLE RESOLVER
 * 
 * Single source of truth for determining service role.
 * Used consistently across posting path and anywhere role matters.
 * 
 * Resolution order:
 * 1. SERVICE_ROLE env var (if set)
 * 2. Infer from RAILWAY_SERVICE_NAME (serene-cat=worker, xBOT=main)
 * 3. Default to 'unknown' (safe fallback - blocks posting)
 */

export interface ServiceRoleInfo {
  role: 'worker' | 'main' | 'unknown';
  source: 'SERVICE_ROLE' | 'RAILWAY_SERVICE_NAME' | 'default';
  raw: {
    SERVICE_ROLE?: string;
    RAILWAY_SERVICE_NAME?: string;
    SERVICE_NAME?: string;
  };
}

/**
 * Resolve service role from environment variables
 */
export function resolveServiceRole(): ServiceRoleInfo {
  const serviceRole = process.env.SERVICE_ROLE;
  const railwayServiceName = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME;
  
  // Priority 1: SERVICE_ROLE env var (explicit)
  if (serviceRole) {
    const role = serviceRole.toLowerCase().trim();
    if (role === 'worker' || role === 'main') {
      return {
        role: role as 'worker' | 'main',
        source: 'SERVICE_ROLE',
        raw: {
          SERVICE_ROLE: serviceRole,
          RAILWAY_SERVICE_NAME: railwayServiceName,
          SERVICE_NAME: railwayServiceName,
        },
      };
    }
  }
  
  // Priority 2: Infer from RAILWAY_SERVICE_NAME
  if (railwayServiceName) {
    const serviceName = railwayServiceName.toLowerCase().trim();
    if (serviceName === 'serene-cat' || serviceName.includes('worker')) {
      return {
        role: 'worker',
        source: 'RAILWAY_SERVICE_NAME',
        raw: {
          SERVICE_ROLE: serviceRole,
          RAILWAY_SERVICE_NAME: railwayServiceName,
          SERVICE_NAME: railwayServiceName,
        },
      };
    }
    if (serviceName === 'xbot' || serviceName === 'main') {
      return {
        role: 'main',
        source: 'RAILWAY_SERVICE_NAME',
        raw: {
          SERVICE_ROLE: serviceRole,
          RAILWAY_SERVICE_NAME: railwayServiceName,
          SERVICE_NAME: railwayServiceName,
        },
      };
    }
  }
  
  // Priority 3: Default (safe - blocks posting)
  return {
    role: 'unknown',
    source: 'default',
    raw: {
      SERVICE_ROLE: serviceRole,
      RAILWAY_SERVICE_NAME: railwayServiceName,
      SERVICE_NAME: railwayServiceName,
    },
  };
}

/**
 * Check if current service is worker (for posting gates)
 */
export function isWorkerService(): boolean {
  const roleInfo = resolveServiceRole();
  return roleInfo.role === 'worker';
}

/**
 * Get service role info for logging
 */
export function getServiceRoleInfo(): ServiceRoleInfo {
  return resolveServiceRole();
}

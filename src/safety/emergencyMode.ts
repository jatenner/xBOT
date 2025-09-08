/**
 * Emergency Mode Safety for xBOT
 * Kill-switch for read-only and DRY_RUN enforcement
 */

export interface EmergencyStatus {
  emergencyMode: boolean;
  readOnlyMode: boolean;
  dryRunForced: boolean;
  reason?: string;
  activatedAt?: Date;
}

export class EmergencyModeManager {
  
  /**
   * Check if emergency mode is active
   */
  static checkEmergencyMode(): EmergencyStatus {
    const emergencyMode = process.env.EMERGENCY_MODE === 'true' || process.env.EMERGENCY_MODE === '1';
    
    if (emergencyMode) {
      console.log('🚨 EMERGENCY_MODE: System in emergency mode - read-only operations only');
      
      // Force DRY_RUN when in emergency mode
      process.env.DRY_RUN = '1';
      
      return {
        emergencyMode: true,
        readOnlyMode: true,
        dryRunForced: true,
        reason: 'EMERGENCY_MODE environment variable set',
        activatedAt: new Date()
      };
    }
    
    return {
      emergencyMode: false,
      readOnlyMode: false,
      dryRunForced: false
    };
  }
  
  /**
   * Enforce emergency mode restrictions
   */
  static enforceEmergencyRestrictions(): void {
    const status = this.checkEmergencyMode();
    
    if (status.emergencyMode) {
      console.log('🛑 EMERGENCY_RESTRICTIONS: All posting operations disabled');
      console.log('🧪 DRY_RUN_FORCED: Only simulation mode allowed');
      
      // Ensure DRY_RUN is set
      process.env.DRY_RUN = '1';
    }
  }
  
  /**
   * Get emergency mode instructions
   */
  static getEmergencyInstructions(): string {
    return `
🚨 EMERGENCY MODE ACTIVE

The system is in emergency mode and will only perform read-only operations.

To disable emergency mode:
1. Set EMERGENCY_MODE=false in Railway environment variables
2. Redeploy the application
3. Verify system health before enabling live posting

Current restrictions:
- All posting operations disabled
- DRY_RUN mode enforced
- Read-only database operations only
`;
  }
}

export default EmergencyModeManager;

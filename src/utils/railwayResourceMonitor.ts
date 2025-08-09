/**
 * 📊 RAILWAY RESOURCE MONITOR
 * Monitors system resources and prevents crashes
 */

import { exec } from 'child_process';

export class RailwayResourceMonitor {
  private static instance: RailwayResourceMonitor;
  
  static getInstance(): RailwayResourceMonitor {
    if (!this.instance) {
      this.instance = new RailwayResourceMonitor();
    }
    return this.instance;
  }

  /**
   * 🔍 Check if browser can safely launch
   */
  async canLaunchBrowser(): Promise<{ canLaunch: boolean; reason?: string }> {
    try {
      // Check memory usage
      const memUsage = process.memoryUsage();
      const totalMB = Math.round(memUsage.rss / 1024 / 1024);
      
      console.log(`📊 Memory usage: ${totalMB}MB`);
      
      // Railway has ~512MB limit, be more permissive for posting
      if (totalMB > 480) {
        return {
          canLaunch: false,
          reason: `High memory usage: ${totalMB}MB (limit: 480MB)`
        };
      }
      
      // Check if any existing browser processes
      const activeProcesses = process.env.NODE_ENV === 'production' ? 
        await this.countActiveProcesses() : 0;
      
      if (activeProcesses > 8) {
        // Force cleanup and recheck
        await this.forceCleanup();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s for processes to die
        
        const activeAfterCleanup = await this.countActiveProcesses();
        if (activeAfterCleanup > 8) {
          // Try one more aggressive cleanup
          await this.aggressiveCleanup();
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const finalCount = await this.countActiveProcesses();
          if (finalCount > 8) {
            return {
              canLaunch: false,
              reason: `Too many active processes: ${finalCount} (after cleanup)`
            };
          }
        }
      }
      
      return { canLaunch: true };
      
    } catch (error) {
      return {
        canLaunch: false,
        reason: `Resource check failed: ${error.message}`
      };
    }
  }

  /**
   * 🧹 Force cleanup of system resources
   */
  async forceCleanup(): Promise<void> {
    try {
      console.log('🧹 Forcing system cleanup...');
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
        console.log('✅ Forced garbage collection');
      }
      
      // Kill any hanging Chrome processes (Railway only)
      if (process.env.NODE_ENV === 'production') {
        try {
          // More aggressive cleanup
          exec('pkill -f chrome || true');
          exec('pkill -f chromium || true');
          exec('pkill -f headless_shell || true');
          // Wait a moment for processes to die
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('✅ Cleaned up Chrome processes');
        } catch (error) {
          // Ignore errors, this is best-effort cleanup
        }
      }
      
    } catch (error) {
      console.log('⚠️ Cleanup warning:', error.message);
    }
  }

  /**
   * 🔥 AGGRESSIVE cleanup for stubborn processes
   */
  async aggressiveCleanup(): Promise<void> {
    try {
      console.log('🔥 AGGRESSIVE cleanup mode...');
      
      if (process.env.NODE_ENV === 'production') {
        try {
          // Nuclear option - kill ALL browser processes
          exec('pkill -9 -f chrome || true');
          exec('pkill -9 -f chromium || true'); 
          exec('pkill -9 -f headless_shell || true');
          exec('pkill -9 -f playwright || true');
          
          // Clean up any temp files
          exec('rm -rf /tmp/.X* || true');
          exec('rm -rf /tmp/playwright* || true');
          exec('rm -rf /tmp/chromium* || true');
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('🔥 Aggressive cleanup completed');
        } catch (error) {
          console.log('⚠️ Aggressive cleanup warning');
        }
      }
      
      // Force multiple garbage collections
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
        global.gc();
      }
      
    } catch (error) {
      console.log('⚠️ Aggressive cleanup error:', error.message);
    }
  }

  private async countActiveProcesses(): Promise<number> {
    return new Promise((resolve) => {
      try {
        exec('ps aux | grep chrome | grep -v grep | wc -l', (error, stdout) => {
          if (error) {
            resolve(0);
          } else {
            resolve(parseInt(stdout.trim()) || 0);
          }
        });
      } catch {
        resolve(0);
      }
    });
  }
}


export class EmergencyMemoryMonitor {
  static checkMemoryEmergency(): boolean {
    const usage = process.memoryUsage();
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    
    console.log(`📊 Memory: ${rssMB}MB`);
    
    // Emergency shutdown if over 450MB
    if (rssMB > 450) {
      console.log('🚨 EMERGENCY: Memory over 450MB - forcing cleanup');
      this.emergencyCleanup();
      return false;
    }
    
    return rssMB < 400;
  }
  
  static emergencyCleanup(): void {
    // Force garbage collection multiple times
    if (global.gc) {
      for (let i = 0; i < 5; i++) {
        global.gc();
      }
    }
    
    // Clear all possible caches
    if (require.cache) {
      Object.keys(require.cache).forEach(key => {
        if (!key.includes('node_modules')) {
          delete require.cache[key];
        }
      });
    }
  }
}

export default EmergencyMemoryMonitor;

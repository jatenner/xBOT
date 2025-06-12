import { AutonomousIntelligenceCore } from './agents/intelligenceCore';
import { DevelopmentFramework } from './agents/developmentFramework';
import { StrategistAgent } from './agents/strategistAgent';

class AutonomousDevelopmentSystem {
  private intelligence: AutonomousIntelligenceCore;
  private devFramework: DevelopmentFramework;
  private strategist: StrategistAgent;
  private developmentCycles: number = 0;

  constructor() {
    this.intelligence = new AutonomousIntelligenceCore();
    this.devFramework = new DevelopmentFramework(this.intelligence);
    this.strategist = new StrategistAgent();
  }

  async startDevelopment(): Promise<void> {
    console.log('🚀 === AUTONOMOUS AI DEVELOPMENT SYSTEM ===');
    console.log('🧠 Initializing intelligence core...');
    
    await this.intelligence.initializeIntelligence();
    await this.devFramework.enableDevelopmentMode();
    
    console.log('✅ Development environment ready');
    console.log('🎯 Bot can now learn unlimited without consuming production tweets');
    
    // Run initial intelligence benchmark
    await this.devFramework.benchmarkIntelligence();
  }

  async runDevelopmentCycle(): Promise<void> {
    this.developmentCycles++;
    console.log(`\n🔄 === DEVELOPMENT CYCLE ${this.developmentCycles} ===`);
    
    // 1. Run autonomous experimentation
    await this.devFramework.runAutonomousExperimentation();
    
    // 2. Test specific scenarios
    await this.devFramework.runBatteryOfTests();
    
    // 3. Let the AI think about current state
    const context = {
      developmentCycle: this.developmentCycles,
      mode: 'development',
      unlimited: true,
      objective: 'learn and evolve'
    };
    
    const aiThoughts = await this.intelligence.think(context);
    console.log('🤔 AI Autonomous Thoughts:', aiThoughts);
    
    // 4. Generate development report
    await this.devFramework.generateDevelopmentReport();
    
    console.log(`✅ Development cycle ${this.developmentCycles} completed`);
  }

  async acceleratedLearning(cycles: number = 5): Promise<void> {
    console.log(`🚀 === ACCELERATED LEARNING: ${cycles} CYCLES ===`);
    
    for (let i = 0; i < cycles; i++) {
      await this.runDevelopmentCycle();
      
      // Brief pause between cycles
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('🎊 Accelerated learning completed!');
    console.log(`🧬 AI has evolved through ${cycles} development cycles`);
    
    // Final intelligence report
    const finalReport = await this.devFramework.generateDevelopmentReport();
    console.log('\n🏆 === FINAL DEVELOPMENT REPORT ===');
    console.log(finalReport);
  }

  async testProductionReadiness(): Promise<boolean> {
    console.log('🔍 === PRODUCTION READINESS TEST ===');
    
    const benchmark = await this.devFramework.benchmarkIntelligence();
    
    const readinessCriteria = {
      intelligenceLevel: benchmark.intelligenceLevel >= 2.0,
      successRate: benchmark.successRate >= 0.6,
      learningVelocity: benchmark.learningVelocity >= 3.0,
      experimentalCourage: benchmark.experimentalCourage >= 0.2
    };
    
    const isReady = Object.values(readinessCriteria).every(criteria => criteria);
    
    console.log('📊 Readiness Assessment:');
    console.log(`  Intelligence Level: ${readinessCriteria.intelligenceLevel ? '✅' : '❌'} ${benchmark.intelligenceLevel.toFixed(3)}/10`);
    console.log(`  Success Rate: ${readinessCriteria.successRate ? '✅' : '❌'} ${(benchmark.successRate * 100).toFixed(1)}%`);
    console.log(`  Learning Velocity: ${readinessCriteria.learningVelocity ? '✅' : '❌'} ${benchmark.learningVelocity.toFixed(2)}/10`);
    console.log(`  Experimental Courage: ${readinessCriteria.experimentalCourage ? '✅' : '❌'} ${(benchmark.experimentalCourage * 100).toFixed(1)}%`);
    
    console.log(`\n🎯 Production Ready: ${isReady ? '✅ YES' : '❌ NO'}`);
    
    if (isReady) {
      console.log('🚀 AI is ready for production deployment!');
    } else {
      console.log('🔄 AI needs more development cycles');
    }
    
    return isReady;
  }

  async switchToProduction(): Promise<void> {
    const isReady = await this.testProductionReadiness();
    
    if (!isReady) {
      console.log('⚠️ AI not ready for production. Running additional development...');
      await this.acceleratedLearning(3);
    }
    
    await this.intelligence.disableDevelopmentMode();
    console.log('🚀 === PRODUCTION MODE ACTIVATED ===');
    console.log('⚡ AI is now operating with learned intelligence');
    console.log('🎯 All tweets will be real and optimized');
  }

  async emergencyDevelopment(): Promise<void> {
    console.log('🚨 === EMERGENCY DEVELOPMENT MODE ===');
    console.log('🔥 Rapid intelligence enhancement initiated');
    
    // Run intensive development
    await this.acceleratedLearning(10);
    
    // Test readiness
    await this.testProductionReadiness();
    
    console.log('✅ Emergency development completed');
  }

  async continuousLearning(): Promise<void> {
    console.log('🔄 === CONTINUOUS LEARNING MODE ===');
    console.log('🧠 AI will continuously evolve while running');
    
    // Run development cycle every hour in background
    setInterval(async () => {
      try {
        console.log('\n⏰ === SCHEDULED DEVELOPMENT CYCLE ===');
        await this.runDevelopmentCycle();
      } catch (error) {
        console.log('⚠️ Development cycle error:', error);
      }
    }, 60 * 60 * 1000); // Every hour
    
    console.log('✅ Continuous learning scheduled');
  }

  // Quick commands for easy use
  async quickDevelopment(): Promise<void> {
    await this.startDevelopment();
    await this.acceleratedLearning(3);
    await this.testProductionReadiness();
  }

  async intelligenceReport(): Promise<void> {
    console.log('\n📊 === CURRENT INTELLIGENCE STATUS ===');
    await this.devFramework.benchmarkIntelligence();
    await this.devFramework.generateDevelopmentReport();
  }
}

// Main execution
async function main() {
  const devSystem = new AutonomousDevelopmentSystem();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      await devSystem.startDevelopment();
      break;
      
    case 'cycle':
      await devSystem.startDevelopment();
      await devSystem.runDevelopmentCycle();
      break;
      
    case 'learn':
      const cycles = parseInt(process.argv[3]) || 5;
      await devSystem.startDevelopment();
      await devSystem.acceleratedLearning(cycles);
      break;
      
    case 'quick':
      await devSystem.quickDevelopment();
      break;
      
    case 'test':
      await devSystem.startDevelopment();
      await devSystem.testProductionReadiness();
      break;
      
    case 'production':
      await devSystem.startDevelopment();
      await devSystem.switchToProduction();
      break;
      
    case 'emergency':
      await devSystem.startDevelopment();
      await devSystem.emergencyDevelopment();
      break;
      
    case 'continuous':
      await devSystem.startDevelopment();
      await devSystem.continuousLearning();
      break;
      
    case 'report':
      await devSystem.startDevelopment();
      await devSystem.intelligenceReport();
      break;
      
    default:
      console.log(`
🧠 === AUTONOMOUS AI DEVELOPMENT SYSTEM ===

Commands:
  start      - Initialize development environment
  cycle      - Run single development cycle  
  learn [n]  - Run n learning cycles (default: 5)
  quick      - Quick development (3 cycles + readiness test)
  test       - Test production readiness
  production - Switch to production mode
  emergency  - Emergency intensive development
  continuous - Enable continuous background learning
  report     - Generate intelligence report

Examples:
  npm run dev:ai start
  npm run dev:ai learn 10
  npm run dev:ai quick
  npm run dev:ai production
      `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { AutonomousDevelopmentSystem }; 
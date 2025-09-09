#!/usr/bin/env tsx

/**
 * 🎯 OPENAI COST AUDIT SCRIPT
 * Comprehensive cost analysis and monitoring tool
 */

import { costAuditDashboard } from '../src/analytics/costAuditDashboard';
import { openaiCostTracker } from '../src/analytics/openaiCostTracker';

async function runCostAudit() {
  console.log('🎯 STARTING OPENAI COST AUDIT...');
  console.log('=' .repeat(50));

  try {
    // 1. Generate comprehensive audit report
    console.log('\n📊 GENERATING AUDIT REPORT...');
    const textReport = await costAuditDashboard.generateTextReport();
    console.log(textReport);

    // 2. Check for emergency stop condition
    console.log('\n🚨 CHECKING EMERGENCY CONDITIONS...');
    const isEmergencyStop = await openaiCostTracker.isEmergencyStop();
    if (isEmergencyStop) {
      console.log('🛑 EMERGENCY STOP ACTIVE - OpenAI usage temporarily blocked');
    } else {
      console.log('✅ EMERGENCY STOP: Not active');
    }

    // 3. Get detailed cost summary
    console.log('\n💰 DETAILED COST BREAKDOWN...');
    const summary = await openaiCostTracker.getCostSummary();
    
    console.log('\n🤖 TOP COST OPERATIONS:');
    summary.top_cost_operations.slice(0, 5).forEach((op, i) => {
      console.log(`${i + 1}. ${op.operation}: $${op.total_cost.toFixed(4)} (${op.request_count} requests)`);
    });

    console.log('\n⏰ HOURLY COST BREAKDOWN (Last 24h):');
    const significantHours = summary.hourly_breakdown.filter(h => h.cost > 0);
    significantHours.slice(-6).forEach(hour => {
      console.log(`${hour.hour}: $${hour.cost.toFixed(4)} (${hour.requests} requests)`);
    });

    console.log('\n🎯 MODEL USAGE ANALYSIS:');
    summary.model_usage.forEach(model => {
      const costPerToken = model.avg_tokens > 0 ? (model.total_cost / model.avg_tokens) * 1000 : 0;
      console.log(`${model.model}: $${model.total_cost.toFixed(4)} total, $${costPerToken.toFixed(6)}/1K tokens`);
    });

    // 4. Daily target analysis
    console.log('\n📈 BUDGET TARGET ANALYSIS...');
    const target = await openaiCostTracker.getDailyCostTarget();
    
    console.log(`Daily Target: $${target.target_daily_cost}`);
    console.log(`Current Spend: $${target.current_daily_cost.toFixed(4)}`);
    console.log(`Remaining: $${target.remaining_budget.toFixed(4)}`);
    console.log(`Projected Monthly: $${target.projected_monthly_cost.toFixed(2)}`);
    console.log(`Over Budget: ${target.is_over_budget ? 'YES 🚨' : 'NO ✅'}`);

    if (target.recommendations.length > 0) {
      console.log('\n🎯 RECOMMENDATIONS:');
      target.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }

    // 5. Generate savings opportunities
    console.log('\n💡 COST OPTIMIZATION OPPORTUNITIES...');
    const auditReport = await costAuditDashboard.generateAuditReport();
    
    if (auditReport.optimization_opportunities.length > 0) {
      auditReport.optimization_opportunities.forEach((opp, i) => {
        console.log(`\n${i + 1}. ${opp.area}:`);
        console.log(`   Current: $${opp.current_cost.toFixed(4)} | Target: $${opp.target_cost.toFixed(4)}`);
        console.log(`   Potential Savings: $${opp.potential_savings.toFixed(4)}`);
        console.log(`   Recommendation: ${opp.recommendation}`);
      });
    } else {
      console.log('✅ No major optimization opportunities found');
    }

    // 6. Efficiency analysis
    console.log('\n⚡ SYSTEM EFFICIENCY ANALYSIS...');
    console.log(`Overall Efficiency Score: ${auditReport.overview.efficiency_score}/100`);
    
    if (auditReport.overview.efficiency_score < 70) {
      console.log('🔴 EFFICIENCY ALERT: System is not cost-efficient');
      console.log('   Consider switching to gpt-4o-mini for most operations');
    } else if (auditReport.overview.efficiency_score < 85) {
      console.log('🟡 EFFICIENCY WARNING: Room for improvement');
    } else {
      console.log('🟢 EFFICIENCY EXCELLENT: System is cost-optimized');
    }

    // 7. Historical trend analysis
    console.log('\n📊 COST TREND ANALYSIS...');
    const trendingUp = auditReport.cost_trends.hourly_costs.filter(h => h.trend === 'up').length;
    const trendingDown = auditReport.cost_trends.hourly_costs.filter(h => h.trend === 'down').length;
    
    if (trendingUp > trendingDown) {
      console.log('📈 TREND: Costs trending upward - monitor closely');
    } else if (trendingDown > trendingUp) {
      console.log('📉 TREND: Costs trending downward - optimizations working');
    } else {
      console.log('➡️ TREND: Costs stable');
    }

    // 8. Summary and next actions
    console.log('\n' + '=' .repeat(50));
    console.log('🎯 AUDIT SUMMARY:');
    console.log(`Status: ${auditReport.overview.current_status.toUpperCase()}`);
    console.log(`Daily Spend: $${auditReport.overview.daily_spend.toFixed(4)} / $${auditReport.overview.daily_target}`);
    console.log(`Efficiency: ${auditReport.overview.efficiency_score}/100`);
    
    const totalPotentialSavings = auditReport.optimization_opportunities.reduce((sum, opp) => sum + opp.potential_savings, 0);
    if (totalPotentialSavings > 1.00) {
      console.log(`💰 Potential Daily Savings: $${totalPotentialSavings.toFixed(2)}`);
    }

    if (auditReport.alerts.length > 0) {
      console.log(`🚨 Active Alerts: ${auditReport.alerts.length}`);
      const criticalAlerts = auditReport.alerts.filter(a => a.severity === 'critical').length;
      if (criticalAlerts > 0) {
        console.log(`   ⚠️ ${criticalAlerts} CRITICAL alerts require immediate attention`);
      }
    }

    console.log('\n✅ COST AUDIT COMPLETE');

  } catch (error) {
    console.error('❌ COST AUDIT FAILED:', error);
    process.exit(1);
  }
}

// Command line arguments
const args = process.argv.slice(2);
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
🎯 OpenAI Cost Audit Tool

Usage: npm run cost:audit [options]

Options:
  --help, -h     Show this help message

Examples:
  npm run cost:audit                    # Run full cost audit
  npm run cost:audit > cost-report.txt # Save report to file

This tool provides comprehensive analysis of OpenAI API costs including:
- Real-time cost tracking and budget status
- Cost per operation (posts, replies, threads)
- Model usage efficiency analysis  
- Optimization recommendations
- Budget alerts and trend analysis
  `);
  process.exit(0);
}

// Run the audit
runCostAudit().catch(error => {
  console.error('💥 AUDIT SCRIPT ERROR:', error);
  process.exit(1);
});

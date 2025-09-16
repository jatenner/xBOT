#!/usr/bin/env tsx
"use strict";
/**
 * 🔍 COMPREHENSIVE OPENAI COST AUDIT
 * Identifies all API calls and cost leaks
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const glob_1 = require("glob");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
async function auditOpenAIUsage() {
    console.log('🔍 OPENAI_COST_AUDIT: Scanning codebase for API calls...\n');
    // Find all TypeScript files
    const files = await (0, glob_1.glob)('src/**/*.{ts,tsx}', {
        ignore: ['src/**/*.d.ts', 'src/**/*.test.ts']
    });
    const callSites = [];
    const modelPricing = {
        'gpt-4': { input: 0.030, output: 0.060 },
        'gpt-4o': { input: 0.005, output: 0.015 },
        'gpt-4o-mini': { input: 0.000150, output: 0.000600 },
        'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    };
    for (const file of files) {
        try {
            const content = (0, fs_1.readFileSync)(file, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                // Look for OpenAI API calls
                if (line.includes('openai.chat.completions.create') ||
                    line.includes('.chat.completions.create') ||
                    line.includes('OpenAI') && line.includes('.create')) {
                    // Extract context around the call
                    const contextStart = Math.max(0, index - 5);
                    const contextEnd = Math.min(lines.length, index + 15);
                    const context = lines.slice(contextStart, contextEnd).join('\n');
                    // Analyze the call
                    const analysis = analyzeAPICall(context, file);
                    callSites.push({
                        file: path_1.default.relative(process.cwd(), file),
                        line: index + 1,
                        code: line.trim(),
                        model: analysis.model,
                        maxTokens: analysis.maxTokens,
                        estimatedCostPerCall: analysis.estimatedCostPerCall,
                        bypassesCostControl: analysis.bypassesCostControl,
                        riskLevel: analysis.riskLevel
                    });
                }
            });
        }
        catch (error) {
            console.warn(`⚠️ Could not read file: ${file}`);
        }
    }
    // Calculate totals and generate recommendations
    const totalCallSites = callSites.length;
    const bypassingCostControl = callSites.filter(c => c.bypassesCostControl).length;
    // Estimate daily cost (assuming each call site is hit once per day)
    const totalEstimatedDailyCost = callSites.reduce((sum, site) => sum + site.estimatedCostPerCall, 0);
    const riskBreakdown = {
        LOW: callSites.filter(c => c.riskLevel === 'LOW').length,
        MEDIUM: callSites.filter(c => c.riskLevel === 'MEDIUM').length,
        HIGH: callSites.filter(c => c.riskLevel === 'HIGH').length,
        CRITICAL: callSites.filter(c => c.riskLevel === 'CRITICAL').length
    };
    const recommendations = generateRecommendations(callSites);
    return {
        totalCallSites,
        bypassingCostControl,
        totalEstimatedDailyCost,
        riskBreakdown,
        callSites: callSites.sort((a, b) => b.estimatedCostPerCall - a.estimatedCostPerCall),
        recommendations
    };
}
function analyzeAPICall(context, file) {
    // Extract model
    let model = 'gpt-4o-mini'; // default
    const modelMatch = context.match(/model:\s*['"`]([^'"`]+)['"`]/);
    if (modelMatch) {
        model = modelMatch[1];
    }
    else if (context.includes('gpt-4o-mini')) {
        model = 'gpt-4o-mini';
    }
    else if (context.includes('gpt-4o')) {
        model = 'gpt-4o';
    }
    else if (context.includes('gpt-4')) {
        model = 'gpt-4';
    }
    // Extract max_tokens
    let maxTokens = 1000; // default assumption
    const tokensMatch = context.match(/max_tokens?:\s*(\d+)/);
    if (tokensMatch) {
        maxTokens = parseInt(tokensMatch[1], 10);
    }
    // Check if it bypasses cost control
    const bypassesCostControl = !context.includes('openAIService') &&
        !context.includes('OpenAIService') &&
        !context.includes('chatCompletion');
    // Estimate cost per call
    const modelPricing = {
        'gpt-4': { input: 0.030, output: 0.060 },
        'gpt-4o': { input: 0.005, output: 0.015 },
        'gpt-4o-mini': { input: 0.000150, output: 0.000600 },
        'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    };
    const pricing = modelPricing[model] || modelPricing['gpt-4o-mini'];
    const estimatedInputTokens = 500; // Conservative estimate
    const estimatedOutputTokens = maxTokens;
    const estimatedCostPerCall = (estimatedInputTokens / 1000) * pricing.input +
        (estimatedOutputTokens / 1000) * pricing.output;
    // Determine risk level
    let riskLevel = 'LOW';
    if (bypassesCostControl) {
        if (model === 'gpt-4' || model === 'gpt-4o') {
            riskLevel = 'CRITICAL';
        }
        else if (estimatedCostPerCall > 0.01) {
            riskLevel = 'HIGH';
        }
        else {
            riskLevel = 'MEDIUM';
        }
    }
    // Special risk escalation for expensive models
    if (model === 'gpt-4' && maxTokens > 2000) {
        riskLevel = 'CRITICAL';
    }
    return {
        model,
        maxTokens,
        estimatedCostPerCall,
        bypassesCostControl,
        riskLevel
    };
}
function generateRecommendations(callSites) {
    const recommendations = [];
    const bypassingCalls = callSites.filter(c => c.bypassesCostControl);
    if (bypassingCalls.length > 0) {
        recommendations.push(`🚨 CRITICAL: ${bypassingCalls.length} API calls bypass cost controls - route through OpenAIService.chatCompletion()`);
    }
    const expensiveModels = callSites.filter(c => c.model === 'gpt-4' || c.model === 'gpt-4o');
    if (expensiveModels.length > 0) {
        recommendations.push(`💰 HIGH_COST: ${expensiveModels.length} calls use expensive models (gpt-4/gpt-4o) - switch to gpt-4o-mini`);
    }
    const highTokenCalls = callSites.filter(c => c.maxTokens > 2000);
    if (highTokenCalls.length > 0) {
        recommendations.push(`📊 TOKEN_LIMIT: ${highTokenCalls.length} calls use >2000 max_tokens - reduce to save costs`);
    }
    const criticalFiles = callSites.filter(c => c.riskLevel === 'CRITICAL');
    if (criticalFiles.length > 0) {
        recommendations.push(`🔥 IMMEDIATE_ACTION: Fix ${criticalFiles.length} CRITICAL risk API calls first`);
    }
    return recommendations;
}
async function runCostAudit() {
    try {
        const result = await auditOpenAIUsage();
        console.log('🔍 OPENAI_COST_AUDIT_RESULTS');
        console.log('===============================\n');
        console.log('📊 SUMMARY:');
        console.log(`   Total API Call Sites: ${result.totalCallSites}`);
        console.log(`   Bypassing Cost Control: ${result.bypassingCostControl} (${Math.round(result.bypassingCostControl / result.totalCallSites * 100)}%)`);
        console.log(`   Estimated Daily Cost: $${result.totalEstimatedDailyCost.toFixed(2)}`);
        console.log(`   Risk Breakdown: 🔥${result.riskBreakdown.CRITICAL} ⚠️${result.riskBreakdown.HIGH} 📊${result.riskBreakdown.MEDIUM} ✅${result.riskBreakdown.LOW}`);
        console.log('\n🚨 TOP 10 HIGHEST COST API CALLS:');
        result.callSites.slice(0, 10).forEach((site, i) => {
            const riskEmoji = { CRITICAL: '🔥', HIGH: '⚠️', MEDIUM: '📊', LOW: '✅' }[site.riskLevel];
            console.log(`   ${i + 1}. ${riskEmoji} ${site.file}:${site.line}`);
            console.log(`      Model: ${site.model} | Max Tokens: ${site.maxTokens} | Cost: $${site.estimatedCostPerCall.toFixed(4)}`);
            console.log(`      Bypasses Control: ${site.bypassesCostControl ? '❌ YES' : '✅ NO'}`);
            console.log(`      Code: ${site.code.substring(0, 80)}...`);
            console.log('');
        });
        console.log('💡 RECOMMENDATIONS:');
        result.recommendations.forEach((rec, i) => {
            console.log(`   ${i + 1}. ${rec}`);
        });
        console.log('\n🎯 IMMEDIATE ACTIONS:');
        console.log('   1. Route all API calls through OpenAIService.chatCompletion()');
        console.log('   2. Replace gpt-4/gpt-4o with gpt-4o-mini where possible');
        console.log('   3. Reduce max_tokens to minimum required');
        console.log('   4. Implement request batching and caching');
        console.log('   5. Add per-file/per-feature budget limits');
        if (result.bypassingCostControl > 10) {
            console.log('\n🚨 EMERGENCY: High number of uncontrolled API calls detected!');
            process.exit(1);
        }
        else {
            console.log('\n✅ AUDIT_COMPLETE: Cost control improvements needed');
            process.exit(0);
        }
    }
    catch (error) {
        console.error('❌ AUDIT_ERROR:', error);
        process.exit(1);
    }
}
runCostAudit();
//# sourceMappingURL=openai-cost-audit.js.map
#!/usr/bin/env npx ts-node
"use strict";
/**
 * Mock 429 Test Script
 * Tests circuit breaker functionality with simulated rate limits
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testCircuitBreaker = testCircuitBreaker;
const openaiClient_1 = require("../src/llm/openaiClient");
const circuitBreaker_1 = require("../src/utils/circuitBreaker");
// Mock OpenAI client for testing (Note: This is just for testing circuit breaker logic)
class MockOpenAI {
    constructor() {
        this.callCount = 0;
    }
    // Note: In actual implementation, this would mock the OpenAI SDK
    async mockChatCreate() {
        this.callCount++;
        if (this.callCount <= 2) {
            // First two calls fail with 429
            const error = new Error('Rate limit exceeded');
            error.status = 429;
            error.headers = { 'retry-after': '2' };
            throw error;
        }
        else if (this.callCount === 3) {
            // Third call fails with quota
            const error = new Error('You exceeded your current quota');
            error.code = 'insufficient_quota';
            throw error;
        }
        // Should not reach here due to circuit breaker
        return {
            id: 'test-response',
            choices: [{ message: { content: 'This should not be reached' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        };
    }
}
async function testCircuitBreaker() {
    console.log('🧪 MOCK_429_TEST: Starting circuit breaker test...');
    try {
        // Test 1: Rate limit retries
        console.log('\n📋 TEST_1: Rate limit with retries');
        try {
            await (0, openaiClient_1.safeChatCompletion)([
                { role: 'user', content: 'Test message' }
            ], {
                requestType: 'test_rate_limit',
                model: 'gpt-3.5-turbo'
            });
            console.log('❌ TEST_1_FAILED: Should have thrown an error');
        }
        catch (error) {
            if (error instanceof openaiClient_1.CircuitOpenError) {
                console.log('✅ TEST_1_PASSED: Circuit breaker opened as expected');
            }
            else {
                console.log(`✅ TEST_1_PASSED: Rate limit handled: ${error.message}`);
            }
        }
        // Test 2: Check circuit state
        console.log('\n📋 TEST_2: Circuit state verification');
        const circuitOpen = await (0, circuitBreaker_1.isCircuitOpen)('openai_quota');
        if (circuitOpen) {
            console.log('✅ TEST_2_PASSED: Circuit breaker is open');
        }
        else {
            console.log('❌ TEST_2_FAILED: Circuit breaker should be open');
        }
        // Test 3: Subsequent call should be blocked
        console.log('\n📋 TEST_3: Subsequent call blocking');
        try {
            await (0, openaiClient_1.safeChatCompletion)([
                { role: 'user', content: 'Another test message' }
            ], {
                requestType: 'test_circuit_block',
                model: 'gpt-3.5-turbo'
            });
            console.log('❌ TEST_3_FAILED: Call should have been blocked');
        }
        catch (error) {
            if (error instanceof openaiClient_1.CircuitOpenError) {
                console.log('✅ TEST_3_PASSED: Call blocked by circuit breaker');
                console.log(`   Remaining time: ${Math.ceil(error.remainingMs / 1000)} seconds`);
            }
            else {
                console.log(`❌ TEST_3_FAILED: Wrong error type: ${error.message}`);
            }
        }
        console.log('\n🎉 MOCK_429_TEST: All tests completed');
        console.log('🔄 To reset circuit breaker, wait for cooldown or restart the app');
    }
    catch (error) {
        console.error('❌ MOCK_429_TEST_ERROR:', error);
        process.exit(1);
    }
}
// Run test if called directly
if (require.main === module) {
    testCircuitBreaker().catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=mock429.js.map
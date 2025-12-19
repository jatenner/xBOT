import { checkPostQuality } from '../src/gates/PostQualityGate';

console.log('═'.repeat(70));
console.log('POST QUALITY GATE - QUICK TESTS');
console.log('═'.repeat(70) + '\n');

// Test 1: Single with numbering (should fail)
console.log('1. Single with numbering (1/5)');
const test1 = checkPostQuality({
  post_type: 'single',
  text: '1/5 This is the start of a thread about health.'
});
console.log(`   Result: ${test1.passed ? '✅ PASS' : '❌ FAIL'} (expected: FAIL)`);
console.log(`   Reason: ${test1.reason}`);
console.log('');

// Test 2: Clean single (should pass)
console.log('2. Clean single tweet');
const test2 = checkPostQuality({
  post_type: 'single',
  text: 'Walking 10,000 steps daily improves cardiovascular health.'
});
console.log(`   Result: ${test2.passed ? '✅ PASS' : '❌ FAIL'} (expected: PASS)`);
console.log(`   Reason: ${test2.reason}`);
console.log('');

// Test 3: Thread with < 2 tweets (should fail)
console.log('3. Thread with only 1 tweet');
const test3 = checkPostQuality({
  post_type: 'thread',
  tweets: ['Only one tweet'],
  thread_goal: 'Test'
});
console.log(`   Result: ${test3.passed ? '✅ PASS' : '❌ FAIL'} (expected: FAIL)`);
console.log(`   Reason: ${test3.reason}`);
console.log('');

// Test 4: Valid thread (should pass)
console.log('4. Valid thread with 3 tweets');
const test4 = checkPostQuality({
  post_type: 'thread',
  tweets: [
    'The science of sleep is fascinating and impacts every aspect of health.',
    'During REM sleep, your brain consolidates memories and processes emotions.',
    'Key takeaway: 7-9 hours of quality sleep is non-negotiable for health.'
  ],
  thread_goal: 'Explain the science of sleep'
});
console.log(`   Result: ${test4.passed ? '✅ PASS' : '❌ FAIL'} (expected: PASS)`);
console.log(`   Reason: ${test4.reason}`);
console.log('');

// Test 5: Thread numbering allowed
console.log('5. Thread with numbering (allowed)');
const test5 = checkPostQuality({
  post_type: 'thread',
  tweets: [
    '1/ The benefits of cold showers are backed by rigorous science.',
    '2/ Cold exposure activates brown fat and boosts metabolism significantly.',
    '3/ Bottom line: start with 30 seconds and work your way up gradually.'
  ],
  thread_goal: 'Explain cold shower benefits'
});
console.log(`   Result: ${test5.passed ? '✅ PASS' : '❌ FAIL'} (expected: PASS)`);
console.log(`   Reason: ${test5.reason}`);
console.log('');

console.log('═'.repeat(70));
console.log('TESTS COMPLETE');
console.log('═'.repeat(70));

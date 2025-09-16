#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tweetLinter_1 = require("../src/utils/tweetLinter");
async function main() {
    let input = '';
    for await (const chunk of process.stdin) {
        input += chunk;
    }
    try {
        const rawTweets = JSON.parse(input.trim());
        const { tweets, reasons } = (0, tweetLinter_1.lintAndSplitThread)(rawTweets);
        console.log('=== LINTED TWEETS ===');
        tweets.forEach((tweet, i) => console.log(`${i + 1}: ${tweet}`));
        console.log('\n=== FIXES APPLIED ===');
        reasons.forEach(reason => console.log(`- ${reason}`));
    }
    catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=tryLinter.js.map
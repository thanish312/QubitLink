const crypto = require('crypto');

/**
 * Cryptographically secure random integer generator
 * Uses crypto.randomBytes for unbiased distribution
 */
function secureRandomInt(min, max) {
    const range = max - min + 1;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const maxValue = Math.pow(256, bytesNeeded);
    const threshold = maxValue - (maxValue % range);
    
    let randomValue;
    do {
        const randomBytes = crypto.randomBytes(bytesNeeded);
        randomValue = 0;
        for (let i = 0; i < bytesNeeded; i++) {
            randomValue = (randomValue << 8) | randomBytes[i];
        }
    } while (randomValue >= threshold);
    
    return min + (randomValue % range);
}

/**
 * Rate limiting utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    secureRandomInt,
    sleep
};
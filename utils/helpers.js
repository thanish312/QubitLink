const crypto = require('crypto');

/**
 * Generates a cryptographically secure random integer within a given range.
 * This is important for generating challenge codes that are not predictable.
 * @param {number} min - The minimum value of the range (inclusive).
 * @param {number} max - The maximum value of the range (inclusive).
 * @returns {number} - A secure random integer.
 */
function secureRandomInt(min, max) {
    return crypto.randomInt(min, max + 1);
}

/**
 * A simple promise-based sleep function.
 * This is used for rate limiting to avoid overwhelming external APIs.
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} - A promise that resolves after the specified time.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    secureRandomInt,
    sleep,
};

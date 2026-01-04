const logger = require('./logger');

/**
 * Retries an async function in case of failure.
 * @param {() => Promise<T>} fn The async function to execute.
 * @param {string} jobName A name for the job for logging purposes.
 * @param {number} retries The maximum number of retries.
 * @param {number} delay The delay between retries in milliseconds.
 * @returns {Promise<T>}
 * @template T
 */
async function withRetry(
    fn,
    jobName = 'Unnamed Job',
    retries = 5,
    delay = 3000
) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            logger.warn(
                {
                    err: { message: error.message, code: error.code },
                    attempt: i + 1,
                    retries,
                    jobName,
                },
                `Attempt failed. Retrying in ${delay}ms...`
            );
            await new Promise((res) => setTimeout(res, delay * (i + 1))); // Exponential backoff
        }
    }
    logger.error(
        {
            err: { message: lastError.message, code: lastError.code },
            jobName,
        },
        `All ${retries} retries failed.`
    );
    throw lastError;
}

module.exports = { withRetry };

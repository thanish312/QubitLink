const { PrismaClient, Prisma } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Prisma Middleware for Serverless Connection Resiliency
prisma.$use(async (params, next) => {
    const maxRetries = 5; // Total 5 attempts
    const initialDelay = 1000; // 1 second

    for (let i = 0; i < maxRetries; i++) {
        try {
            // Attempt the actual query
            const result = await next(params);
            return result;
        } catch (err) {
            // Check for both common serverless connection error types
            const isConnectionError = 
                err.code === 'P1017' || 
                err instanceof Prisma.PrismaClientInitializationError;

            if (isConnectionError) {
                logger.warn(
                    { action: params.action, model: params.model, attempt: i + 1, maxRetries },
                    `Database did not connect. Retrying...`
                );
                // Exponential backoff
                await sleep(initialDelay * Math.pow(2, i));
            } else {
                // If it's a different error, don't retry, just throw it immediately
                throw err;
            }
        }
    }
    // If all retries fail, throw a final, clear error
    throw new Error(`Could not connect to the database after ${maxRetries} attempts.`);
});

// Optional: Add an explicit connection check at startup for an initial log message.
// This is fire-and-forget; the middleware handles the actual resiliency.
(async () => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        logger.info('Database connection successful.');
    } catch (e) {
        logger.warn('Initial database connection check failed. Will retry on first query.');
    }
})();


module.exports = { prisma };

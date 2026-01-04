require('dotenv').config();
const { z } = require('zod');

// Zod schema for environment variable validation
const envSchema = z.object({
    // Discord
    DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
    GUILD_ID: z.string().min(1, 'GUILD_ID is required'),
    CLIENT_ID: z.string().min(1, 'CLIENT_ID is required'),

    // Admin & API
    ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),
    ADMIN_JWT_SECRET: z.string().min(1, 'ADMIN_JWT_SECRET is required'),
    FRONTEND_URL: z
        .string()
        .url('FRONTEND_URL must be a valid URL')
        .min(1, 'FRONTEND_URL is required'),
    PORT: z.coerce.number().int().positive().default(3000),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error(
        '❌ Invalid environment variables:',
        Object.fromEntries(
            parsedEnv.error.issues.map((issue) => [
                issue.path.join('.'),
                issue.message,
            ])
        )
    );
    process.exit(1);
}

const env = parsedEnv.data;

// Configuration Constants
const CONFIG = {
    // From Environment
    DISCORD_TOKEN: env.DISCORD_TOKEN,
    GUILD_ID: env.GUILD_ID,
    CLIENT_ID: env.CLIENT_ID,
    ADMIN_PASSWORD: env.ADMIN_PASSWORD,
    ADMIN_JWT_SECRET: env.ADMIN_JWT_SECRET,
    FRONTEND_URL: env.FRONTEND_URL,
    PORT: env.PORT,

    // Qubic
    QUBIC_RPC_URL: 'https://rpc.qubic.org',

    // Application Constants
    CHALLENGE_EXPIRY_MS: 900000, // 15 minutes
    SIGNAL_CODE_MIN: 10000,
    SIGNAL_CODE_MAX: 99999,
    QUBIC_TO_USD: 0.0000006021,
    USD_TO_INR: 83,
    RATE_LIMIT_DELAY_MS: 200,

    // Job Schedules & Config
    CLEANUP_JOB_SCHEDULE: '0 * * * *', // Every hour
    PORTFOLIO_REFRESH_JOB_SCHEDULE: '*/30 * * * *', // Every 30 minutes
    PORTFOLIO_REFRESH_BATCH_SIZE: 20,
    PORTFOLIO_REFRESH_BATCH_DELAY_MS: 1000,

    // RPC Circuit Breaker Defaults
    RPC_FAILURE_THRESHOLD: 5, // Number of consecutive RPC failures before cooldown
    RPC_COOLDOWN_MS: 300000, // 5 minutes cooldown after RPC failures
};

module.exports = CONFIG;

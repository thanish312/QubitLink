require('dotenv').config();

// Configuration Constants
const CONFIG = {
    ROLES: {
        VERIFIED: process.env.VERIFIED_ROLE_ID,
        WHALE: process.env.WHALE_ROLE_ID
    },
    WHALE_THRESHOLD: 1000000000n,
    QUBIC_RPC_URL: 'https://rpc.qubic.org',
    CHALLENGE_EXPIRY_MS: 900000, // 15 minutes
    SIGNAL_CODE_MIN: 10000,
    SIGNAL_CODE_MAX: 99999,
    QUBIC_TO_USD: 0.0000006021,
    USD_TO_INR: 83,
    RATE_LIMIT_DELAY_MS: 200,
    GUILD_ID: process.env.GUILD_ID,
    CLIENT_ID: process.env.CLIENT_ID,
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CLEANUP_JOB_SCHEDULE: '0 * * * *', // Every hour
    PORTFOLIO_REFRESH_JOB_SCHEDULE: '*/30 * * * *', // Every 30 minutes
    PORTFOLIO_REFRESH_BATCH_SIZE: 20,
    PORTFOLIO_REFRESH_BATCH_DELAY_MS: 1000
};

module.exports = CONFIG;

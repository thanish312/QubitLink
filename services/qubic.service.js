const logger = require('../utils/logger');
const CONFIG = require('../config/config');

const RPC_TIMEOUT_MS = 10000; // 10 seconds

/**
 * A wrapper around fetch with a timeout.
 */
async function fetchWithTimeout(url, options = {}) {
    const { timeout = RPC_TIMEOUT_MS } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout / 1000}s`);
        }
        throw error;
    } finally {
        clearTimeout(id);
    }
}

/**
 * Validates the format of a Qubic wallet address.
 */
function isValidQubicAddress(address) {
    if (!address || typeof address !== 'string') return false;
    if (address.length !== 60) return false;
    return /^[A-Z]+$/.test(address);
}

/**
 * Fetches the on-chain balance for a Qubic wallet address.
 */
async function getQubicBalance(address) {
    const url = `${CONFIG.QUBIC_RPC_URL}/v1/balances/${address}`;
    try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) {
            logger.warn(
                { address, status: response.status, url },
                '[QubicService] getQubicBalance RPC returned non-ok status'
            );
            throw new Error(`RPC Error ${response.status}`);
        }
        const data = await response.json();
        return BigInt(data.balance?.balance || 0);
    } catch (error) {
        // Create a more structured error and re-throw it
        const serviceError = new Error(
            `[QubicService] Failed to get balance: ${error.message}`
        );
        serviceError.cause = { address, url, originalError: error };
        throw serviceError;
    }
}

/**
 * Verifies a transaction's authenticity via on-chain RPC.
 */
async function verifyTransactionOnChain(txId, expectedSource, expectedAmount) {
    const url = `${CONFIG.QUBIC_RPC_URL}/v1/transactions/${txId}`;
    try {
        logger.debug({ txId }, '[QubicService] Verifying transaction');

        const response = await fetchWithTimeout(url);
        if (!response.ok) {
            logger.warn(
                { txId, status: response.status, url },
                '[QubicService] verifyTransactionOnChain RPC returned non-ok status'
            );
            return false;
        }

        const rpcResponse = await response.json();
        const onChainTx = rpcResponse.transaction;

        if (!onChainTx) {
            logger.warn(
                { txId, url },
                '[QubicService] No transaction data found on-chain'
            );
            return false;
        }

        const sourceMatch =
            String(onChainTx.sourceId).trim() === String(expectedSource).trim();
        const amountMatch = String(onChainTx.amount) === String(expectedAmount);

        if (!sourceMatch || !amountMatch) {
            logger.warn(
                {
                    txId,
                    expected: {
                        source: expectedSource,
                        amount: expectedAmount,
                    },
                    onChain: {
                        source: onChainTx.sourceId,
                        amount: onChainTx.amount,
                    },
                },
                '[QubicService] Semantic mismatch detected for transaction'
            );
            return false;
        }

        logger.info(
            { txId },
            '[QubicService] Transaction verified successfully'
        );
        return true;
    } catch (error) {
        logger.error(
            { err: error, txId, url },
            '[QubicService] RPC verification critical error'
        );
        return false;
    }
}

module.exports = {
    isValidQubicAddress,
    getQubicBalance,
    verifyTransactionOnChain,
};

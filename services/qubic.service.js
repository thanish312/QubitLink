const CONFIG = require('../config/config');

/**
 * Validates the format of a Qubic wallet address.
 * A valid address must be exactly 60 uppercase letters (A-Z).
 * @param {string} address - The Qubic wallet address to validate.
 * @returns {boolean} - True if the address is valid, false otherwise.
 */
function isValidQubicAddress(address) {
    if (!address || typeof address !== 'string') return false;
    if (address.length !== 60) return false;
    return /^[A-Z]+$/.test(address);
}

/**
 * Fetches the on-chain balance for a Qubic wallet address.
 * @param {string} address - The Qubic wallet address.
 * @returns {Promise<bigint>} - The balance of the wallet as a BigInt.
 * @throws {Error} - Throws an error if the RPC request fails.
 */
async function getQubicBalance(address) {
    try {
        const response = await fetch(`${CONFIG.QUBIC_RPC_URL}/v1/balances/${address}`);
        if (!response.ok) {
            throw new Error(`RPC Error ${response.status}`);
        }
        const data = await response.json();
        return BigInt(data.balance?.balance || 0);
    } catch (error) {
        // Re-throw the error so the calling function knows to abort
        throw new Error(`[QubicService] Failed to get balance for ${address.substring(0, 12)}...: ${error.message}`);
    }
}

/**
 * Verifies a transaction's authenticity via on-chain RPC.
 * @param {string} txId - The transaction ID to verify.
 * @param {string} expectedSource - The expected source address of the transaction.
 * @param {number|string} expectedAmount - The expected amount of the transaction.
 * @returns {Promise<boolean>} - True if the transaction is valid, false otherwise.
 */
async function verifyTransactionOnChain(txId, expectedSource, expectedAmount) {
    try {
        console.info(`[QubicService] Verifying transaction: ${txId.substring(0,12)}...`);
        
        const response = await fetch(`${CONFIG.QUBIC_RPC_URL}/v1/transactions/${txId}`);
        if (!response.ok) {
            console.warn(`[QubicService] RPC returned ${response.status} for ${txId.substring(0,12)}...`);
            return false;
        }
        
        const rpcResponse = await response.json();
        const onChainTx = rpcResponse.transaction;
        
        if (!onChainTx) {
            console.warn(`[QubicService] No transaction data found on-chain for ${txId.substring(0,12)}...`);
            return false;
        }

        // FIXED: Convert both sides to String to prevent Type Mismatches (Number vs String)
        const sourceMatch = String(onChainTx.sourceId).trim() === String(expectedSource).trim();
        const amountMatch = String(onChainTx.amount) === String(expectedAmount);

        if (!sourceMatch || !amountMatch) {
            console.warn(`[QubicService] Semantic mismatch detected for txId: ${txId.substring(0,12)}...`);
            // Logs now show types clearly to help debugging in future
            console.warn(`  Expected: source=${expectedSource.substring(0,12)}... (Type: ${typeof expectedSource}), amount=${expectedAmount} (Type: ${typeof expectedAmount})`);
            console.warn(`  On-chain: source=${onChainTx.sourceId.substring(0,12)}... (Type: ${typeof onChainTx.sourceId}), amount=${onChainTx.amount} (Type: ${typeof onChainTx.amount})`);
            return false;
        }

        console.info(`[QubicService] Transaction verified successfully: ${txId.substring(0,12)}...`);
        return true;
    } catch (error) {
        console.error(`[QubicService] RPC verification error for txId: ${txId.substring(0,12)}...: ${error.message}`);
        return false;
    }
}

module.exports = {
    isValidQubicAddress,
    getQubicBalance,
    verifyTransactionOnChain
};
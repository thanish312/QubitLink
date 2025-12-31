const CONFIG = require('../config/config');

/**
 * Validates Qubic wallet address format
 * Must be exactly 60 uppercase letters (A-Z)
 */
function isValidQubicAddress(address) {
    if (!address || typeof address !== 'string') return false;
    if (address.length !== 60) return false;
    return /^[A-Z]+$/.test(address);
}

/**
 * Fetches on-chain balance for a Qubic wallet address
 */
async function getQubicBalance(address) {
    try {
        const response = await fetch(`${CONFIG.QUBIC_RPC_URL}/v1/balances/${address}`);
        if (!response.ok) {
            console.warn(`Balance API returned ${response.status} for ${address.substring(0,8)}...`);
            return 0n;
        }
        const data = await response.json();
        return BigInt(data.balance?.balance || 0);
    } catch (error) {
        console.error(`Balance fetch failed for ${address.substring(0,8)}...: ${error.message}`);
        return 0n;
    }
}

/**
 * Layer 2: Verifies transaction authenticity via on-chain RPC
 */
async function verifyTransactionOnChain(txId, expectedSource, expectedAmount) {
    try {
        console.info(`[Layer 2] Verifying transaction: ${txId.substring(0,12)}...`);
        
        const response = await fetch(`${CONFIG.QUBIC_RPC_URL}/v1/transactions/${txId}`);
        if (!response.ok) {
            console.warn(`[Layer 2] RPC returned ${response.status} for ${txId.substring(0,12)}...`);
            return false;
        }
        
        const rpcResponse = await response.json();
        const onChainTx = rpcResponse.transaction;
        
        if (!onChainTx) {
            console.warn(`[Layer 2] No transaction data found on-chain for ${txId.substring(0,12)}...`);
            return false;
        }

        const sourceMatch = onChainTx.sourceId === expectedSource;
        const amountMatch = onChainTx.amount === expectedAmount;

        if (!sourceMatch || !amountMatch) {
            console.warn(`[Layer 2] Semantic mismatch detected:`);
            console.warn(`  Expected: source=${expectedSource.substring(0,12)}..., amount=${expectedAmount}`);
            console.warn(`  On-chain: source=${onChainTx.sourceId.substring(0,12)}..., amount=${onChainTx.amount}`);
            return false;
        }

        console.info(`[Layer 2] Transaction verified successfully`);
        return true;
    } catch (error) {
        console.error(`[Layer 2] RPC verification error: ${error.message}`);
        return false;
    }
}

module.exports = {
    isValidQubicAddress,
    getQubicBalance,
    verifyTransactionOnChain
};
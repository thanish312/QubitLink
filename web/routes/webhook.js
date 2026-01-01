const express = require('express');
const crypto = require('crypto');
const { processWebhook } = require('../services/webhook.service');

const router = express.Router();

/**
 * Webhook endpoint for EasyConnect transaction notifications
 */
router.post('/qubic', (req, res) => {
    const requestId = crypto.randomBytes(4).toString('hex');
    console.info(`[${requestId}] Webhook request received`);

    // Acknowledge the request immediately to prevent timeouts
    res.status(200).json({
        success: true, 
        message: "Webhook received and is being processed.",
        requestId 
    });

    // Process the webhook in the background
    processWebhook(req, requestId).catch(error => {
        console.error(`[${requestId}] Unhandled error in background webhook processing:`, error);
    });
});

module.exports = router;

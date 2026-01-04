const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');
const express = require('express');
const crypto = require('crypto');
const { processWebhook } = require('../services/webhook.service');

const router = express.Router();

/**
 * Webhook endpoint for EasyConnect transaction notifications
 */
router.post(
    '/qubic',
    asyncHandler(async (req, res) => {
        const requestId = crypto.randomBytes(4).toString('hex');
        logger.info({ requestId }, 'Webhook request received');

        // Acknowledge the request immediately to prevent timeouts
        res.status(200).json({
            success: true,
            message: 'Webhook received and is being processed.',
            requestId,
        });

        // Process the webhook in the background
        await processWebhook(req, requestId);
    })
);

module.exports = router;

const { z } = require('zod');

// Webhook Payload Schema
const easyConnectSchema = z.object({
    ProcedureTypeName: z.string(),
    ProcedureTypeValue: z.number().int(),
    RawTransaction: z.object({
        transaction: z.object({
            sourceId: z.string().regex(/^[A-Z2-7]{52,60}$/),
            destId: z.string().regex(/^[A-Z2-7]{52,60}$/),
            amount: z.string().regex(/^\d+$/),
            tickNumber: z.number().int().positive(),
            inputType: z.number().int(),
            inputSize: z.number().int(),
            inputHex: z.string(),
            signatureHex: z.string(),
            txId: z.string().length(60)
        }),
        timestamp: z.string(),
        moneyFlew: z.boolean()
    }),
    ParsedTransaction: z.object({
        IssuerAddress: z.string(),
        AssetName: z.string(),
        Price: z.number(),
        NumberOfShares: z.number()
    })
}).strict();

module.exports = easyConnectSchema;

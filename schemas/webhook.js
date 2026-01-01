const { z } = require('zod');

/**
 * Zod schema for the EasyConnect webhook payload.
 * This schema validates the structure and types of the incoming data.
 */
const easyConnectSchema = z.object({
    ProcedureTypeName: z.string(),
    ProcedureTypeValue: z.number().int(),
    RawTransaction: z.object({
        transaction: z.object({
            sourceId: z.string().regex(/^[A-Z]{60}$/, "Invalid Qubic address format"),
            destId: z.string().regex(/^[A-Z]{60}$/, "Invalid Qubic address format"),
            amount: z.string().regex(/^\d+$/).transform(BigInt),
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

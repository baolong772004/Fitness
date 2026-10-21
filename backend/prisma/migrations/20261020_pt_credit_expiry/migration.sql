-- Existing products and credit batches retain NULL duration/endAt until an explicit policy is approved.
ALTER TABLE [dbo].[PtProduct] ADD [durationDays] INT NULL;
ALTER TABLE [dbo].[PtCreditBatch] ADD [startAt] DATETIME2 NULL, [endAt] DATETIME2 NULL, [activatedAt] DATETIME2 NULL;
ALTER TABLE [dbo].[Payment] ADD [ptLevelSnapshot] VARCHAR(20) NULL, [ptSessionsSnapshot] INT NULL, [ptDurationDays] INT NULL;

CREATE NONCLUSTERED INDEX [PtCreditBatch_walletId_level_endAt_idx]
ON [dbo].[PtCreditBatch]([walletId], [level], [endAt]);

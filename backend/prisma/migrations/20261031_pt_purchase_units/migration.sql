BEGIN TRY
BEGIN TRAN;

-- Existing payments each own at most one batch; index 0 preserves their identity.
ALTER TABLE [dbo].[PtCreditBatch] ADD [purchaseUnitIndex] INT NOT NULL
  CONSTRAINT [PtCreditBatch_purchaseUnitIndex_df] DEFAULT 0;

DROP INDEX [PtCreditBatch_paymentId_key] ON [dbo].[PtCreditBatch];
CREATE UNIQUE NONCLUSTERED INDEX [PtCreditBatch_paymentId_purchaseUnitIndex_key]
  ON [dbo].[PtCreditBatch]([paymentId], [purchaseUnitIndex])
  WHERE [paymentId] IS NOT NULL;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH

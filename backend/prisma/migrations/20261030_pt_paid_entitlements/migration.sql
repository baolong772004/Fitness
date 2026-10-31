BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[PtProduct] ADD [singleSessionPrice] DECIMAL(18,2);
ALTER TABLE [dbo].[Payment] ADD [ptPurchaseMode] VARCHAR(20);

CREATE TABLE [dbo].[PtCoachChangeRequest] (
  [id] INT NOT NULL IDENTITY(1,1),
  [batchId] INT NOT NULL,
  [memberId] INT NOT NULL,
  [oldCoachId] INT NOT NULL,
  [newCoachId] INT NOT NULL,
  [reason] NVARCHAR(500) NOT NULL,
  [status] VARCHAR(20) NOT NULL CONSTRAINT [PtCoachChangeRequest_status_df] DEFAULT 'PENDING_ADMIN',
  [quotaExempt] BIT NOT NULL CONSTRAINT [PtCoachChangeRequest_quotaExempt_df] DEFAULT 0,
  [handledById] INT,
  [adminNote] NVARCHAR(500),
  [requestedAt] DATETIME2 NOT NULL CONSTRAINT [PtCoachChangeRequest_requestedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [handledAt] DATETIME2,
  CONSTRAINT [PtCoachChangeRequest_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [PtCoachChangeRequest_status_check] CHECK ([status] IN ('PENDING_ADMIN','APPROVED','REJECTED'))
);
ALTER TABLE [dbo].[PtCoachChangeRequest] ADD CONSTRAINT [PtCoachChangeRequest_batchId_fkey]
  FOREIGN KEY ([batchId]) REFERENCES [dbo].[PtCreditBatch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE NONCLUSTERED INDEX [PtCoachChangeRequest_memberId_requestedAt_idx] ON [dbo].[PtCoachChangeRequest]([memberId],[requestedAt]);
CREATE NONCLUSTERED INDEX [PtCoachChangeRequest_status_requestedAt_idx] ON [dbo].[PtCoachChangeRequest]([status],[requestedAt]);
CREATE NONCLUSTERED INDEX [PtCoachChangeRequest_batchId_status_idx] ON [dbo].[PtCoachChangeRequest]([batchId],[status]);
CREATE UNIQUE NONCLUSTERED INDEX [PtCoachChangeRequest_one_pending] ON [dbo].[PtCoachChangeRequest]([batchId]) WHERE [status] = 'PENDING_ADMIN';

-- Legacy paid batches become bound to the Coach of their earliest actual PT booking.
-- Existing bookings retain their original Coach and are never moved by this migration.
WITH first_coach AS (
  SELECT allocation.[batchId], booking.[coachId],
    ROW_NUMBER() OVER (PARTITION BY allocation.[batchId] ORDER BY booking.[startTime], booking.[id]) AS rn
  FROM [dbo].[PtBookingCreditAllocation] allocation
  JOIN [dbo].[Booking] booking ON booking.[id] = allocation.[bookingId]
  WHERE booking.[coachId] IS NOT NULL AND booking.[type] = 'PT'
)
UPDATE batch SET [coachId] = first_coach.[coachId]
FROM [dbo].[PtCreditBatch] batch
JOIN first_coach ON first_coach.[batchId] = batch.[id] AND first_coach.rn = 1
WHERE batch.[coachId] IS NULL AND batch.[source] IN ('PACKAGE_PURCHASE', 'SINGLE_PURCHASE');

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH

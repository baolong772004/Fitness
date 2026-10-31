CREATE TABLE [dbo].[PtRenewalOption] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [level] VARCHAR(20) NOT NULL,
    [durationDays] INT NOT NULL,
    [price] DECIMAL(18,2) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [PtRenewalOption_isActive_df] DEFAULT 1,
    CONSTRAINT [PtRenewalOption_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PtRenewalOption_positive_duration] CHECK ([durationDays] > 0),
    CONSTRAINT [PtRenewalOption_positive_price] CHECK ([price] > 0)
);

ALTER TABLE [dbo].[Payment] ADD [ptRenewalOptionId] INT NULL, [ptRenewalBatchId] INT NULL, [ptRenewalDays] INT NULL;

ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_ptRenewalOptionId_fkey]
FOREIGN KEY ([ptRenewalOptionId]) REFERENCES [dbo].[PtRenewalOption]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_ptRenewalBatchId_fkey]
FOREIGN KEY ([ptRenewalBatchId]) REFERENCES [dbo].[PtCreditBatch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [Payment_ptRenewalBatchId_idx] ON [dbo].[Payment]([ptRenewalBatchId]);

CREATE TABLE [dbo].[PtRenewalEvent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [batchId] INT NOT NULL,
    [paymentId] INT NOT NULL,
    [previousEndAt] DATETIME2 NOT NULL,
    [startAt] DATETIME2 NOT NULL,
    [endAt] DATETIME2 NOT NULL,
    [durationDays] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PtRenewalEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PtRenewalEvent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PtRenewalEvent_paymentId_key] UNIQUE NONCLUSTERED ([paymentId])
);
ALTER TABLE [dbo].[PtRenewalEvent] ADD CONSTRAINT [PtRenewalEvent_batchId_fkey]
FOREIGN KEY ([batchId]) REFERENCES [dbo].[PtCreditBatch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PtRenewalEvent] ADD CONSTRAINT [PtRenewalEvent_paymentId_fkey]
FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE NONCLUSTERED INDEX [PtRenewalEvent_batchId_createdAt_idx] ON [dbo].[PtRenewalEvent]([batchId], [createdAt]);

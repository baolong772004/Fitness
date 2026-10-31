BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[PtProduct] ADD [benefits] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[PtCreditBatch] ADD [ptProductIdSnapshot] INT NULL;
ALTER TABLE [dbo].[PtCreditBatch] ADD [benefitsSnapshot] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[PtRenewalOption] ADD [purchaseMode] VARCHAR(20) NULL;
EXEC(N'UPDATE [batch] SET [ptProductIdSnapshot] = [payment].[ptProductId] FROM [dbo].[PtCreditBatch] AS [batch] JOIN [dbo].[Payment] AS [payment] ON [payment].[id] = [batch].[paymentId] WHERE [payment].[ptProductId] IS NOT NULL;');

CREATE TABLE [dbo].[PtSingleOffer] (
  [id] INT NOT NULL IDENTITY(1,1),
  [level] VARCHAR(20) NOT NULL,
  [price] DECIMAL(18,2) NOT NULL,
  [durationDays] INT NOT NULL,
  [maxQuantity] INT NOT NULL CONSTRAINT [PtSingleOffer_maxQuantity_df] DEFAULT 20,
  [benefits] NVARCHAR(1000) NULL,
  [isActive] BIT NOT NULL CONSTRAINT [PtSingleOffer_isActive_df] DEFAULT 1,
  CONSTRAINT [PtSingleOffer_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [PtSingleOffer_level_key] UNIQUE NONCLUSTERED ([level])
);

-- Preserve an existing sale price for each level without changing past orders.
INSERT INTO [dbo].[PtSingleOffer] ([level], [price], [durationDays])
SELECT [level], [singleSessionPrice], [durationDays]
FROM (
  SELECT [level], [singleSessionPrice], [durationDays],
    ROW_NUMBER() OVER (PARTITION BY [level] ORDER BY [isActive] DESC, [id] ASC) AS [rn]
  FROM [dbo].[PtProduct]
  WHERE [level] IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')
    AND [singleSessionPrice] > 0 AND [durationDays] > 0
) AS [legacy]
WHERE [rn] = 1;

CREATE TABLE [dbo].[PtPurchaseItem] (
  [id] INT NOT NULL IDENTITY(1,1),
  [paymentId] INT NOT NULL,
  [productId] INT NULL,
  [mode] VARCHAR(20) NOT NULL,
  [nameSnapshot] NVARCHAR(100) NOT NULL,
  [levelSnapshot] VARCHAR(20) NOT NULL,
  [sessionsSnapshot] INT NOT NULL,
  [durationDays] INT NOT NULL,
  [unitPrice] DECIMAL(18,2) NOT NULL,
  [quantity] INT NOT NULL,
  [benefitsSnapshot] NVARCHAR(1000) NULL,
  [unitStartIndex] INT NOT NULL,
  CONSTRAINT [PtPurchaseItem_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [PtPurchaseItem_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]),
  CONSTRAINT [PtPurchaseItem_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[PtProduct]([id])
);
CREATE UNIQUE NONCLUSTERED INDEX [PtPurchaseItem_paymentId_unitStartIndex_key]
  ON [dbo].[PtPurchaseItem]([paymentId], [unitStartIndex]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH

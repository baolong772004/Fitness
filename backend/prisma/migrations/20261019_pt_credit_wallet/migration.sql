BEGIN TRY
  BEGIN TRAN;

  ALTER TABLE [dbo].[Package] ADD [ptLevel] VARCHAR(20) NULL;
  ALTER TABLE [dbo].[Payment] ADD [ptProductId] INT NULL, [ptQuantity] INT NULL;

  CREATE TABLE [dbo].[CoachSpecialization] (
    [coachProfileId] INT NOT NULL,
    [level] VARCHAR(20) NOT NULL,
    CONSTRAINT [CoachSpecialization_pkey] PRIMARY KEY CLUSTERED ([coachProfileId], [level]),
    CONSTRAINT [CoachSpecialization_coachProfileId_fkey] FOREIGN KEY ([coachProfileId]) REFERENCES [dbo].[CoachProfile]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT [CoachSpecialization_level_check] CHECK ([level] IN ('TRIAL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'))
  );

  CREATE TABLE [dbo].[PtProduct] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [level] VARCHAR(20) NOT NULL,
    [sessionCount] INT NOT NULL,
    [price] DECIMAL(18,2) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [PtProduct_isActive_df] DEFAULT 1,
    [packageId] INT NULL,
    CONSTRAINT [PtProduct_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PtProduct_packageId_fkey] FOREIGN KEY ([packageId]) REFERENCES [dbo].[Package]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [PtProduct_level_check] CHECK ([level] IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    CONSTRAINT [PtProduct_values_check] CHECK ([sessionCount] > 0 AND [price] > 0)
  );
  CREATE UNIQUE NONCLUSTERED INDEX [PtProduct_packageId_key] ON [dbo].[PtProduct]([packageId]) WHERE [packageId] IS NOT NULL;
  EXEC(N'ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_ptProductId_fkey] FOREIGN KEY ([ptProductId]) REFERENCES [dbo].[PtProduct]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION');
  EXEC(N'ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_ptQuantity_check] CHECK ([ptQuantity] IS NULL OR [ptQuantity] BETWEEN 1 AND 20)');

  CREATE TABLE [dbo].[PtWallet] (
    [id] INT NOT NULL IDENTITY(1,1),
    [memberId] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PtWallet_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PtWallet_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PtWallet_memberId_key] UNIQUE NONCLUSTERED ([memberId]),
    CONSTRAINT [PtWallet_memberId_fkey] FOREIGN KEY ([memberId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  );

  CREATE TABLE [dbo].[PtCreditBatch] (
    [id] INT NOT NULL IDENTITY(1,1),
    [walletId] INT NOT NULL,
    [level] VARCHAR(20) NOT NULL,
    [source] VARCHAR(30) NOT NULL,
    [initialCount] INT NOT NULL,
    [usedCount] INT NOT NULL CONSTRAINT [PtCreditBatch_usedCount_df] DEFAULT 0,
    [heldCount] INT NOT NULL CONSTRAINT [PtCreditBatch_heldCount_df] DEFAULT 0,
    [paymentId] INT NULL,
    [membershipId] INT NULL,
    [coachId] INT NULL,
    [grantedAt] DATETIME2 NOT NULL CONSTRAINT [PtCreditBatch_grantedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PtCreditBatch_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PtCreditBatch_walletId_fkey] FOREIGN KEY ([walletId]) REFERENCES [dbo].[PtWallet]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [PtCreditBatch_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [PtCreditBatch_membershipId_fkey] FOREIGN KEY ([membershipId]) REFERENCES [dbo].[Membership]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [PtCreditBatch_level_check] CHECK ([level] IN ('TRIAL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    CONSTRAINT [PtCreditBatch_balance_check] CHECK ([initialCount] >= 0 AND [usedCount] >= 0 AND [heldCount] >= 0 AND [usedCount] + [heldCount] <= [initialCount])
  );
  CREATE INDEX [PtCreditBatch_walletId_level_grantedAt_idx] ON [dbo].[PtCreditBatch]([walletId], [level], [grantedAt]);
  CREATE UNIQUE INDEX [PtCreditBatch_paymentId_key] ON [dbo].[PtCreditBatch]([paymentId]) WHERE [paymentId] IS NOT NULL;
  CREATE UNIQUE INDEX [UX_PtCreditBatch_TrialMembership] ON [dbo].[PtCreditBatch]([membershipId]) WHERE [membershipId] IS NOT NULL AND [source] = 'MEMBERSHIP_GIFT';
  CREATE UNIQUE INDEX [UX_PtCreditBatch_LegacyMembership] ON [dbo].[PtCreditBatch]([membershipId]) WHERE [membershipId] IS NOT NULL AND [source] = 'LEGACY_PT';

  CREATE TABLE [dbo].[PtBookingCreditAllocation] (
    [bookingId] INT NOT NULL,
    [batchId] INT NOT NULL,
    [status] VARCHAR(20) NOT NULL CONSTRAINT [PtBookingCreditAllocation_status_df] DEFAULT 'HELD',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PtBookingCreditAllocation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PtBookingCreditAllocation_pkey] PRIMARY KEY CLUSTERED ([bookingId]),
    CONSTRAINT [PtBookingCreditAllocation_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[Booking]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [PtBookingCreditAllocation_batchId_fkey] FOREIGN KEY ([batchId]) REFERENCES [dbo].[PtCreditBatch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [PtBookingCreditAllocation_status_check] CHECK ([status] IN ('HELD', 'CONSUMED', 'RELEASED'))
  );
  CREATE INDEX [PtBookingCreditAllocation_batchId_status_idx] ON [dbo].[PtBookingCreditAllocation]([batchId], [status]);

  CREATE TABLE [dbo].[PtCreditTransaction] (
    [id] INT NOT NULL IDENTITY(1,1),
    [batchId] INT NOT NULL,
    [bookingId] INT NULL,
    [kind] VARCHAR(30) NOT NULL,
    [quantity] INT NOT NULL,
    [actorId] INT NULL,
    [note] NVARCHAR(500) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PtCreditTransaction_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PtCreditTransaction_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PtCreditTransaction_batchId_fkey] FOREIGN KEY ([batchId]) REFERENCES [dbo].[PtCreditBatch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [PtCreditTransaction_quantity_check] CHECK ([quantity] > 0)
  );
  CREATE INDEX [PtCreditTransaction_batchId_createdAt_idx] ON [dbo].[PtCreditTransaction]([batchId], [createdAt]);
  CREATE INDEX [PtCreditTransaction_bookingId_idx] ON [dbo].[PtCreditTransaction]([bookingId]);

  -- Only literal legacy level labels are safe to infer. Other rows require an admin mapping.
  EXEC(N'UPDATE [dbo].[Package] SET [ptLevel] = UPPER(LTRIM(RTRIM([name])))
    WHERE [type] = ''PT'' AND UPPER(LTRIM(RTRIM([name]))) IN (''BEGINNER'', ''INTERMEDIATE'', ''ADVANCED'')');
  INSERT INTO [dbo].[CoachSpecialization] ([coachProfileId], [level])
    SELECT [id], UPPER(LTRIM(RTRIM([specialization]))) FROM [dbo].[CoachProfile]
    WHERE UPPER(LTRIM(RTRIM([specialization]))) IN ('TRIAL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED');

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;

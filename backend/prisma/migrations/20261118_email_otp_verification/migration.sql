BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[User] ADD [emailVerified] BIT NOT NULL CONSTRAINT [User_emailVerified_df] DEFAULT 1;

CREATE TABLE [dbo].[EmailOtp] (
  [id] INT NOT NULL IDENTITY(1,1),
  [email] NVARCHAR(255) NOT NULL,
  [purpose] VARCHAR(32) NOT NULL,
  [codeHash] VARCHAR(128) NOT NULL,
  [attempts] INT NOT NULL CONSTRAINT [EmailOtp_attempts_df] DEFAULT 0,
  [expiresAt] DATETIME2 NOT NULL,
  [verifiedAt] DATETIME2,
  [usedAt] DATETIME2,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmailOtp_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [EmailOtp_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE INDEX [EmailOtp_email_purpose_createdAt_idx] ON [dbo].[EmailOtp]([email], [purpose], [createdAt]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0 ROLLBACK TRAN;
THROW;

END CATCH

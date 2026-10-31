BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[CoachProfile] ADD [commissionPercent] INT NOT NULL CONSTRAINT [CoachProfile_commissionPercent_df] DEFAULT 45,
[rank] NVARCHAR(1000) NOT NULL CONSTRAINT [CoachProfile_rank_df] DEFAULT 'senior';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

BEGIN TRY

BEGIN TRAN;

CREATE TABLE [dbo].[PtTrainingAssessment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [memberId] INT NOT NULL,
    [coachId] INT NOT NULL,
    [level] VARCHAR(20) NOT NULL,
    [kind] VARCHAR(20) NOT NULL,
    [goal] NVARCHAR(500),
    [movementNotes] NVARCHAR(2000),
    [metricName] NVARCHAR(100),
    [metricValue] FLOAT(53),
    [phaseName] NVARCHAR(100),
    [nextSteps] NVARCHAR(2000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PtTrainingAssessment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PtTrainingAssessment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PtTrainingAssessment_level_check] CHECK ([level] IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    CONSTRAINT [PtTrainingAssessment_kind_check] CHECK ([kind] IN ('BASELINE', 'REVIEW'))
);

CREATE NONCLUSTERED INDEX [PtTrainingAssessment_memberId_coachId_level_createdAt_idx]
    ON [dbo].[PtTrainingAssessment]([memberId], [coachId], [level], [createdAt]);

CREATE UNIQUE NONCLUSTERED INDEX [PtTrainingAssessment_one_baseline]
    ON [dbo].[PtTrainingAssessment]([memberId], [coachId], [level]) WHERE [kind] = 'BASELINE';

ALTER TABLE [dbo].[PtTrainingAssessment] ADD CONSTRAINT [PtTrainingAssessment_memberId_fkey]
    FOREIGN KEY ([memberId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[PtTrainingAssessment] ADD CONSTRAINT [PtTrainingAssessment_coachId_fkey]
    FOREIGN KEY ([coachId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH

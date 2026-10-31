BEGIN TRY
BEGIN TRAN;
CREATE TABLE [dbo].[ExerciseAnalysis] (
  [id] INT NOT NULL IDENTITY(1,1),
  [memberId] INT NOT NULL,
  [studentPlanId] INT,
  [exerciseType] VARCHAR(30) NOT NULL,
  [mediaStorageKey] VARCHAR(100),
  [mediaDeletedAt] DATETIME2,
  [status] VARCHAR(30) NOT NULL CONSTRAINT [ExerciseAnalysis_status_df] DEFAULT 'PENDING',
  [resultJson] NVARCHAR(MAX),
  [modelVersion] VARCHAR(100),
  [ruleVersion] VARCHAR(30),
  [errorCode] VARCHAR(60),
  [attempts] INT NOT NULL CONSTRAINT [ExerciseAnalysis_attempts_df] DEFAULT 0,
  [startedAt] DATETIME2,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExerciseAnalysis_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [completedAt] DATETIME2,
  CONSTRAINT [ExerciseAnalysis_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [ExerciseAnalysis_memberId_fkey] FOREIGN KEY ([memberId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ExerciseAnalysis_studentPlanId_fkey] FOREIGN KEY ([studentPlanId]) REFERENCES [dbo].[StudentWorkoutPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [ExerciseAnalysis_memberId_createdAt_idx] ON [dbo].[ExerciseAnalysis]([memberId], [createdAt]);
CREATE INDEX [ExerciseAnalysis_status_createdAt_idx] ON [dbo].[ExerciseAnalysis]([status], [createdAt]);
CREATE TABLE [dbo].[ExerciseAnalysisSharing] (
  [id] INT NOT NULL IDENTITY(1,1),
  [analysisId] INT NOT NULL,
  [coachId] INT NOT NULL,
  [sharedAt] DATETIME2 NOT NULL CONSTRAINT [ExerciseAnalysisSharing_sharedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [revokedAt] DATETIME2,
  CONSTRAINT [ExerciseAnalysisSharing_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [ExerciseAnalysisSharing_analysisId_fkey] FOREIGN KEY ([analysisId]) REFERENCES [dbo].[ExerciseAnalysis]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT [ExerciseAnalysisSharing_coachId_fkey] FOREIGN KEY ([coachId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX [ExerciseAnalysisSharing_analysisId_coachId_key] ON [dbo].[ExerciseAnalysisSharing]([analysisId], [coachId]);
CREATE INDEX [ExerciseAnalysisSharing_coachId_revokedAt_sharedAt_idx] ON [dbo].[ExerciseAnalysisSharing]([coachId], [revokedAt], [sharedAt]);
CREATE TABLE [dbo].[ExerciseAnalysisFeedback] (
  [id] INT NOT NULL IDENTITY(1,1),
  [analysisId] INT NOT NULL,
  [coachId] INT NOT NULL,
  [comment] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExerciseAnalysisFeedback_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [ExerciseAnalysisFeedback_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [ExerciseAnalysisFeedback_analysisId_fkey] FOREIGN KEY ([analysisId]) REFERENCES [dbo].[ExerciseAnalysis]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT [ExerciseAnalysisFeedback_coachId_fkey] FOREIGN KEY ([coachId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [ExerciseAnalysisFeedback_analysisId_createdAt_idx] ON [dbo].[ExerciseAnalysisFeedback]([analysisId], [createdAt]);
COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;

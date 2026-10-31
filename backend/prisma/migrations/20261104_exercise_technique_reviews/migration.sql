CREATE TABLE [ExerciseTechniqueCoachLabel] (
    [id] INT NOT NULL IDENTITY(1,1),
    [analysisId] INT NOT NULL,
    [coachId] INT NOT NULL,
    [videoSha256] VARCHAR(64) NOT NULL,
    [exerciseVariant] VARCHAR(40) NOT NULL,
    [standardVersion] VARCHAR(100) NOT NULL,
    [criterionId] VARCHAR(40) NOT NULL,
    [outcome] VARCHAR(30) NOT NULL,
    [repNumber] INT NULL,
    [startSeconds] FLOAT NOT NULL,
    [endSeconds] FLOAT NOT NULL,
    [timestampSeconds] FLOAT NULL,
    [evidenceJson] NVARCHAR(MAX) NOT NULL,
    [reviewerNotes] NVARCHAR(2000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExerciseTechniqueCoachLabel_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ExerciseTechniqueCoachLabel_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ExerciseTechniqueCoachLabel_analysisId_fkey] FOREIGN KEY ([analysisId]) REFERENCES [ExerciseAnalysis]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT [ExerciseTechniqueCoachLabel_coachId_fkey] FOREIGN KEY ([coachId]) REFERENCES [User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [ExerciseTechniqueCoachLabel_analysisId_criterionId_startSeconds_idx] ON [ExerciseTechniqueCoachLabel]([analysisId], [criterionId], [startSeconds]);
CREATE INDEX [ExerciseTechniqueCoachLabel_coachId_createdAt_idx] ON [ExerciseTechniqueCoachLabel]([coachId], [createdAt]);

CREATE TABLE [ExerciseTechniqueCriterionReview] (
    [id] INT NOT NULL IDENTITY(1,1),
    [coachId] INT NOT NULL,
    [exerciseType] VARCHAR(30) NOT NULL,
    [exerciseVariant] VARCHAR(40) NOT NULL,
    [standardVersion] VARCHAR(100) NOT NULL,
    [standardDigest] VARCHAR(64) NOT NULL,
    [criterionId] VARCHAR(40) NOT NULL,
    [decision] VARCHAR(50) NOT NULL,
    [qualification] NVARCHAR(300) NOT NULL,
    [reviewRecordId] VARCHAR(100) NOT NULL,
    [reviewScope] NVARCHAR(1000) NOT NULL,
    [approvedConditions] NVARCHAR(MAX) NOT NULL,
    [measurementFormula] NVARCHAR(2000) NOT NULL,
    [thresholdsJson] NVARCHAR(MAX) NOT NULL,
    [cameraViewsJson] NVARCHAR(MAX) NOT NULL,
    [limitationsJson] NVARCHAR(MAX) NOT NULL,
    [correctionAdvice] NVARCHAR(MAX) NOT NULL,
    [status] VARCHAR(60) NOT NULL CONSTRAINT [ExerciseTechniqueCriterionReview_status_df] DEFAULT 'COACH_REVIEWED_PENDING_VIDEO_VALIDATION',
    [validationReportSha256] VARCHAR(64) NULL,
    [reviewedAt] DATETIME2 NOT NULL CONSTRAINT [ExerciseTechniqueCriterionReview_reviewedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ExerciseTechniqueCriterionReview_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ExerciseTechniqueCriterionReview_coachId_fkey] FOREIGN KEY ([coachId]) REFERENCES [User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [ExerciseTechniqueCriterionReview_scope_status_idx] ON [ExerciseTechniqueCriterionReview]([exerciseType], [exerciseVariant], [standardVersion], [criterionId], [status]);
CREATE INDEX [ExerciseTechniqueCriterionReview_coachId_reviewedAt_idx] ON [ExerciseTechniqueCriterionReview]([coachId], [reviewedAt]);

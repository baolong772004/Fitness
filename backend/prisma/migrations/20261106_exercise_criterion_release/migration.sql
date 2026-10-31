ALTER TABLE [dbo].[ExerciseTechniqueCriterionReview]
ADD [validationReportPath] NVARCHAR(500) NULL,
    [approvalSignatureSha256] VARCHAR(64) NULL,
    [approvalScopeJson] NVARCHAR(MAX) NULL,
    [releasedStandardDigest] VARCHAR(64) NULL,
    [approvedAt] DATETIME2 NULL;

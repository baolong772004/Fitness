ALTER TABLE [dbo].[ExerciseAnalysis]
DROP CONSTRAINT [ExerciseAnalysis_videoOrigin_df];

ALTER TABLE [dbo].[ExerciseAnalysis]
ADD CONSTRAINT [ExerciseAnalysis_videoOrigin_df] DEFAULT 'UNVERIFIED_LEGACY' FOR [videoOrigin];

UPDATE [dbo].[ExerciseAnalysis]
SET [videoOrigin] = 'UNVERIFIED_LEGACY'
WHERE [videoOrigin] = 'USER_UPLOAD'
  AND [captureMethodDeclared] = 'UNKNOWN'
  AND [performerDeclaration] = 'UNKNOWN'
  AND [sourceReference] IS NULL;

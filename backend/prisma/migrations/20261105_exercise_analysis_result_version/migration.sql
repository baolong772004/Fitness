ALTER TABLE [dbo].[ExerciseAnalysis] ADD [evaluationMode] VARCHAR(20) NOT NULL CONSTRAINT [ExerciseAnalysis_evaluationMode_df] DEFAULT 'OFFICIAL';
ALTER TABLE [dbo].[ExerciseAnalysis] ADD [resultVersion] VARCHAR(30) NULL;

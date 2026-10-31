ALTER TABLE [dbo].[ExerciseAnalysis]
ADD [videoOrigin] VARCHAR(20) NOT NULL CONSTRAINT [ExerciseAnalysis_videoOrigin_df] DEFAULT 'USER_UPLOAD',
    [captureMethodDeclared] VARCHAR(20) NOT NULL CONSTRAINT [ExerciseAnalysis_captureMethodDeclared_df] DEFAULT 'UNKNOWN',
    [performerDeclaration] VARCHAR(20) NOT NULL CONSTRAINT [ExerciseAnalysis_performerDeclaration_df] DEFAULT 'UNKNOWN',
    [videoSha256] VARCHAR(64) NULL,
    [sourceReference] VARCHAR(100) NULL,
    [sessionGroupId] VARCHAR(36) NULL,
    [samePersonSessionConfirmed] BIT NOT NULL CONSTRAINT [ExerciseAnalysis_samePersonSessionConfirmed_df] DEFAULT 0;

EXEC sp_executesql N'UPDATE [dbo].[ExerciseAnalysis]
SET [videoSha256] = JSON_VALUE([resultJson], ''$.inputVideoSha256'')
WHERE ISJSON([resultJson]) = 1
  AND LEN(JSON_VALUE([resultJson], ''$.inputVideoSha256'')) = 64';

EXEC sp_executesql N'UPDATE [dbo].[ExerciseAnalysis]
SET [videoOrigin] = ''SAMPLE'', [sourceReference] = ''squat-front-pexels-5034577'',
    [performerDeclaration] = ''UNKNOWN''
WHERE [videoSha256] = ''5d27d9b378af0d323237fa48fa2fe32befec20a72e4f24988f7979f7fef9c7a8''';

CREATE INDEX [ExerciseAnalysis_memberId_sessionGroupId_idx]
ON [dbo].[ExerciseAnalysis]([memberId], [sessionGroupId]);

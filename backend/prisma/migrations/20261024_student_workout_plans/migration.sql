BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[StudentWorkoutPlan] (
    [id] INT NOT NULL IDENTITY(1,1),
    [workoutPlanId] INT,
    [memberId] INT NOT NULL,
    [coachId] INT NOT NULL,
    [programName] NVARCHAR(120) NOT NULL CONSTRAINT [StudentWorkoutPlan_programName_df] DEFAULT 'PT',
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [StudentWorkoutPlan_status_df] DEFAULT 'ACTIVE',
    [version] INT NOT NULL CONSTRAINT [StudentWorkoutPlan_version_df] DEFAULT 1,
    [title] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(max),
    [sessionsJson] NVARCHAR(max) NOT NULL,
    [mealsJson] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [StudentWorkoutPlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [StudentWorkoutPlan_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [StudentWorkoutPlan_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkoutPlanRevision] (
    [id] INT NOT NULL IDENTITY(1,1),
    [studentPlanId] INT NOT NULL,
    [version] INT NOT NULL,
    [title] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(max),
    [sessionsJson] NVARCHAR(max) NOT NULL,
    [mealsJson] NVARCHAR(max) NOT NULL,
    [changedById] INT NOT NULL,
    [reason] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkoutPlanRevision_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WorkoutPlanRevision_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkoutPlanRevision_studentPlanId_version_key] UNIQUE NONCLUSTERED ([studentPlanId],[version])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StudentWorkoutPlan_memberId_coachId_programName_status_idx] ON [dbo].[StudentWorkoutPlan]([memberId], [coachId], [programName], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StudentWorkoutPlan_coachId_updatedAt_idx] ON [dbo].[StudentWorkoutPlan]([coachId], [updatedAt]);

-- AddForeignKey
ALTER TABLE [dbo].[StudentWorkoutPlan] ADD CONSTRAINT [StudentWorkoutPlan_workoutPlanId_fkey] FOREIGN KEY ([workoutPlanId]) REFERENCES [dbo].[WorkoutPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StudentWorkoutPlan] ADD CONSTRAINT [StudentWorkoutPlan_memberId_fkey] FOREIGN KEY ([memberId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StudentWorkoutPlan] ADD CONSTRAINT [StudentWorkoutPlan_coachId_fkey] FOREIGN KEY ([coachId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkoutPlanRevision] ADD CONSTRAINT [WorkoutPlanRevision_studentPlanId_fkey] FOREIGN KEY ([studentPlanId]) REFERENCES [dbo].[StudentWorkoutPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkoutPlanRevision] ADD CONSTRAINT [WorkoutPlanRevision_changedById_fkey] FOREIGN KEY ([changedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Keep all legacy member plans. Only the newest plan for each coach/member
-- becomes ACTIVE; older plans remain available as archived snapshots.
INSERT INTO [dbo].[StudentWorkoutPlan]
  ([workoutPlanId], [memberId], [coachId], [programName], [status], [version],
   [title], [description], [sessionsJson], [mealsJson], [createdAt], [updatedAt])
SELECT [id], [memberId], [coachId], N'PT',
  CASE WHEN ROW_NUMBER() OVER (PARTITION BY [memberId], [coachId] ORDER BY [createdAt] DESC, [id] DESC) = 1
    THEN N'ACTIVE' ELSE N'ARCHIVED' END,
  1, [title], [description], COALESCE([sessionsJson], N'[]'), COALESCE([mealsJson], N'[]'), [createdAt], [createdAt]
FROM [dbo].[WorkoutPlan] WHERE [memberId] IS NOT NULL;

INSERT INTO [dbo].[WorkoutPlanRevision]
  ([studentPlanId], [version], [title], [description], [sessionsJson], [mealsJson], [changedById], [reason], [createdAt])
SELECT [id], 1, [title], [description], [sessionsJson], [mealsJson], [coachId],
  N'Chuyển giáo án hiện có sang lịch sử phiên bản', [createdAt]
FROM [dbo].[StudentWorkoutPlan];

CREATE UNIQUE NONCLUSTERED INDEX [StudentWorkoutPlan_one_active_program]
  ON [dbo].[StudentWorkoutPlan] ([memberId], [coachId], [programName]) WHERE [status] = N'ACTIVE';

ALTER TABLE [dbo].[StudentWorkoutPlan] ADD CONSTRAINT [StudentWorkoutPlan_status_check]
  CHECK ([status] IN (N'ACTIVE', N'ARCHIVED') AND [version] >= 1);
ALTER TABLE [dbo].[StudentWorkoutPlan] ADD CONSTRAINT [StudentWorkoutPlan_json_check]
  CHECK (ISJSON([sessionsJson]) = 1 AND LEFT(LTRIM([sessionsJson]), 1) = N'['
    AND ISJSON([mealsJson]) = 1 AND LEFT(LTRIM([mealsJson]), 1) = N'[');
ALTER TABLE [dbo].[WorkoutPlanRevision] ADD CONSTRAINT [WorkoutPlanRevision_json_check]
  CHECK (ISJSON([sessionsJson]) = 1 AND LEFT(LTRIM([sessionsJson]), 1) = N'['
    AND ISJSON([mealsJson]) = 1 AND LEFT(LTRIM([mealsJson]), 1) = N'[' AND [version] >= 1);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

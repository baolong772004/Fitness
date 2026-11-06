BEGIN TRY
BEGIN TRAN;

-- Additive only: old make-up rows keep their existing status, expiry and credit allocation.
ALTER TABLE [dbo].[MakeUpRequest] ADD
  [cause] VARCHAR(20) NOT NULL CONSTRAINT [MakeUpRequest_cause_df] DEFAULT 'LEGACY',
  [chainRootBookingId] INT NULL,
  [coachAbsenceCount] INT NOT NULL CONSTRAINT [MakeUpRequest_coachAbsenceCount_df] DEFAULT 0,
  [extensionCount] INT NOT NULL CONSTRAINT [MakeUpRequest_extensionCount_df] DEFAULT 0,
  [assignedCoachId] INT NULL,
  [slotEvidence] NVARCHAR(MAX) NULL,
  [escalatedAt] DATETIME2 NULL;

-- Only explicitly Coach/Admin-caused historical rights receive the protective workflow.
EXEC(N'UPDATE request SET [cause] = ''COACH''
FROM [dbo].[MakeUpRequest] request
JOIN [dbo].[Booking] booking ON booking.[id] = request.[originalBookingId]
WHERE booking.[cancelledBy] IN (''COACH'', ''TRAINER'', ''ADMIN'')
  AND request.[status] = ''PENDING''');

EXEC(N'CREATE UNIQUE INDEX [UX_MakeUpRequest_one_active_coach_chain]
  ON [dbo].[MakeUpRequest]([chainRootBookingId])
  WHERE [chainRootBookingId] IS NOT NULL AND [status] IN (N''PENDING'', N''ESCALATED'')');

CREATE TABLE [dbo].[PtMakeUpEvent] (
  [id] INT NOT NULL IDENTITY(1,1),
  [requestId] INT NOT NULL,
  [actorId] INT NULL,
  [action] VARCHAR(40) NOT NULL,
  [details] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [PtMakeUpEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [PtMakeUpEvent_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [PtMakeUpEvent_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[MakeUpRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [PtMakeUpEvent_requestId_createdAt_idx]
  ON [dbo].[PtMakeUpEvent]([requestId], [createdAt]);

CREATE TABLE [dbo].[PtAttendanceReview] (
  [id] INT NOT NULL IDENTITY(1,1),
  [bookingId] INT NOT NULL,
  [status] VARCHAR(24) NOT NULL CONSTRAINT [PtAttendanceReview_status_df] DEFAULT 'PENDING_COACH',
  [deadlineAt] DATETIME2 NOT NULL,
  [coachDecision] VARCHAR(20) NULL,
  [coachNote] NVARCHAR(500) NULL,
  [coachReviewedAt] DATETIME2 NULL,
  [adminDecision] VARCHAR(20) NULL,
  [adminNote] NVARCHAR(500) NULL,
  [adminReviewedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [PtAttendanceReview_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [PtAttendanceReview_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [PtAttendanceReview_bookingId_key] UNIQUE ([bookingId]),
  CONSTRAINT [PtAttendanceReview_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[Booking]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [PtAttendanceReview_status_deadlineAt_idx]
  ON [dbo].[PtAttendanceReview]([status], [deadlineAt]);

CREATE TABLE [dbo].[PtAttendanceReviewEvent] (
  [id] INT NOT NULL IDENTITY(1,1),
  [reviewId] INT NOT NULL,
  [actorId] INT NULL,
  [action] VARCHAR(40) NOT NULL,
  [details] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [PtAttendanceReviewEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [PtAttendanceReviewEvent_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [PtAttendanceReviewEvent_reviewId_fkey] FOREIGN KEY ([reviewId]) REFERENCES [dbo].[PtAttendanceReview]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [PtAttendanceReviewEvent_reviewId_createdAt_idx]
  ON [dbo].[PtAttendanceReviewEvent]([reviewId], [createdAt]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH

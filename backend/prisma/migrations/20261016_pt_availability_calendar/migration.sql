CREATE TABLE [dbo].[GymCalendarConfig] (
  [id] INT NOT NULL,
  [openTime] VARCHAR(5) NOT NULL CONSTRAINT [GymCalendarConfig_openTime_df] DEFAULT '06:00',
  [closeTime] VARCHAR(5) NOT NULL CONSTRAINT [GymCalendarConfig_closeTime_df] DEFAULT '22:00',
  [slotMinutes] INT NOT NULL CONSTRAINT [GymCalendarConfig_slotMinutes_df] DEFAULT 60,
  [breakMinutes] INT NOT NULL CONSTRAINT [GymCalendarConfig_breakMinutes_df] DEFAULT 0,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [GymCalendarConfig_pkey] PRIMARY KEY CLUSTERED ([id])
);
INSERT INTO [dbo].[GymCalendarConfig] ([id], [openTime], [closeTime], [slotMinutes], [breakMinutes], [updatedAt])
VALUES (1, '06:00', '22:00', 60, 0, SYSUTCDATETIME());

CREATE TABLE [dbo].[GymClosure] (
  [id] INT NOT NULL IDENTITY(1,1),
  [startAt] DATETIME2 NOT NULL,
  [endAt] DATETIME2 NOT NULL,
  [kind] VARCHAR(20) NOT NULL,
  [reason] NVARCHAR(500) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [GymClosure_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [GymClosure_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [GymClosure_startAt_endAt_idx] ON [dbo].[GymClosure]([startAt], [endAt]);

CREATE TABLE [dbo].[CoachDateAvailability] (
  [id] INT NOT NULL IDENTITY(1,1),
  [coachProfileId] INT NOT NULL,
  [date] VARCHAR(10) NOT NULL,
  [shifts] NVARCHAR(MAX) NOT NULL,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [CoachDateAvailability_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [CoachDateAvailability_coachProfileId_fkey] FOREIGN KEY ([coachProfileId]) REFERENCES [dbo].[CoachProfile]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX [CoachDateAvailability_coachProfileId_date_key] ON [dbo].[CoachDateAvailability]([coachProfileId], [date]);

CREATE TABLE [dbo].[CoachScheduleChangeRequest] (
  [id] INT NOT NULL IDENTITY(1,1),
  [coachId] INT NOT NULL,
  [bookingId] INT NOT NULL,
  [reason] NVARCHAR(500) NOT NULL,
  [status] VARCHAR(20) NOT NULL CONSTRAINT [CoachScheduleChangeRequest_status_df] DEFAULT 'PENDING',
  [handledById] INT NULL,
  [adminNote] NVARCHAR(500) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [CoachScheduleChangeRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [handledAt] DATETIME2 NULL,
  CONSTRAINT [CoachScheduleChangeRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [CoachScheduleChangeRequest_status_createdAt_idx] ON [dbo].[CoachScheduleChangeRequest]([status], [createdAt]);
CREATE INDEX [CoachScheduleChangeRequest_bookingId_status_idx] ON [dbo].[CoachScheduleChangeRequest]([bookingId], [status]);

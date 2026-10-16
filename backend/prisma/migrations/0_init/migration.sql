BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[ActionLog] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [details] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ActionLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ActionLog_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Booking] (
    [id] INT NOT NULL IDENTITY(1,1),
    [type] NVARCHAR(1000) NOT NULL,
    [memberId] INT NOT NULL,
    [coachId] INT,
    [membershipId] INT,
    [startTime] DATETIME2 NOT NULL,
    [endTime] DATETIME2 NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Booking_status_df] DEFAULT 'UPCOMING',
    [sessionQrToken] NVARCHAR(max),
    [reportedAbsence] BIT NOT NULL CONSTRAINT [Booking_reportedAbsence_df] DEFAULT 0,
    [absenceReason] NVARCHAR(1000),
    [absenceReportedAt] DATETIME2,
    [cancelledBy] NVARCHAR(1000),
    [isMakeup] BIT NOT NULL CONSTRAINT [Booking_isMakeup_df] DEFAULT 0,
    [makeupFromId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Booking_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Booking_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[CheckIn] (
    [id] INT NOT NULL IDENTITY(1,1),
    [memberId] INT NOT NULL,
    [membershipId] INT,
    [roomId] INT,
    [staffId] INT,
    [checkInTime] DATETIME2 NOT NULL CONSTRAINT [CheckIn_checkInTime_df] DEFAULT CURRENT_TIMESTAMP,
    [method] NVARCHAR(1000) NOT NULL CONSTRAINT [CheckIn_method_df] DEFAULT 'QR_CODE',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [CheckIn_status_df] DEFAULT 'SUCCESS',
    [rejectReason] NVARCHAR(1000),
    CONSTRAINT [CheckIn_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[CoachPricing] (
    [id] INT NOT NULL IDENTITY(1,1),
    [coachProfileId] INT NOT NULL,
    [sessionCount] INT NOT NULL,
    [price] DECIMAL(18,2) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CoachPricing_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CoachPricing_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[CoachProfile] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [bio] NVARCHAR(max),
    [specialization] NVARCHAR(1000),
    [experience] INT,
    [certifications] NVARCHAR(1000),
    [rating] FLOAT(53) NOT NULL CONSTRAINT [CoachProfile_rating_df] DEFAULT 5.0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CoachProfile_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [hourlyRate] DECIMAL(18,2) NOT NULL CONSTRAINT [CoachProfile_hourlyRate_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [CoachProfile_status_df] DEFAULT 'ACTIVE',
    CONSTRAINT [CoachProfile_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [CoachProfile_userId_key] UNIQUE NONCLUSTERED ([userId] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[CoachSchedule] (
    [id] INT NOT NULL IDENTITY(1,1),
    [coachProfileId] INT NOT NULL,
    [dayOfWeek] INT NOT NULL,
    [startTime] NVARCHAR(1000) NOT NULL,
    [endTime] NVARCHAR(1000) NOT NULL,
    [isAvailable] BIT NOT NULL CONSTRAINT [CoachSchedule_isAvailable_df] DEFAULT 1,
    CONSTRAINT [CoachSchedule_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Equipment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [roomId] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Equipment_status_df] DEFAULT 'AVAILABLE',
    [note] NVARCHAR(1000),
    CONSTRAINT [Equipment_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Equipment_code_key] UNIQUE NONCLUSTERED ([code] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[GroupClass] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [imageUrl] VARCHAR(255),
    [durationMin] INT NOT NULL CONSTRAINT [GroupClass_durationMin_df] DEFAULT 60,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GroupClass_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [GroupClass_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[GroupClassBooking] (
    [id] INT NOT NULL IDENTITY(1,1),
    [scheduleId] INT NOT NULL,
    [userId] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [GroupClassBooking_status_df] DEFAULT 'BOOKED',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GroupClassBooking_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [GroupClassBooking_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [GroupClassBooking_scheduleId_userId_key] UNIQUE NONCLUSTERED ([scheduleId] ASC,[userId] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[GroupClassSchedule] (
    [id] INT NOT NULL IDENTITY(1,1),
    [classId] INT NOT NULL,
    [trainerId] INT NOT NULL,
    [roomId] INT,
    [startTime] DATETIME2 NOT NULL,
    [endTime] DATETIME2 NOT NULL,
    [capacity] INT NOT NULL CONSTRAINT [GroupClassSchedule_capacity_df] DEFAULT 20,
    [bookedCount] INT NOT NULL CONSTRAINT [GroupClassSchedule_bookedCount_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [GroupClassSchedule_status_df] DEFAULT 'OPEN',
    CONSTRAINT [GroupClassSchedule_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[MakeUpRequest] (
    [id] INT NOT NULL IDENTITY(1,1),
    [originalBookingId] INT NOT NULL,
    [newBookingId] INT,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [MakeUpRequest_status_df] DEFAULT 'PENDING',
    [expiresAt] DATETIME2 NOT NULL,
    [rejectReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MakeUpRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [MakeUpRequest_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Membership] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [packageId] INT NOT NULL,
    [startDate] DATETIME2 NOT NULL,
    [endDate] DATETIME2 NOT NULL,
    [remainingSessions] INT,
    [maxMakeupAllowed] INT NOT NULL CONSTRAINT [Membership_maxMakeupAllowed_df] DEFAULT 3,
    [usedMakeupCount] INT NOT NULL CONSTRAINT [Membership_usedMakeupCount_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Membership_status_df] DEFAULT 'ACTIVE',
    [coachId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Membership_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Membership_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Notification] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT,
    [title] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(max) NOT NULL,
    [isRead] BIT NOT NULL CONSTRAINT [Notification_isRead_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Package] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL CONSTRAINT [Package_type_df] DEFAULT 'MEMBERSHIP',
    [description] NVARCHAR(max),
    [price] DECIMAL(18,2) NOT NULL,
    [durationDays] INT NOT NULL,
    [trialPtSessions] INT NOT NULL CONSTRAINT [Package_trialPtSessions_df] DEFAULT 0,
    [totalPtSessions] INT,
    [isActive] BIT NOT NULL CONSTRAINT [Package_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Package_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Package_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Payment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [membershipId] INT,
    [amount] DECIMAL(18,2) NOT NULL,
    [method] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Payment_status_df] DEFAULT 'PENDING',
    [orderCode] BIGINT,
    [transactionNo] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Payment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [renewalDurationDays] INT,
    CONSTRAINT [Payment_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Payment_orderCode_key] UNIQUE NONCLUSTERED ([orderCode] ASC),
    CONSTRAINT [Payment_transactionNo_key] UNIQUE NONCLUSTERED ([transactionNo] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[ProgressLog] (
    [id] INT NOT NULL IDENTITY(1,1),
    [memberId] INT NOT NULL,
    [weight] FLOAT(53) NOT NULL,
    [bodyFat] FLOAT(53),
    [muscleMass] FLOAT(53),
    [loggedAt] DATETIME2 NOT NULL CONSTRAINT [ProgressLog_loggedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ProgressLog_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[PtChatMessage] (
    [id] INT NOT NULL IDENTITY(1,1),
    [bookingId] INT NOT NULL,
    [senderId] INT NOT NULL,
    [content] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PtChatMessage_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PtChatMessage_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Review] (
    [id] INT NOT NULL IDENTITY(1,1),
    [bookingId] INT NOT NULL,
    [memberId] INT NOT NULL,
    [coachProfileId] INT NOT NULL,
    [rating] INT NOT NULL,
    [comment] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Review_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Review_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [Review_bookingId_key] UNIQUE NONCLUSTERED ([bookingId] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[Room] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [capacity] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [Room_isActive_df] DEFAULT 1,
    CONSTRAINT [Room_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[SessionExercise] (
    [id] INT NOT NULL IDENTITY(1,1),
    [sessionResultId] INT NOT NULL,
    [exerciseName] NVARCHAR(1000) NOT NULL,
    [sets] INT NOT NULL,
    [reps] INT NOT NULL,
    [weightKg] FLOAT(53),
    CONSTRAINT [SessionExercise_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[SessionResult] (
    [id] INT NOT NULL IDENTITY(1,1),
    [bookingId] INT NOT NULL,
    [notes] NVARCHAR(max),
    [calories] INT,
    [durationMin] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SessionResult_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SessionResult_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [SessionResult_bookingId_key] UNIQUE NONCLUSTERED ([bookingId] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[SupportRequest] (
    [id] INT NOT NULL IDENTITY(1,1),
    [memberId] INT NOT NULL,
    [staffId] INT,
    [subject] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(max) NOT NULL,
    [reply] NVARCHAR(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [SupportRequest_status_df] DEFAULT 'OPEN',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SupportRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SupportRequest_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] NVARCHAR(1000) NOT NULL,
    [password] NVARCHAR(1000) NOT NULL,
    [fullName] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000),
    [avatar] NVARCHAR(1000),
    [gender] NVARCHAR(1000),
    [dateOfBirth] DATETIME2,
    [height] FLOAT(53),
    [weight] FLOAT(53),
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'MEMBER',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [User_status_df] DEFAULT 'PENDING',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email] ASC)
);

-- CreateTable
CREATE TABLE [dbo].[WorkoutPlan] (
    [id] INT NOT NULL IDENTITY(1,1),
    [memberId] INT NOT NULL,
    [coachId] INT NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkoutPlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [mealsJson] NVARCHAR(max),
    [sessionsJson] NVARCHAR(max),
    CONSTRAINT [WorkoutPlan_pkey] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GroupClassSchedule_classId_idx] ON [dbo].[GroupClassSchedule]([classId] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GroupClassSchedule_startTime_idx] ON [dbo].[GroupClassSchedule]([startTime] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PtChatMessage_bookingId_id_idx] ON [dbo].[PtChatMessage]([bookingId] ASC, [id] ASC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PtChatMessage_senderId_idx] ON [dbo].[PtChatMessage]([senderId] ASC);

-- AddForeignKey
ALTER TABLE [dbo].[ActionLog] ADD CONSTRAINT [ActionLog_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Booking] ADD CONSTRAINT [Booking_coachId_fkey] FOREIGN KEY ([coachId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Booking] ADD CONSTRAINT [Booking_memberId_fkey] FOREIGN KEY ([memberId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Booking] ADD CONSTRAINT [Booking_membershipId_fkey] FOREIGN KEY ([membershipId]) REFERENCES [dbo].[Membership]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckIn] ADD CONSTRAINT [CheckIn_memberId_fkey] FOREIGN KEY ([memberId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckIn] ADD CONSTRAINT [CheckIn_membershipId_fkey] FOREIGN KEY ([membershipId]) REFERENCES [dbo].[Membership]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckIn] ADD CONSTRAINT [CheckIn_roomId_fkey] FOREIGN KEY ([roomId]) REFERENCES [dbo].[Room]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckIn] ADD CONSTRAINT [CheckIn_staffId_fkey] FOREIGN KEY ([staffId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CoachPricing] ADD CONSTRAINT [CoachPricing_coachProfileId_fkey] FOREIGN KEY ([coachProfileId]) REFERENCES [dbo].[CoachProfile]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CoachProfile] ADD CONSTRAINT [CoachProfile_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CoachSchedule] ADD CONSTRAINT [CoachSchedule_coachProfileId_fkey] FOREIGN KEY ([coachProfileId]) REFERENCES [dbo].[CoachProfile]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Equipment] ADD CONSTRAINT [Equipment_roomId_fkey] FOREIGN KEY ([roomId]) REFERENCES [dbo].[Room]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GroupClassBooking] ADD CONSTRAINT [GroupClassBooking_scheduleId_fkey] FOREIGN KEY ([scheduleId]) REFERENCES [dbo].[GroupClassSchedule]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[GroupClassBooking] ADD CONSTRAINT [GroupClassBooking_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GroupClassSchedule] ADD CONSTRAINT [GroupClassSchedule_classId_fkey] FOREIGN KEY ([classId]) REFERENCES [dbo].[GroupClass]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[GroupClassSchedule] ADD CONSTRAINT [GroupClassSchedule_roomId_fkey] FOREIGN KEY ([roomId]) REFERENCES [dbo].[Room]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GroupClassSchedule] ADD CONSTRAINT [GroupClassSchedule_trainerId_fkey] FOREIGN KEY ([trainerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MakeUpRequest] ADD CONSTRAINT [MakeUpRequest_newBookingId_fkey] FOREIGN KEY ([newBookingId]) REFERENCES [dbo].[Booking]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MakeUpRequest] ADD CONSTRAINT [MakeUpRequest_originalBookingId_fkey] FOREIGN KEY ([originalBookingId]) REFERENCES [dbo].[Booking]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Membership] ADD CONSTRAINT [Membership_coachId_fkey] FOREIGN KEY ([coachId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Membership] ADD CONSTRAINT [Membership_packageId_fkey] FOREIGN KEY ([packageId]) REFERENCES [dbo].[Package]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Membership] ADD CONSTRAINT [Membership_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_membershipId_fkey] FOREIGN KEY ([membershipId]) REFERENCES [dbo].[Membership]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProgressLog] ADD CONSTRAINT [ProgressLog_memberId_fkey] FOREIGN KEY ([memberId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PtChatMessage] ADD CONSTRAINT [PtChatMessage_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[Booking]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PtChatMessage] ADD CONSTRAINT [PtChatMessage_senderId_fkey] FOREIGN KEY ([senderId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Review] ADD CONSTRAINT [Review_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[Booking]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Review] ADD CONSTRAINT [Review_coachProfileId_fkey] FOREIGN KEY ([coachProfileId]) REFERENCES [dbo].[CoachProfile]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Review] ADD CONSTRAINT [Review_memberId_fkey] FOREIGN KEY ([memberId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SessionExercise] ADD CONSTRAINT [SessionExercise_sessionResultId_fkey] FOREIGN KEY ([sessionResultId]) REFERENCES [dbo].[SessionResult]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SessionResult] ADD CONSTRAINT [SessionResult_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[Booking]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SupportRequest] ADD CONSTRAINT [SupportRequest_memberId_fkey] FOREIGN KEY ([memberId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SupportRequest] ADD CONSTRAINT [SupportRequest_staffId_fkey] FOREIGN KEY ([staffId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkoutPlan] ADD CONSTRAINT [WorkoutPlan_coachId_fkey] FOREIGN KEY ([coachId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkoutPlan] ADD CONSTRAINT [WorkoutPlan_memberId_fkey] FOREIGN KEY ([memberId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[CheckIn] ADD [shiftId] INT;

-- AlterTable
ALTER TABLE [dbo].[Payment] ADD [cashChange] DECIMAL(18,2),
[cashReceived] DECIMAL(18,2),
[consultantId] INT,
[note] NVARCHAR(500),
[shiftId] INT,
[staffId] INT,
[traceRefNo] NVARCHAR(100);

-- CreateTable
CREATE TABLE [dbo].[DeskDevice] (
    [id] INT NOT NULL IDENTITY(1,1),
    [deviceToken] NVARCHAR(255) NOT NULL,
    [deviceName] NVARCHAR(100) NOT NULL,
    [location] NVARCHAR(255),
    [isActive] BIT NOT NULL CONSTRAINT [DeskDevice_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DeskDevice_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DeskDevice_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [DeskDevice_deviceToken_key] UNIQUE NONCLUSTERED ([deviceToken])
);

-- CreateTable
CREATE TABLE [dbo].[StaffShift] (
    [id] INT NOT NULL IDENTITY(1,1),
    [shiftCode] NVARCHAR(50) NOT NULL,
    [staffId] INT NOT NULL,
    [deskDeviceId] INT,
    [deviceToken] NVARCHAR(255),
    [clockIn] DATETIME2 NOT NULL CONSTRAINT [StaffShift_clockIn_df] DEFAULT CURRENT_TIMESTAMP,
    [clockOut] DATETIME2,
    [systemCashAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [StaffShift_systemCashAmount_df] DEFAULT 0,
    [actualCashAmount] DECIMAL(18,2),
    [differenceAmount] DECIMAL(18,2),
    [differenceReason] NVARCHAR(500),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [StaffShift_status_df] DEFAULT 'OPEN',
    [notes] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [StaffShift_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [StaffShift_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [StaffShift_shiftCode_key] UNIQUE NONCLUSTERED ([shiftCode])
);

-- CreateTable
CREATE TABLE [dbo].[OperationalNote] (
    [id] INT NOT NULL IDENTITY(1,1),
    [staffId] INT NOT NULL,
    [shiftId] INT,
    [memberId] INT,
    [memberName] NVARCHAR(100),
    [memberPhone] NVARCHAR(20),
    [category] NVARCHAR(50) NOT NULL,
    [content] NVARCHAR(1000) NOT NULL,
    [priority] NVARCHAR(1000) NOT NULL CONSTRAINT [OperationalNote_priority_df] DEFAULT 'MEDIUM',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [OperationalNote_status_df] DEFAULT 'PENDING_REVIEW',
    [managerFeedback] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OperationalNote_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OperationalNote_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[CheckIn] ADD CONSTRAINT [CheckIn_shiftId_fkey] FOREIGN KEY ([shiftId]) REFERENCES [dbo].[StaffShift]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_staffId_fkey] FOREIGN KEY ([staffId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_consultantId_fkey] FOREIGN KEY ([consultantId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_shiftId_fkey] FOREIGN KEY ([shiftId]) REFERENCES [dbo].[StaffShift]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StaffShift] ADD CONSTRAINT [StaffShift_staffId_fkey] FOREIGN KEY ([staffId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StaffShift] ADD CONSTRAINT [StaffShift_deskDeviceId_fkey] FOREIGN KEY ([deskDeviceId]) REFERENCES [dbo].[DeskDevice]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OperationalNote] ADD CONSTRAINT [OperationalNote_staffId_fkey] FOREIGN KEY ([staffId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OperationalNote] ADD CONSTRAINT [OperationalNote_shiftId_fkey] FOREIGN KEY ([shiftId]) REFERENCES [dbo].[StaffShift]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

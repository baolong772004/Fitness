-- Apply before starting the backend with the matching Prisma client.
-- Historical PayOS success times are unknown; keep paidAt NULL for old payments.

SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH(N'dbo.Membership', N'isGymMembership') IS NULL
    ALTER TABLE dbo.Membership ADD isGymMembership bit NOT NULL
      CONSTRAINT DF_Membership_IsGymMembership DEFAULT (0) WITH VALUES;

  IF COL_LENGTH(N'dbo.Membership', N'activationOrder') IS NULL
    ALTER TABLE dbo.Membership ADD activationOrder int NULL;

  IF COL_LENGTH(N'dbo.Membership', N'activatedAt') IS NULL
    ALTER TABLE dbo.Membership ADD activatedAt datetime2 NULL;

  IF COL_LENGTH(N'dbo.Payment', N'paidAt') IS NULL
    ALTER TABLE dbo.Payment ADD paidAt datetime2 NULL;

  -- Dynamic SQL compiles after the new columns have been added in this batch.
  EXEC sys.sp_executesql N'
    UPDATE membership
    SET isGymMembership = 1
    FROM dbo.Membership AS membership
    INNER JOIN dbo.Package AS package ON package.id = membership.packageId
    WHERE package.type = N''MEMBERSHIP'' AND membership.isGymMembership = 0;

    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY userId ORDER BY startDate, createdAt, id
      ) AS position
      FROM dbo.Membership
      WHERE isGymMembership = 1 AND status NOT IN (N''PENDING'', N''CANCELLED'')
    )
    UPDATE membership
    SET activationOrder = CONVERT(int, ordered.position)
    FROM dbo.Membership AS membership
    INNER JOIN ordered ON ordered.id = membership.id
    WHERE membership.activationOrder IS NULL;

    IF EXISTS (
      SELECT 1 FROM dbo.Membership
      WHERE isGymMembership = 1 AND status = N''ACTIVE''
      GROUP BY userId HAVING COUNT(*) > 1
    )
      THROW 51000, ''Resolve existing users with multiple active Gym memberships before creating the unique index.'', 1;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE object_id = OBJECT_ID(N''dbo.Membership'') AND name = N''UX_Membership_OneActiveGym''
    )
      CREATE UNIQUE INDEX UX_Membership_OneActiveGym
        ON dbo.Membership(userId)
        WHERE isGymMembership = 1 AND status = N''ACTIVE'';

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE object_id = OBJECT_ID(N''dbo.Membership'') AND name = N''UX_Membership_GymActivationOrder''
    )
      CREATE UNIQUE INDEX UX_Membership_GymActivationOrder
        ON dbo.Membership(userId, activationOrder)
        WHERE isGymMembership = 1 AND activationOrder IS NOT NULL;
  ';

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;

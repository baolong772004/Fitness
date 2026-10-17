-- New memberships must not become active through an omitted status.
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @statusDefault sysname;
  SELECT @statusDefault = dc.name
  FROM sys.default_constraints AS dc
  JOIN sys.columns AS col ON col.object_id = dc.parent_object_id AND col.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Membership') AND col.name = N'status';

  IF @statusDefault IS NOT NULL
  BEGIN
    DECLARE @dropSql nvarchar(max) = N'ALTER TABLE dbo.Membership DROP CONSTRAINT ' + QUOTENAME(@statusDefault);
    EXEC sys.sp_executesql @dropSql;
  END;

  ALTER TABLE dbo.Membership ADD CONSTRAINT Membership_status_df DEFAULT N'PENDING' FOR status;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;

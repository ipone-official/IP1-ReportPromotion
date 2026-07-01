USE IP1_PROMOREPORTLINE;
GO

/* ============================================================
   09_procedures_alias.sql — Stored procedure for alias self-learning
   ============================================================ */

IF OBJECT_ID('dbo.SpInsertMatchAlias', 'P') IS NOT NULL DROP PROCEDURE dbo.SpInsertMatchAlias;
GO
CREATE PROCEDURE dbo.SpInsertMatchAlias
    @kind      NVARCHAR(20),
    @alias     NVARCHAR(200),
    @canonical NVARCHAR(300),
    @note      NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SET @alias = LTRIM(RTRIM(@alias));
    SET @canonical = LTRIM(RTRIM(@canonical));
    
    IF @alias <> '' AND @canonical <> ''
    BEGIN
        IF NOT EXISTS (
            SELECT 1 
            FROM dbo.M_MatchAlias 
            WHERE kind = @kind 
              AND LTRIM(RTRIM(alias)) = @alias 
              AND LTRIM(RTRIM(canonical)) = @canonical
        )
        BEGIN
            INSERT INTO dbo.M_MatchAlias (kind, alias, canonical, note)
            VALUES (@kind, @alias, @canonical, @note);
        END
    END
END
GO

PRINT '09_procedures_alias: SpInsertMatchAlias created/updated';
GO

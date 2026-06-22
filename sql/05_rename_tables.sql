USE IP1_PROMOREPORTLINE;
GO

/* rename ตาราง → house pattern M_ (master) / T_ (transaction) ; idempotent (rerun ได้, ข้ามตัวที่ rename แล้ว) ; sp_rename เก็บข้อมูลครบทุกแถว */

IF OBJECT_ID('dbo.topics','U')          IS NOT NULL AND OBJECT_ID('dbo.M_Topic','U')        IS NULL EXEC sp_rename 'dbo.topics',         'M_Topic';
IF OBJECT_ID('dbo.report_types','U')    IS NOT NULL AND OBJECT_ID('dbo.M_ReportType','U')   IS NULL EXEC sp_rename 'dbo.report_types',   'M_ReportType';
IF OBJECT_ID('dbo.report_subtypes','U') IS NOT NULL AND OBJECT_ID('dbo.M_ReportSubtype','U')IS NULL EXEC sp_rename 'dbo.report_subtypes','M_ReportSubtype';
IF OBJECT_ID('dbo.stores','U')          IS NOT NULL AND OBJECT_ID('dbo.M_Store','U')        IS NULL EXEC sp_rename 'dbo.stores',         'M_Store';
IF OBJECT_ID('dbo.products','U')        IS NOT NULL AND OBJECT_ID('dbo.M_Product','U')      IS NULL EXEC sp_rename 'dbo.products',       'M_Product';
IF OBJECT_ID('dbo.match_aliases','U')   IS NOT NULL AND OBJECT_ID('dbo.M_MatchAlias','U')   IS NULL EXEC sp_rename 'dbo.match_aliases',  'M_MatchAlias';
IF OBJECT_ID('dbo.reports','U')         IS NOT NULL AND OBJECT_ID('dbo.T_Report','U')       IS NULL EXEC sp_rename 'dbo.reports',        'T_Report';
IF OBJECT_ID('dbo.report_items','U')    IS NOT NULL AND OBJECT_ID('dbo.T_Report_Item','U')  IS NULL EXEC sp_rename 'dbo.report_items',   'T_Report_Item';
IF OBJECT_ID('dbo.report_photos','U')   IS NOT NULL AND OBJECT_ID('dbo.T_Report_Photo','U') IS NULL EXEC sp_rename 'dbo.report_photos',   'T_Report_Photo';
IF OBJECT_ID('dbo.bot_sessions','U')    IS NOT NULL AND OBJECT_ID('dbo.T_BotSession','U')   IS NULL EXEC sp_rename 'dbo.bot_sessions',   'T_BotSession';
IF OBJECT_ID('dbo.parse_log','U')       IS NOT NULL AND OBJECT_ID('dbo.T_ParseLog','U')     IS NULL EXEC sp_rename 'dbo.parse_log',      'T_ParseLog';
GO

PRINT '05_rename_tables: done';
GO

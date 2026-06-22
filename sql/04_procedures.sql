USE IP1_PROMOREPORTLINE;
GO

/* ============================================================
   04_procedures.sql — data-access stored procedures
   write: header + detail (เหมือน SpInsertTPayin + SpInsertTPayinDetail)
   read:  1:1 กับ query เดิมใน master.ts (คง ORDER BY เดิม → prompt AI เหมือนเป๊ะ)
   ตาราง: M_* (master) / T_* (transaction) ; match logic อยู่ TS (audit คุม)
   รันผ่าน scripts/_run_sql.ts หรือ SSMS ; re-run ได้ (DROP ถ้ามี + CREATE)
   ============================================================ */

IF OBJECT_ID('dbo.SpInsertReport', 'P') IS NOT NULL DROP PROCEDURE dbo.SpInsertReport;
GO
CREATE PROCEDURE dbo.SpInsertReport
    @line_user_id NVARCHAR(50),
    @topic        NVARCHAR(100) = NULL,
    @channel      NVARCHAR(50)  = NULL,
    @account      NVARCHAR(300) = NULL,
    @branch       NVARCHAR(200) = NULL,
    @company      NVARCHAR(200) = NULL,
    @start_date   DATE          = NULL,
    @end_date     DATE          = NULL,
    @note         NVARCHAR(MAX) = NULL,
    @extra        NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.T_Report (line_user_id, topic, channel, account, branch, company, start_date, end_date, note, extra)
    OUTPUT INSERTED.id AS id
    VALUES (@line_user_id, @topic, @channel, @account, @branch, @company, @start_date, @end_date, @note, @extra);
END
GO

IF OBJECT_ID('dbo.SpInsertReportItem', 'P') IS NOT NULL DROP PROCEDURE dbo.SpInsertReportItem;
GO
CREATE PROCEDURE dbo.SpInsertReportItem
    @report_id      BIGINT,
    @category       NVARCHAR(150) = NULL,
    @sub_category   NVARCHAR(200) = NULL,
    @brand          NVARCHAR(150) = NULL,
    @size           NVARCHAR(100) = NULL,
    @pack           NVARCHAR(100) = NULL,
    @variant        NVARCHAR(200) = NULL,
    @report_type    NVARCHAR(200) = NULL,
    @report_subtype NVARCHAR(200) = NULL,
    @detail         NVARCHAR(MAX) = NULL,
    @is_npd         BIT           = 0
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.T_Report_Item (report_id, category, sub_category, brand, size, pack, variant, report_type, report_subtype, detail, is_npd)
    VALUES (@report_id, @category, @sub_category, @brand, @size, @pack, @variant, @report_type, @report_subtype, @detail, @is_npd);
END
GO

IF OBJECT_ID('dbo.SpInsertReportPhoto', 'P') IS NOT NULL DROP PROCEDURE dbo.SpInsertReportPhoto;
GO
CREATE PROCEDURE dbo.SpInsertReportPhoto
    @report_id  BIGINT,
    @photo_data VARBINARY(MAX) = NULL,
    @photo_type NVARCHAR(20)   = NULL,
    @item_index INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.T_Report_Photo (report_id, photo_data, photo_type, item_index)
    VALUES (@report_id, @photo_data, @photo_type, @item_index);
END
GO

IF OBJECT_ID('dbo.SpInsertParseLog', 'P') IS NOT NULL DROP PROCEDURE dbo.SpInsertParseLog;
GO
CREATE PROCEDURE dbo.SpInsertParseLog
    @line_user_id NVARCHAR(80)  = NULL,
    @raw_text     NVARCHAR(MAX) = NULL,
    @ai_json      NVARCHAR(MAX) = NULL,
    @merged_json  NVARCHAR(MAX) = NULL,
    @asked_fields NVARCHAR(400) = NULL,
    @outcome      NVARCHAR(20),
    @report_id    BIGINT        = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.T_ParseLog (line_user_id, raw_text, ai_json, merged_json, asked_fields, outcome, report_id)
    VALUES (@line_user_id, @raw_text, @ai_json, @merged_json, @asked_fields, @outcome, @report_id);
END
GO

IF OBJECT_ID('dbo.SpGetStores', 'P')   IS NOT NULL DROP PROCEDURE dbo.SpGetStores;
IF OBJECT_ID('dbo.SpGetProducts', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetProducts;
GO

IF OBJECT_ID('dbo.SpGetTopics', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetTopics;
GO
CREATE PROCEDURE dbo.SpGetTopics AS
BEGIN SET NOCOUNT ON;
    SELECT code, name_th FROM dbo.M_Topic ORDER BY sort_order;
END
GO

IF OBJECT_ID('dbo.SpGetReportTypes', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetReportTypes;
GO
CREATE PROCEDURE dbo.SpGetReportTypes AS
BEGIN SET NOCOUNT ON;
    SELECT t.code AS k, r.name AS v FROM dbo.M_ReportType r JOIN dbo.M_Topic t ON t.id = r.topic_id;
END
GO

IF OBJECT_ID('dbo.SpGetReportSubtypes', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetReportSubtypes;
GO
CREATE PROCEDURE dbo.SpGetReportSubtypes AS
BEGIN SET NOCOUNT ON;
    SELECT r.name AS k, s.name AS v FROM dbo.M_ReportSubtype s JOIN dbo.M_ReportType r ON r.id = s.report_type_id;
END
GO

IF OBJECT_ID('dbo.SpGetChannels', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetChannels;
GO
CREATE PROCEDURE dbo.SpGetChannels AS
BEGIN SET NOCOUNT ON;
    SELECT DISTINCT channel_mt_kae AS v FROM dbo.M_Store WHERE channel_mt_kae <> '' ORDER BY v;
END
GO

IF OBJECT_ID('dbo.SpGetAccountChannels', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetAccountChannels;
GO
CREATE PROCEDURE dbo.SpGetAccountChannels AS
BEGIN SET NOCOUNT ON;
    SELECT DISTINCT channel_mt_kae AS k, account AS v FROM dbo.M_Store;
END
GO

IF OBJECT_ID('dbo.SpGetStoreRows', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetStoreRows;
GO
CREATE PROCEDURE dbo.SpGetStoreRows AS
BEGIN SET NOCOUNT ON;
    SELECT DISTINCT account, branch, province FROM dbo.M_Store;
END
GO

IF OBJECT_ID('dbo.SpGetCompanies', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetCompanies;
GO
CREATE PROCEDURE dbo.SpGetCompanies AS
BEGIN SET NOCOUNT ON;
    SELECT DISTINCT company AS v FROM dbo.M_Product WHERE company <> '' ORDER BY v;
END
GO

IF OBJECT_ID('dbo.SpGetCategories', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetCategories;
GO
CREATE PROCEDURE dbo.SpGetCategories AS
BEGIN SET NOCOUNT ON;
    SELECT DISTINCT category AS v FROM dbo.M_Product WHERE category <> '' ORDER BY v;
END
GO

IF OBJECT_ID('dbo.SpGetSubCats', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetSubCats;
GO
CREATE PROCEDURE dbo.SpGetSubCats AS
BEGIN SET NOCOUNT ON;
    SELECT DISTINCT category AS k, sub_category AS v FROM dbo.M_Product;
END
GO

IF OBJECT_ID('dbo.SpGetBrandsBySubCat', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetBrandsBySubCat;
GO
CREATE PROCEDURE dbo.SpGetBrandsBySubCat AS
BEGIN SET NOCOUNT ON;
    SELECT DISTINCT sub_category AS k, brand AS v FROM dbo.M_Product;
END
GO

IF OBJECT_ID('dbo.SpGetSizes', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetSizes;
GO
CREATE PROCEDURE dbo.SpGetSizes AS
BEGIN SET NOCOUNT ON;
    SELECT DISTINCT size AS v FROM dbo.M_Product WHERE size <> '' ORDER BY v;
END
GO

IF OBJECT_ID('dbo.SpGetPacks', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetPacks;
GO
CREATE PROCEDURE dbo.SpGetPacks AS
BEGIN SET NOCOUNT ON;
    SELECT DISTINCT pack AS v FROM dbo.M_Product WHERE pack <> '' ORDER BY v;
END
GO

IF OBJECT_ID('dbo.SpGetVariants', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetVariants;
GO
CREATE PROCEDURE dbo.SpGetVariants AS
BEGIN SET NOCOUNT ON;
    SELECT DISTINCT variant AS v FROM dbo.M_Product WHERE variant <> '';
END
GO

IF OBJECT_ID('dbo.SpGetMatchAlias', 'P') IS NOT NULL DROP PROCEDURE dbo.SpGetMatchAlias;
GO
CREATE PROCEDURE dbo.SpGetMatchAlias AS
BEGIN SET NOCOUNT ON;
    SELECT kind, alias, canonical FROM dbo.M_MatchAlias WHERE alias <> '' AND canonical <> '';
END
GO

PRINT '04_procedures: write(4) + read(14) SPs created/updated';
GO

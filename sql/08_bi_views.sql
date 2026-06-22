-- BI views สำหรับทีม Power BI (read-only, ไม่กระทบ data)
-- V_ReportFull = หัว + สินค้า รวม 18 ฟิลด์ + จำนวนรูป (ไม่ดึง binary)
-- V_ReportSummary = 1 แถว/รายงาน สำหรับ dashboard ภาพรวม
-- ใช้ DROP+CREATE (SQL Server เวอร์ชันนี้ไม่รองรับ CREATE OR ALTER)
GO

IF OBJECT_ID('dbo.V_ReportFull','V') IS NOT NULL DROP VIEW dbo.V_ReportFull;
GO
CREATE VIEW dbo.V_ReportFull AS
SELECT r.id AS report_id, r.created_at, r.status, r.topic, r.channel,
       r.account, r.branch, r.company, r.start_date, r.end_date, r.extra,
       i.id AS item_id, i.brand, i.category, i.sub_category, i.size, i.pack,
       i.variant, i.report_type, i.report_subtype, i.detail, i.is_npd,
       (SELECT COUNT(*) FROM dbo.T_Report_Photo p WHERE p.report_id = r.id) AS n_photos
FROM dbo.T_Report r
LEFT JOIN dbo.T_Report_Item i ON i.report_id = r.id;
GO

IF OBJECT_ID('dbo.V_ReportSummary','V') IS NOT NULL DROP VIEW dbo.V_ReportSummary;
GO
CREATE VIEW dbo.V_ReportSummary AS
SELECT r.id AS report_id, r.created_at, r.topic, r.channel, r.account, r.branch,
       r.company, r.start_date, r.end_date,
       (SELECT COUNT(*) FROM dbo.T_Report_Item i WHERE i.report_id = r.id) AS n_items,
       (SELECT COUNT(*) FROM dbo.T_Report_Photo p WHERE p.report_id = r.id) AS n_photos
FROM dbo.T_Report r;
GO

PRINT '08_bi_views: สร้าง V_ReportFull + V_ReportSummary แล้ว';
GO

USE IP1_PROMOREPORTLINE;
GO
/* ============================================================
   09_phase1_fields.sql — Phase 1: เพิ่ม field structured promo / competitive-intel
   idempotent: เพิ่มเฉพาะ column ที่ยังไม่มี (รันบน DB จริงไม่ลบข้อมูล)
   หลังรันไฟล์นี้ ต้องรัน 04_procedures.sql ใหม่ (SpInsertReport/SpInsertReportItem อัปเดตแล้ว)
   ============================================================ */

IF COL_LENGTH('dbo.T_Report','observation_date')   IS NULL ALTER TABLE dbo.T_Report      ADD observation_date DATE NULL;
GO
IF COL_LENGTH('dbo.T_Report_Item','item_note')     IS NULL ALTER TABLE dbo.T_Report_Item ADD item_note NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.T_Report_Item','is_competitor') IS NULL ALTER TABLE dbo.T_Report_Item ADD is_competitor BIT NULL;
GO
IF COL_LENGTH('dbo.T_Report_Item','price_normal')  IS NULL ALTER TABLE dbo.T_Report_Item ADD price_normal DECIMAL(10,2) NULL;
GO
IF COL_LENGTH('dbo.T_Report_Item','price_promo')   IS NULL ALTER TABLE dbo.T_Report_Item ADD price_promo DECIMAL(10,2) NULL;
GO
IF COL_LENGTH('dbo.T_Report_Item','discount_pct')  IS NULL ALTER TABLE dbo.T_Report_Item ADD discount_pct DECIMAL(5,2) NULL;
GO
IF COL_LENGTH('dbo.T_Report_Item','promo_type')    IS NULL ALTER TABLE dbo.T_Report_Item ADD promo_type NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.T_Report_Item','buy_qty')       IS NULL ALTER TABLE dbo.T_Report_Item ADD buy_qty INT NULL;
GO
IF COL_LENGTH('dbo.T_Report_Item','free_qty')      IS NULL ALTER TABLE dbo.T_Report_Item ADD free_qty INT NULL;
GO
IF COL_LENGTH('dbo.T_Report_Item','threshold_baht')IS NULL ALTER TABLE dbo.T_Report_Item ADD threshold_baht DECIMAL(10,2) NULL;
GO
IF COL_LENGTH('dbo.T_Report_Item','stock_status')  IS NULL ALTER TABLE dbo.T_Report_Item ADD stock_status NVARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.T_Report_Item','facings')       IS NULL ALTER TABLE dbo.T_Report_Item ADD facings INT NULL;
GO
PRINT '09_phase1_fields: ครบ (observation_date + 10 item fields)';
GO

USE IP1_PROMOREPORTLINE;
GO

/* ============================================================
   01_schema.sql — canonical schema (ตรงกับ DB จริง)
   M_* = master (ข้อมูลอ้างอิงที่เอาไป match) / T_* = transaction (บอทเขียน)
   idempotent: สร้างเฉพาะตารางที่ยังไม่มี (รันบน DB จริงไม่ลบข้อมูล)
   match logic อยู่ TS (src/domain/match.ts) — ไม่ได้อยู่ใน DB
   ข้อมูลเข้า/ออก ผ่าน stored procedures ใน 04_procedures.sql
   ============================================================ */

/* ---------- MASTER ---------- */

IF OBJECT_ID('dbo.M_Topic','U') IS NULL
CREATE TABLE dbo.M_Topic (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    code       NVARCHAR(50)  NULL,
    name_th    NVARCHAR(100) NULL,
    sort_order INT           NULL
);
GO

IF OBJECT_ID('dbo.M_ReportType','U') IS NULL
CREATE TABLE dbo.M_ReportType (
    id       INT IDENTITY(1,1) PRIMARY KEY,
    topic_id INT           NULL,
    name     NVARCHAR(200) NULL
);
GO

IF OBJECT_ID('dbo.M_ReportSubtype','U') IS NULL
CREATE TABLE dbo.M_ReportSubtype (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    report_type_id INT           NULL,
    name           NVARCHAR(200) NULL
);
GO

IF OBJECT_ID('dbo.M_Store','U') IS NULL
CREATE TABLE dbo.M_Store (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    seq            INT           NULL,
    channel_mt_kae NVARCHAR(20)  NULL,
    channel        NVARCHAR(120) NULL,
    account        NVARCHAR(300) NULL,
    branch         NVARCHAR(200) NULL,
    province       NVARCHAR(100) NULL,
    warehouse      NVARCHAR(50)  NULL,
    ism_zone       NVARCHAR(50)  NULL,
    hq_code        NVARCHAR(50)  NULL,
    ship_to        NVARCHAR(50)  NULL,
    sold_to        NVARCHAR(100) NULL,
    store_code     NVARCHAR(50)  NULL,
    store_type     NVARCHAR(120) NULL,
    master_ism     NVARCHAR(50)  NULL
);
GO

IF OBJECT_ID('dbo.M_Product','U') IS NULL
CREATE TABLE dbo.M_Product (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    company      NVARCHAR(200) NULL,
    category     NVARCHAR(150) NULL,
    sub_category NVARCHAR(200) NULL,
    brand        NVARCHAR(150) NULL,
    size_group   NVARCHAR(100) NULL,
    size         NVARCHAR(100) NULL,
    pack         NVARCHAR(100) NULL,
    variant      NVARCHAR(MAX) NULL
);
GO

IF OBJECT_ID('dbo.M_MatchAlias','U') IS NULL
CREATE TABLE dbo.M_MatchAlias (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    kind       NVARCHAR(20)  NOT NULL,
    alias      NVARCHAR(200) NOT NULL,
    canonical  NVARCHAR(300) NOT NULL,
    note       NVARCHAR(300) NULL,
    created_at DATETIME      NULL DEFAULT SYSDATETIME()
);
GO

/* ---------- TRANSACTION ---------- */

IF OBJECT_ID('dbo.T_Report','U') IS NULL
CREATE TABLE dbo.T_Report (
    id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    line_user_id NVARCHAR(50)  NULL,
    topic        NVARCHAR(100) NULL,
    channel      NVARCHAR(50)  NULL,
    account      NVARCHAR(300) NULL,
    branch       NVARCHAR(200) NULL,
    company      NVARCHAR(200) NULL,
    start_date   DATE          NULL,
    end_date     DATE          NULL,
    note         NVARCHAR(MAX) NULL,
    status       NVARCHAR(20)  NULL DEFAULT 'submitted',
    created_at   DATETIME2     NULL DEFAULT SYSDATETIME(),
    extra        NVARCHAR(MAX) NULL
);
GO

IF OBJECT_ID('dbo.T_Report_Item','U') IS NULL
CREATE TABLE dbo.T_Report_Item (
    id             BIGINT IDENTITY(1,1) PRIMARY KEY,
    report_id      BIGINT        NULL,
    category       NVARCHAR(150) NULL,
    sub_category   NVARCHAR(200) NULL,
    brand          NVARCHAR(150) NULL,
    size           NVARCHAR(100) NULL,
    pack           NVARCHAR(100) NULL,
    variant        NVARCHAR(200) NULL,
    report_type    NVARCHAR(200) NULL,
    report_subtype NVARCHAR(200) NULL,
    detail         NVARCHAR(MAX) NULL,
    is_npd         BIT           NULL DEFAULT 0
);
GO

IF OBJECT_ID('dbo.T_Report_Photo','U') IS NULL
CREATE TABLE dbo.T_Report_Photo (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    report_id   BIGINT         NULL,
    photo_data  VARBINARY(MAX) NULL,
    photo_type  NVARCHAR(20)   NULL,
    uploaded_at DATETIME2      NULL DEFAULT SYSDATETIME(),
    item_index  INT            NULL
);
GO

IF OBJECT_ID('dbo.T_BotSession','U') IS NULL
CREATE TABLE dbo.T_BotSession (
    line_user_id NVARCHAR(100) PRIMARY KEY,
    state        NVARCHAR(MAX) NULL,
    updated_at   DATETIME2     NULL DEFAULT SYSDATETIME()
);
GO

IF OBJECT_ID('dbo.T_ParseLog','U') IS NULL
CREATE TABLE dbo.T_ParseLog (
    id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    line_user_id NVARCHAR(80)  NULL,
    raw_text     NVARCHAR(MAX) NULL,
    ai_json      NVARCHAR(MAX) NULL,
    merged_json  NVARCHAR(MAX) NULL,
    asked_fields NVARCHAR(400) NULL,
    outcome      NVARCHAR(20)  NOT NULL,
    report_id    BIGINT        NULL,
    created_at   DATETIME2     NULL DEFAULT SYSDATETIME()
);
GO

PRINT '01_schema: ครบ 11 ตาราง (M_* master / T_* transaction)';
GO

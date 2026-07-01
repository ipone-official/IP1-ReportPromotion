USE IP1_PROMOREPORTLINE;
GO

/* ============================================================
   10_admin_alias_view.sql — Admin queries for alias review & cleanup
   ============================================================ */

-- 1. แสดงรายการ Alias ที่เรียนรู้จากหน้างานล่าสุด
PRINT '--- Alias ที่ระบบเรียนรู้ล่าสุด ---';
SELECT 
    id,
    kind,
    alias AS [คำพิมพ์ของหน้างาน],
    canonical AS [ห้าง/ร้านในระบบจริง],
    note AS [หมายเหตุ],
    created_at AS [วันที่ระบบบันทึก]
FROM dbo.M_MatchAlias
WHERE note = N'user-correction'
ORDER BY created_at DESC;
GO

-- 2. ค้นหา Alias ที่กำกวม (คำพิมพ์เหมือนกันแต่ถูกจับคู่ไปมากกว่า 1 ห้างจริง)
PRINT '--- ค้นหาคำพิมพ์กำกวม (ชนกัน) ---';
SELECT 
    alias AS [คำพิมพ์หน้างาน], 
    COUNT(DISTINCT canonical) AS [จำนวนร้านค้าจริงที่แมตช์ซ้ำซ้อน]
FROM dbo.M_MatchAlias
GROUP BY alias
HAVING COUNT(DISTINCT canonical) > 1;
GO

-- 3. ค้นหาคำพิมพ์ที่ตรงกับ Master แต่อาจจะไม่จำเป็นต้องมี Alias แยก
PRINT '--- ค้นหา Alias ที่ตัวพิมพ์เหมือนกับห้างจริงอยู่แล้ว (Redundant) ---';
SELECT a.id, a.alias, a.canonical
FROM dbo.M_MatchAlias a
INNER JOIN dbo.M_Store s ON LTRIM(RTRIM(a.alias)) = LTRIM(RTRIM(s.account))
WHERE a.kind = 'store';
GO

/* 
-- หมายเหตุในการลบ/แก้ไข Alias ที่จับคู่ผิด:
-- ลบด้วย ID:
-- DELETE FROM dbo.M_MatchAlias WHERE id = X;

-- แก้ไขคำสะกด Canonical:
-- UPDATE dbo.M_MatchAlias SET canonical = N'ชื่อที่ถูกต้อง' WHERE id = X;
*/

/* 07_chain_thai_alias.sql — Thai alias เพิ่มให้เชนที่ชื่อใน master เป็นอังกฤษ (kind='store')
   เติมเฉพาะที่ยังไม่มี. idempotent (ลบเฉพาะ alias ในชุดนี้ก่อน insert). */

DELETE FROM dbo.M_MatchAlias WHERE kind = N'store' AND alias IN (N'ยูเอฟเอ็ม', N'ยูเอฟเอ็ม ฟูจิ');

INSERT INTO dbo.M_MatchAlias (kind, alias, canonical, note) VALUES
(N'store', N'ยูเอฟเอ็ม', N'UFM ฟูจิ', N'thai-chain'),
(N'store', N'ยูเอฟเอ็ม ฟูจิ', N'UFM ฟูจิ', N'thai-chain');

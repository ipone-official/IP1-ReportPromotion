USE IP1_PROMOREPORTLINE;
GO

/* ============================================================
   11_synonyms_and_clusters.sql
   Seed M_MatchAlias with synonym groups, variant clusters, and subcategory keywords
   to avoid hardcoding FMCG domain rules in TypeScript code.
   ============================================================ */

-- 1. SYNONYM GROUPS (kind = 'synonym')
DELETE FROM dbo.M_MatchAlias WHERE kind = N'synonym';

INSERT INTO dbo.M_MatchAlias (kind, alias, canonical, note) VALUES
(N'synonym', N'ซอง', N'group_pack_bag', N'synonym-pack-bag'),
(N'synonym', N'ถุง', N'group_pack_bag', N'synonym-pack-bag'),

(N'synonym', N'ขวด', N'group_pack_bottle', N'synonym-pack-bottle'),
(N'synonym', N'กระป๋อง', N'group_pack_bottle', N'synonym-pack-bottle'),
(N'synonym', N'กระปุก', N'group_pack_bottle', N'synonym-pack-bottle'),

(N'synonym', N'กล่อง', N'group_pack_box', N'synonym-pack-box'),
(N'synonym', N'ลัง', N'group_pack_box', N'synonym-pack-box'),

(N'synonym', N'แพ็ค', N'group_pack_multi', N'synonym-pack-multi'),
(N'synonym', N'โหล', N'group_pack_multi', N'synonym-pack-multi'),
(N'synonym', N'ชุด', N'group_pack_multi', N'synonym-pack-multi'),
(N'synonym', N'ชิ้น', N'group_pack_multi', N'synonym-pack-multi'),

(N'synonym', N'ลิตร', N'group_unit_liter', N'synonym-unit-liter'),
(N'synonym', N'ล', N'group_unit_liter', N'synonym-unit-liter'),

(N'synonym', N'มล', N'group_unit_ml', N'synonym-unit-ml'),
(N'synonym', N'มิลลิลิตร', N'group_unit_ml', N'synonym-unit-ml');

-- 2. VARIANT CLUSTERS (kind = 'variant_cluster')
DELETE FROM dbo.M_MatchAlias WHERE kind = N'variant_cluster';

INSERT INTO dbo.M_MatchAlias (kind, alias, canonical, note) VALUES
-- Pink Cluster
(N'variant_cluster', N'ชมพู', N'pink', N'variant-pink'),
(N'variant_cluster', N'ซากุระ', N'pink', N'variant-pink'),
(N'variant_cluster', N'sakura', N'pink', N'variant-pink'),
(N'variant_cluster', N'pink', N'pink', N'variant-pink'),
(N'variant_cluster', N'พิงค์', N'pink', N'variant-pink'),
(N'variant_cluster', N'บลอสซั่ม', N'pink', N'variant-pink'),
(N'variant_cluster', N'blossom', N'pink', N'variant-pink'),
(N'variant_cluster', N'ฟลอรัล', N'pink', N'variant-pink'),
(N'variant_cluster', N'floral', N'pink', N'variant-pink'),
(N'variant_cluster', N'โรส', N'pink', N'variant-pink'),
(N'variant_cluster', N'rose', N'pink', N'variant-pink'),

-- Red Cluster
(N'variant_cluster', N'แดง', N'red', N'variant-red'),
(N'variant_cluster', N'แพชชั่น', N'red', N'variant-red'),
(N'variant_cluster', N'passion', N'red', N'variant-red'),
(N'variant_cluster', N'red', N'red', N'variant-red'),
(N'variant_cluster', N'โรแมนซ์', N'red', N'variant-red'),
(N'variant_cluster', N'romance', N'red', N'variant-red'),

-- Blue Cluster
(N'variant_cluster', N'ฟ้า', N'blue', N'variant-blue'),
(N'variant_cluster', N'เฟรช', N'blue', N'variant-blue'),
(N'variant_cluster', N'fresh', N'blue', N'variant-blue'),
(N'variant_cluster', N'blue', N'blue', N'variant-blue'),
(N'variant_cluster', N'มอร์นิ่ง', N'blue', N'variant-blue'),
(N'variant_cluster', N'morning', N'blue', N'variant-blue'),
(N'variant_cluster', N'โอเชี่ยน', N'blue', N'variant-blue'),
(N'variant_cluster', N'ocean', N'blue', N'variant-blue'),

-- White Cluster
(N'variant_cluster', N'ขาว', N'white', N'variant-white'),
(N'variant_cluster', N'เจนเทิล', N'white', N'variant-white'),
(N'variant_cluster', N'gentle', N'white', N'variant-white'),
(N'variant_cluster', N'white', N'white', N'variant-white'),
(N'variant_cluster', N'แป้งเด็ก', N'white', N'variant-white'),
(N'variant_cluster', N'เพียว', N'white', N'variant-white'),
(N'variant_cluster', N'pure', N'white', N'variant-white'),

-- Black Cluster
(N'variant_cluster', N'ดำ', N'black', N'variant-black'),
(N'variant_cluster', N'มิสทีค', N'black', N'variant-black'),
(N'variant_cluster', N'mystique', N'black', N'variant-black'),
(N'variant_cluster', N'black', N'black', N'variant-black'),

-- Purple Cluster
(N'variant_cluster', N'ม่วง', N'purple', N'variant-purple'),
(N'variant_cluster', N'ลาเวนเดอร์', N'purple', N'variant-purple'),
(N'variant_cluster', N'lavender', N'purple', N'variant-purple'),
(N'variant_cluster', N'purple', N'purple', N'variant-purple'),

-- Gold Cluster
(N'variant_cluster', N'ทอง', N'gold', N'variant-gold'),
(N'variant_cluster', N'ลักซ์', N'gold', N'variant-gold'),
(N'variant_cluster', N'luxe', N'gold', N'variant-gold'),
(N'variant_cluster', N'gold', N'gold', N'variant-gold'),
(N'variant_cluster', N'ซันไชน์', N'gold', N'variant-gold'),
(N'variant_cluster', N'sunshine', N'gold', N'variant-gold');

-- 3. SUBCATEGORY DISAMBIGUATION KEYWORDS (kind = 'subcat_keyword')
DELETE FROM dbo.M_MatchAlias WHERE kind = N'subcat_keyword';

INSERT INTO dbo.M_MatchAlias (kind, alias, canonical, note) VALUES
-- ปรับผ้านุ่ม
(N'subcat_keyword', N'ปรับ', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'นุ่ม', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'softener', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'ปรับผ้านุ่ม', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'ซากุระ', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'ชมพู', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'ซันไรส์', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'แพชชั่น', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'มิสทีค', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'ลาเวนเดอร์', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'บลอสซั่ม', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'โรส', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'ฟลอรัล', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'โรมานซ์', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'บูเก้', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'sunrise', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'mystique', N'ปรับผ้านุ่ม', N'subcat-softener'),
(N'subcat_keyword', N'passion', N'ปรับผ้านุ่ม', N'subcat-softener'),

-- ซักผ้า
(N'subcat_keyword', N'ซัก', N'ซักผ้า', N'subcat-detergent'),
(N'subcat_keyword', N'laundry', N'ซักผ้า', N'subcat-detergent'),
(N'subcat_keyword', N'detergent', N'ซักผ้า', N'subcat-detergent'),
(N'subcat_keyword', N'ซักผ้า', N'ซักผ้า', N'subcat-detergent'),
(N'subcat_keyword', N'เจลบอล', N'ซักผ้า', N'subcat-detergent'),
(N'subcat_keyword', N'คลีน', N'ซักผ้า', N'subcat-detergent'),
(N'subcat_keyword', N'ต้านกลิ่นอับ', N'ซักผ้า', N'subcat-detergent'),
(N'subcat_keyword', N'ต้านแบคทีเรีย', N'ซักผ้า', N'subcat-detergent'),
(N'subcat_keyword', N'ตากในร่ม', N'ซักผ้า', N'subcat-detergent'),
(N'subcat_keyword', N'สะอาด', N'ซักผ้า', N'subcat-detergent'),
(N'subcat_keyword', N'indoor', N'ซักผ้า', N'subcat-detergent'),
(N'subcat_keyword', N'clean', N'ซักผ้า', N'subcat-detergent'),

-- ล้างจาน
(N'subcat_keyword', N'ล้างจาน', N'ล้างจาน', N'subcat-dishwash'),
(N'subcat_keyword', N'dish', N'ล้างจาน', N'subcat-dishwash'),
(N'subcat_keyword', N'dishwash', N'ล้างจาน', N'subcat-dishwash'),
(N'subcat_keyword', N'ล้าง', N'ล้างจาน', N'subcat-dishwash'),
(N'subcat_keyword', N'มะนาว', N'ล้างจาน', N'subcat-dishwash'),
(N'subcat_keyword', N'เจลล้างจาน', N'ล้างจาน', N'subcat-dishwash');
DELETE FROM dbo.M_MatchAlias WHERE kind = N'variant_to_subcat';

INSERT INTO dbo.M_MatchAlias (kind, alias, canonical, note) VALUES
(N'variant_to_subcat', N'เจลบอล', N'น้ำยาซักผ้า', N'variant-to-subcat'),
(N'variant_to_subcat', N'ปรับผ้านุ่ม', N'น้ำยาปรับผ้านุ่ม', N'variant-to-subcat'),
(N'variant_to_subcat', N'ซักผ้า', N'น้ำยาซักผ้า', N'variant-to-subcat');
GO

PRINT '11_synonyms_and_clusters seeded';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_M_Store_Account_Branch' AND object_id = OBJECT_ID('dbo.M_Store'))
CREATE NONCLUSTERED INDEX IX_M_Store_Account_Branch ON dbo.M_Store(account, branch);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_M_MatchAlias_Kind_Alias' AND object_id = OBJECT_ID('dbo.M_MatchAlias'))
CREATE NONCLUSTERED INDEX IX_M_MatchAlias_Kind_Alias ON dbo.M_MatchAlias(kind, alias) INCLUDE(canonical);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_M_Product_Brand_SubCategory' AND object_id = OBJECT_ID('dbo.M_Product'))
CREATE NONCLUSTERED INDEX IX_M_Product_Brand_SubCategory ON dbo.M_Product(brand, sub_category);
GO

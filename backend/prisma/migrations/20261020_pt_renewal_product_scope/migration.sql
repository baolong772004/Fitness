ALTER TABLE [dbo].[PtRenewalOption] ADD [ptProductId] INT NULL;
ALTER TABLE [dbo].[Payment] ADD [ptRenewalProductId] INT NULL;

ALTER TABLE [dbo].[PtRenewalOption] ADD CONSTRAINT [PtRenewalOption_ptProductId_fkey]
FOREIGN KEY ([ptProductId]) REFERENCES [dbo].[PtProduct]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [PtRenewalOption_ptProductId_idx] ON [dbo].[PtRenewalOption]([ptProductId]);

ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_ptRenewalProductId_fkey]
FOREIGN KEY ([ptRenewalProductId]) REFERENCES [dbo].[PtProduct]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [Payment_ptRenewalProductId_idx] ON [dbo].[Payment]([ptRenewalProductId]);

-- Preserve legacy level-wide options. Link only names that identify exactly one product.
EXEC sp_executesql N'
UPDATE optionRow SET [ptProductId] = product.[id]
FROM [dbo].[PtRenewalOption] AS optionRow
JOIN [dbo].[PtProduct] AS product
  ON product.[name] = optionRow.[name] AND product.[level] = optionRow.[level]
WHERE NOT EXISTS (
  SELECT 1 FROM [dbo].[PtProduct] AS otherProduct
  WHERE otherProduct.[name] = optionRow.[name]
    AND otherProduct.[level] = optionRow.[level]
    AND otherProduct.[id] <> product.[id]
);';

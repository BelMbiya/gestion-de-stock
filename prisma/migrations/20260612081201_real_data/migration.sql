-- DropIndex
DROP INDEX `Asset_assetGroup_idx` ON `asset`;

-- DropIndex
DROP INDEX `Asset_workstationCode_idx` ON `asset`;

-- CreateIndex
CREATE INDEX `Asset_barcode_idx` ON `Asset`(`barcode`);

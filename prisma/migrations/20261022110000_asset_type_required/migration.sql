-- Lot 4, etape B : chaque materiel a un type.
-- Echoue volontairement si un materiel est reste sans type a l'etape A : fixer son type
-- dans la section « Types fixes a la main » de 20261022100000_asset_types_codes, puis rejouer.
ALTER TABLE `Asset` DROP FOREIGN KEY `Asset_typeId_fkey`;
ALTER TABLE `Asset` MODIFY `typeId` VARCHAR(191) NOT NULL;
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `AssetType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

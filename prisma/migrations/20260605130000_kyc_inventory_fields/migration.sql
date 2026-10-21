-- AlterTable
ALTER TABLE `Asset` ADD COLUMN `systemOs` VARCHAR(191) NULL,
    ADD COLUMN `storageRam` VARCHAR(191) NULL,
    ADD COLUMN `ownerLabel` VARCHAR(191) NULL,
    ADD COLUMN `custodianName` VARCHAR(191) NULL,
    ADD COLUMN `workstationCode` VARCHAR(191) NULL,
    ADD COLUMN `processLabel` VARCHAR(191) NULL,
    ADD COLUMN `assetGroup` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Asset_workstationCode_idx` ON `Asset`(`workstationCode`);
CREATE INDEX `Asset_assetGroup_idx` ON `Asset`(`assetGroup`);

-- Date de retour prevue (echeance) distincte du retour effectif
ALTER TABLE `AssetAssignment` ADD COLUMN `expectedReturnAt` DATETIME(3) NULL;

CREATE INDEX `AssetAssignment_expectedReturnAt_idx` ON `AssetAssignment`(`expectedReturnAt`);

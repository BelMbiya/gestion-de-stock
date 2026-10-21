-- Lot 3, etape B : apres la migration des donnees de l'etape A.
-- Echoue volontairement si une affectation n'a pas de detenteur (holderId NOT NULL).

-- Ancien destinataire (compte applicatif) et departement d'affectation : vides sur toutes les lignes.
ALTER TABLE `AssetAssignment` DROP FOREIGN KEY `AssetAssignment_assignedToId_fkey`;
ALTER TABLE `AssetAssignment` DROP FOREIGN KEY `AssetAssignment_departmentId_fkey`;
DROP INDEX `AssetAssignment_assignedToId_idx` ON `AssetAssignment`;
DROP INDEX `AssetAssignment_departmentId_idx` ON `AssetAssignment`;
ALTER TABLE `AssetAssignment` DROP COLUMN `assignedToId`, DROP COLUMN `departmentId`;

-- Detenteur obligatoire.
ALTER TABLE `AssetAssignment` DROP FOREIGN KEY `AssetAssignment_holderId_fkey`;
ALTER TABLE `AssetAssignment` MODIFY `holderId` VARCHAR(191) NOT NULL;
ALTER TABLE `AssetAssignment` ADD CONSTRAINT `AssetAssignment_holderId_fkey` FOREIGN KEY (`holderId`) REFERENCES `Holder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seuils remplaces par un seuil d'alerte unique (minQuantity) : valeurs par defaut partout.
ALTER TABLE `Asset` DROP COLUMN `reorderPoint`, DROP COLUMN `maxQuantity`;

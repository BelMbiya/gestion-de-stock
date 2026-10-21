-- Lot 3, etape A : ajouts de structure (aucune colonne supprimee) puis migration des donnees.
-- L'etape B (migration suivante) rend le detenteur obligatoire et retire les colonnes inutiles.
-- Rapport a blanc avant application : npm run db:migration-report
-- Regles identiques a lib/migrations/tracking-and-holders.ts (verifiees par repetition sur copie).

-- Mode de suivi : unitaire par defaut, la migration des donnees passe IN STORE / OTHER ASSETS en vrac.
ALTER TABLE `Asset` ADD COLUMN `trackingMode` ENUM('SERIALIZED', 'BULK') NOT NULL DEFAULT 'SERIALIZED';
CREATE INDEX `Asset_trackingMode_idx` ON `Asset`(`trackingMode`);

-- Detenteurs (personnes ou collectifs).
CREATE TABLE `Holder` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('PERSON', 'COLLECTIVE') NOT NULL DEFAULT 'PERSON',
    `fullName` VARCHAR(191) NOT NULL,
    `matricule` VARCHAR(191) NULL,
    `process` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Holder_matricule_key`(`matricule`),
    INDEX `Holder_fullName_idx`(`fullName`),
    INDEX `Holder_active_idx`(`active`),
    INDEX `Holder_departmentId_idx`(`departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Holder` ADD CONSTRAINT `Holder_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Affectations : detenteur (nullable jusqu'a l'etape B), type, issue du retour, auteurs.
ALTER TABLE `AssetAssignment`
    ADD COLUMN `holderId` VARCHAR(191) NULL,
    ADD COLUMN `kind` ENUM('DOTATION', 'LOAN') NOT NULL DEFAULT 'DOTATION',
    ADD COLUMN `returnOutcome` ENUM('GOOD', 'TO_REPAIR', 'LOST') NULL,
    ADD COLUMN `issuedById` VARCHAR(191) NULL,
    ADD COLUMN `returnedById` VARCHAR(191) NULL;

CREATE INDEX `AssetAssignment_holderId_idx` ON `AssetAssignment`(`holderId`);
CREATE INDEX `AssetAssignment_kind_idx` ON `AssetAssignment`(`kind`);
CREATE INDEX `AssetAssignment_issuedById_idx` ON `AssetAssignment`(`issuedById`);
CREATE INDEX `AssetAssignment_returnedById_idx` ON `AssetAssignment`(`returnedById`);

ALTER TABLE `AssetAssignment` ADD CONSTRAINT `AssetAssignment_holderId_fkey` FOREIGN KEY (`holderId`) REFERENCES `Holder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AssetAssignment` ADD CONSTRAINT `AssetAssignment_issuedById_fkey` FOREIGN KEY (`issuedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AssetAssignment` ADD CONSTRAINT `AssetAssignment_returnedById_fkey` FOREIGN KEY (`returnedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Beneficiaire facultatif d'une sortie d'article en vrac.
ALTER TABLE `StockMovement` ADD COLUMN `holderId` VARCHAR(191) NULL;
CREATE INDEX `StockMovement_holderId_idx` ON `StockMovement`(`holderId`);
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_holderId_fkey` FOREIGN KEY (`holderId`) REFERENCES `Holder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Donnees (sans effet sur une base vide)
-- ---------------------------------------------------------------------------

-- 1. Les feuilles IN STORE et OTHER ASSETS sont des quantites : suivi en vrac.
UPDATE `Asset` SET `trackingMode` = 'BULK'
WHERE UPPER(TRIM(`assetGroup`)) IN ('IN STORE', 'OTHER ASSETS');

-- 2. Un detenteur par nom distinct de l'Excel (espaces normalises, casse ignoree).
--    « - » devient le collectif « À identifier » ; « AGENTS... » sont des collectifs.
--    Le process est repris s'il est unique pour ce detenteur.
INSERT INTO `Holder` (`id`, `type`, `fullName`, `process`, `active`, `createdAt`, `updatedAt`)
SELECT
    UUID(),
    CASE
        WHEN MIN(src.displayName) = 'À identifier'
          OR MIN(src.displayName) REGEXP '^agents?([^[:alnum:]]|$)' THEN 'COLLECTIVE'
        ELSE 'PERSON'
    END,
    MIN(src.displayName),
    CASE WHEN COUNT(DISTINCT src.process) = 1 THEN MIN(src.process) ELSE NULL END,
    true,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM (
    SELECT
        CASE
            WHEN TRIM(a.`custodianName`) REGEXP '^[-–—.?]+$' THEN 'À identifier'
            ELSE REGEXP_REPLACE(TRIM(a.`custodianName`), '[[:space:]]+', ' ')
        END AS displayName,
        NULLIF(TRIM(a.`processLabel`), '') AS process
    FROM `Asset` a
    WHERE a.`custodianName` IS NOT NULL AND TRIM(a.`custodianName`) <> ''
) AS src
WHERE NOT EXISTS (SELECT 1 FROM `Holder` h WHERE h.`fullName` = src.displayName)
GROUP BY UPPER(src.displayName);

-- 3. Chaque affectation existante est reliee au detenteur de son actif, en dotation.
UPDATE `AssetAssignment` x
JOIN (
    SELECT
        a.`id` AS assetId,
        CASE
            WHEN TRIM(a.`custodianName`) REGEXP '^[-–—.?]+$' THEN 'À identifier'
            ELSE REGEXP_REPLACE(TRIM(a.`custodianName`), '[[:space:]]+', ' ')
        END AS displayName
    FROM `Asset` a
    WHERE a.`custodianName` IS NOT NULL AND TRIM(a.`custodianName`) <> ''
) AS src ON src.assetId = x.`assetId`
JOIN `Holder` h ON h.`fullName` = src.displayName
SET x.`holderId` = h.`id`, x.`kind` = 'DOTATION'
WHERE x.`holderId` IS NULL;

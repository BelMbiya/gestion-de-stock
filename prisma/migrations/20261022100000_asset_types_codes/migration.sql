-- Lot 4, etape A : types de materiel, familles et codes uniques (MS-0001, LAP-0001…).
-- Structure (ajouts), puis migration des donnees. L'etape B (migration suivante) rend le type obligatoire :
-- elle ECHOUE volontairement si un materiel reste sans type.
-- Regles identiques a lib/catalog/asset-type-catalog.ts et lib/migrations/asset-codes.ts
-- (verifiees code par code par repetition sur une copie). Rapport a blanc : npm run db:codes-report

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
CREATE TABLE `AssetType` (
    `id` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `defaultTrackingMode` ENUM('SERIALIZED', 'BULK') NOT NULL DEFAULT 'SERIALIZED',
    `nextNumber` INTEGER NOT NULL DEFAULT 1,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AssetType_prefix_key`(`prefix`),
    INDEX `AssetType_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AssetType` ADD CONSTRAINT `AssetType_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Asset` ADD COLUMN `importRef` VARCHAR(191) NULL, ADD COLUMN `typeId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Asset_importRef_key` ON `Asset`(`importRef`);
CREATE INDEX `Asset_typeId_idx` ON `Asset`(`typeId`);
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `AssetType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 1. Familles (= categories). Une categorie de meme nom, accents/casse ignores, est reprise et renommee.
-- ---------------------------------------------------------------------------
UPDATE `Category` SET `name` = 'Informatique' WHERE `name` = 'Informatique';
UPDATE `Category` SET `name` = 'Périphériques' WHERE `name` = 'Périphériques';
UPDATE `Category` SET `name` = 'Réseau' WHERE `name` = 'Réseau';
UPDATE `Category` SET `name` = 'Énergie' WHERE `name` = 'Énergie';
UPDATE `Category` SET `name` = 'Mobilier' WHERE `name` = 'Mobilier';
UPDATE `Category` SET `name` = 'Équipements' WHERE `name` = 'Équipements';
UPDATE `Category` SET `name` = 'Véhicules' WHERE `name` = 'Véhicules';

INSERT INTO `Category` (`id`, `name`, `createdAt`, `updatedAt`)
SELECT UUID(), f.name, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
    SELECT 'Informatique' AS name UNION ALL SELECT 'Périphériques' UNION ALL SELECT 'Réseau'
    UNION ALL SELECT 'Énergie' UNION ALL SELECT 'Mobilier' UNION ALL SELECT 'Équipements' UNION ALL SELECT 'Véhicules'
) AS f
WHERE NOT EXISTS (SELECT 1 FROM `Category` c WHERE c.`name` = f.name);

-- ---------------------------------------------------------------------------
-- 2. Les 27 types du catalogue.
-- ---------------------------------------------------------------------------
INSERT INTO `AssetType` (`id`, `prefix`, `name`, `categoryId`, `defaultTrackingMode`, `createdAt`, `updatedAt`)
SELECT UUID(), t.prefix, t.name, c.`id`, t.mode, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
              SELECT 'BAT' AS prefix, 'Batterie' AS name, 'Périphériques' AS family, 'BULK' AS mode
    UNION ALL SELECT 'CBL', 'Câble', 'Périphériques', 'BULK'
    UNION ALL SELECT 'ENR', 'Onduleur / stabilisateur', 'Énergie', 'SERIALIZED'
    UNION ALL SELECT 'SRV', 'Serveur / baie', 'Informatique', 'SERIALIZED'
    UNION ALL SELECT 'PRN', 'Imprimante', 'Périphériques', 'SERIALIZED'
    UNION ALL SELECT 'SCN', 'Scanner', 'Périphériques', 'SERIALIZED'
    UNION ALL SELECT 'POI', 'Pointeuse', 'Équipements', 'SERIALIZED'
    UNION ALL SELECT 'OUT', 'Outillage / EPI', 'Équipements', 'SERIALIZED'
    UNION ALL SELECT 'LAP', 'Laptop', 'Informatique', 'SERIALIZED'
    UNION ALL SELECT 'DSK', 'Ordinateur de bureau', 'Informatique', 'SERIALIZED'
    UNION ALL SELECT 'MON', 'Écran', 'Informatique', 'SERIALIZED'
    UNION ALL SELECT 'TV', 'Téléviseur', 'Périphériques', 'SERIALIZED'
    UNION ALL SELECT 'MS', 'Souris', 'Périphériques', 'BULK'
    UNION ALL SELECT 'KB', 'Clavier', 'Périphériques', 'BULK'
    UNION ALL SELECT 'HS', 'Casque', 'Périphériques', 'BULK'
    UNION ALL SELECT 'WCM', 'Webcam', 'Périphériques', 'BULK'
    UNION ALL SELECT 'SW', 'Switch', 'Réseau', 'SERIALIZED'
    UNION ALL SELECT 'FW', 'Pare-feu', 'Réseau', 'SERIALIZED'
    UNION ALL SELECT 'MDM', 'Modem', 'Réseau', 'BULK'
    UNION ALL SELECT 'PRJ', 'Projecteur', 'Périphériques', 'SERIALIZED'
    UNION ALL SELECT 'EXT', 'Rallonge', 'Énergie', 'BULK'
    UNION ALL SELECT 'CHR', 'Chaise', 'Mobilier', 'BULK'
    UNION ALL SELECT 'TBL', 'Table', 'Mobilier', 'BULK'
    UNION ALL SELECT 'ARM', 'Armoire / casier', 'Mobilier', 'BULK'
    UNION ALL SELECT 'CLM', 'Climatiseur', 'Équipements', 'SERIALIZED'
    UNION ALL SELECT 'ELM', 'Électroménager', 'Équipements', 'BULK'
    UNION ALL SELECT 'VEH', 'Véhicule', 'Véhicules', 'SERIALIZED'
) AS t
JOIN `Category` c ON c.`name` = t.family
WHERE NOT EXISTS (SELECT 1 FROM `AssetType` x WHERE x.`prefix` = t.prefix);

-- ---------------------------------------------------------------------------
-- 3. Classement : types fixes a la main, puis motifs du catalogue dans l'ordre de priorite.
--    Un materiel non reconnu garde typeId NULL : l'etape B refusera de s'appliquer.
-- ---------------------------------------------------------------------------
UPDATE `Asset` a
JOIN `AssetType` t ON t.`prefix` = (
    CASE
        -- Types fixes a la main (decision du 21/10, materiels non reconnus par le classement) :
        WHEN a.`sku` = 'KYC-ARCHIV-0336' THEN 'PRN'   -- CANON 2425i (copieur multifonction)
        WHEN a.`sku` = 'KYC-ARCHIV-0354' THEN 'SW'    -- MVR CALL CENTER (24 ports)
        WHEN a.`sku` = 'KYC-MVRKYC-0355' THEN 'SW'    -- DMS
        WHEN a.`name` REGEXP 'batter(y|ie)' THEN 'BAT'
        WHEN a.`name` REGEXP 'c[aâ]ble' THEN 'CBL'
        WHEN a.`name` REGEXP '\\bups\\b|stabili[sz]er|electrical modul|onduleur' THEN 'ENR'
        WHEN a.`name` REGEXP 'server|serveur|\\brack\\b' THEN 'SRV'
        WHEN a.`name` REGEXP 'deskjet|laser ?jet|printer|imprimante' THEN 'PRN'
        WHEN a.`name` REGEXP 'scanner' THEN 'SCN'
        WHEN a.`name` REGEXP 'lecteurs? de pr.sence|pointeuse' THEN 'POI'
        WHEN a.`name` REGEXP 'drilling|grinder|blower|\\bsaw\\b|goggles|viewfinder' THEN 'OUT'
        WHEN a.`name` REGEXP 'laptop|lenovo|asus|\\bdell\\b' THEN 'LAP'
        WHEN a.`name` REGEXP 'desktop|\\bcomputers?\\b' THEN 'DSK'
        WHEN a.`name` REGEXP 'monitor|[eé]cran' THEN 'MON'
        WHEN a.`name` REGEXP '\\btv\\b|t[eé]l[eé]viseur' THEN 'TV'
        WHEN a.`name` REGEXP 'mouse|souris' THEN 'MS'
        WHEN a.`name` REGEXP 'keyboard|clavier' THEN 'KB'
        WHEN a.`name` REGEXP 'headset|casque' THEN 'HS'
        WHEN a.`name` REGEXP 'webcam' THEN 'WCM'
        WHEN a.`name` REGEXP 'switch' THEN 'SW'
        WHEN a.`name` REGEXP 'firewall|fortinet|pare-feu' THEN 'FW'
        WHEN a.`name` REGEXP 'modem' THEN 'MDM'
        WHEN a.`name` REGEXP 'projector|projecteur' THEN 'PRJ'
        WHEN a.`name` REGEXP 'extension|rallonge' THEN 'EXT'
        WHEN a.`name` REGEXP 'chair|chaise' THEN 'CHR'
        WHEN a.`name` REGEXP '\\btable\\b' THEN 'TBL'
        WHEN a.`name` REGEXP 'cupboard|locker|armoire|casier' THEN 'ARM'
        WHEN a.`name` REGEXP 'air conditioner|climatiseur' THEN 'CLM'
        WHEN a.`name` REGEXP 'kettle|water fountain|fontaine|bouilloire' THEN 'ELM'
        WHEN a.`name` REGEXP 'toyota|v[eé]hicule' THEN 'VEH'
        ELSE NULL
    END
)
SET a.`typeId` = t.`id`
WHERE a.`typeId` IS NULL;

-- 4. L'ancienne reference de l'Excel est conservee.
UPDATE `Asset` SET `importRef` = `sku` WHERE `importRef` IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Decoupage des lignes multiples (« 7 Switch » -> 7 materiels) : unitaires, classes,
--    sans numero de serie ni detenteur. Les copies prennent la reference « …#2 », « …#3 »…
-- ---------------------------------------------------------------------------
INSERT INTO `Asset` (
    `id`, `sku`, `importRef`, `typeId`, `name`, `barcode`, `serialNumber`, `description`, `imageUrl`, `status`,
    `purchaseDate`, `purchaseValue`, `warrantyUntil`, `categoryId`, `locationId`, `createdById`, `createdAt`, `updatedAt`,
    `brand`, `model`, `condition`, `unit`, `quantityOnHand`, `minQuantity`, `supplierId`, `systemOs`, `storageRam`,
    `ownerLabel`, `custodianName`, `workstationCode`, `processLabel`, `assetGroup`, `trackingMode`
)
WITH RECURSIVE seq (n) AS (SELECT 2 UNION ALL SELECT n + 1 FROM seq WHERE n < 100)
SELECT
    UUID(), CONCAT('TMP-', a.`importRef`, '#', seq.n), CONCAT(a.`importRef`, '#', seq.n), a.`typeId`,
    REGEXP_REPLACE(TRIM(a.`name`), '^[0-9]+[[:space:]]+', ''), NULL, NULL, a.`description`, a.`imageUrl`, a.`status`,
    a.`purchaseDate`, a.`purchaseValue`, a.`warrantyUntil`, a.`categoryId`, a.`locationId`, a.`createdById`, a.`createdAt`,
    CURRENT_TIMESTAMP(3), a.`brand`, a.`model`, a.`condition`, a.`unit`, a.`quantityOnHand`, a.`minQuantity`,
    a.`supplierId`, a.`systemOs`, a.`storageRam`, a.`ownerLabel`, a.`custodianName`, a.`workstationCode`,
    a.`processLabel`, a.`assetGroup`, a.`trackingMode`
FROM `Asset` a
JOIN seq ON seq.n <= CAST(REGEXP_SUBSTR(TRIM(a.`name`), '^[0-9]+') AS UNSIGNED)
WHERE a.`trackingMode` = 'SERIALIZED'
  AND a.`typeId` IS NOT NULL
  AND a.`importRef` NOT LIKE '%#%'
  AND TRIM(a.`name`) REGEXP '^[0-9]+[[:space:]]+'
  AND a.`serialNumber` IS NULL
  AND NOT EXISTS (SELECT 1 FROM `AssetAssignment` x WHERE x.`assetId` = a.`id` AND x.`status` = 'ACTIVE');

-- 6. Nom sans le nombre en tete (« 7 Switch » -> « Switch », « 1 switch » -> « switch »),
--    sauf pour une ligne multiple non decoupee (numero de serie ou detenteur : a traiter a la main).
UPDATE `Asset` a
SET a.`name` = REGEXP_REPLACE(TRIM(a.`name`), '^[0-9]+[[:space:]]+', '')
WHERE a.`trackingMode` = 'SERIALIZED'
  AND a.`typeId` IS NOT NULL
  AND TRIM(a.`name`) REGEXP '^[0-9]+[[:space:]]+'
  AND (
      CAST(REGEXP_SUBSTR(TRIM(a.`name`), '^[0-9]+') AS UNSIGNED) <= 1
      OR (
          a.`serialNumber` IS NULL
          AND NOT EXISTS (SELECT 1 FROM (SELECT `assetId` FROM `AssetAssignment` WHERE `status` = 'ACTIVE') x WHERE x.`assetId` = a.`id`)
      )
  );

-- ---------------------------------------------------------------------------
-- 7. Numerotation par type, dans l'ordre des references d'import (puis rang de la copie).
-- ---------------------------------------------------------------------------
UPDATE `Asset` a
JOIN (
    SELECT
        x.`id`,
        t.`prefix`,
        ROW_NUMBER() OVER (
            PARTITION BY x.`typeId`
            ORDER BY CAST(SUBSTRING_INDEX(x.`importRef`, '#', 1) AS BINARY),
                     CAST(IF(LOCATE('#', x.`importRef`) > 0, SUBSTRING_INDEX(x.`importRef`, '#', -1), '1') AS UNSIGNED)
        ) AS rn
    FROM `Asset` x
    JOIN `AssetType` t ON t.`id` = x.`typeId`
) AS numbered ON numbered.`id` = a.`id`
SET a.`sku` = CONCAT(numbered.`prefix`, '-', IF(numbered.rn < 10000, LPAD(numbered.rn, 4, '0'), numbered.rn));

UPDATE `AssetType` t
SET t.`nextNumber` = (SELECT COUNT(*) FROM `Asset` a WHERE a.`typeId` = t.`id`) + 1;

-- ---------------------------------------------------------------------------
-- 8. La categorie decoule du type ; les anciennes categories devenues vides disparaissent.
-- ---------------------------------------------------------------------------
UPDATE `Asset` a JOIN `AssetType` t ON t.`id` = a.`typeId` SET a.`categoryId` = t.`categoryId`;

DELETE FROM `Category`
WHERE `name` NOT IN ('Informatique', 'Périphériques', 'Réseau', 'Énergie', 'Mobilier', 'Équipements', 'Véhicules')
  AND `id` NOT IN (SELECT `categoryId` FROM (SELECT DISTINCT `categoryId` FROM `Asset`) AS used);

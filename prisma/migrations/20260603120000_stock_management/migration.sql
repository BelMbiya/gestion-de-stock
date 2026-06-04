-- Stock management extensions
CREATE TABLE `Supplier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Supplier_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Asset`
    ADD COLUMN `barcode` VARCHAR(191) NULL,
    ADD COLUMN `brand` VARCHAR(191) NULL,
    ADD COLUMN `model` VARCHAR(191) NULL,
    ADD COLUMN `condition` ENUM('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED') NOT NULL DEFAULT 'GOOD',
    ADD COLUMN `unit` VARCHAR(191) NOT NULL DEFAULT 'unite',
    ADD COLUMN `quantityOnHand` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `minQuantity` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `reorderPoint` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `maxQuantity` INTEGER NULL,
    ADD COLUMN `supplierId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Asset_barcode_key` ON `Asset`(`barcode`);
CREATE INDEX `Asset_supplierId_idx` ON `Asset`(`supplierId`);

ALTER TABLE `Asset` ADD CONSTRAINT `Asset_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

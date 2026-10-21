-- CreateTable
CREATE TABLE `PROCO KYC & CALL IT EQUIPEMENT` (
    `id` VARCHAR(191) NOT NULL,
    `section` VARCHAR(191) NULL,
    `rowNo` INTEGER NULL,
    `description` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `system` VARCHAR(191) NULL,
    `hddRam` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `owner` VARCHAR(191) NULL,
    `designatedCustodian` VARCHAR(191) NULL,
    `relativeValue` VARCHAR(191) NULL,
    `lossImplication` TEXT NULL,
    `riskSecurity` TEXT NULL,
    `condition` VARCHAR(191) NULL,
    `purchaseDate` DATETIME(3) NULL,
    `acquisitionDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PROCO KYC & CALL IT EQUIPEMENT_rowNo_idx`(`rowNo`),
    INDEX `PROCO KYC & CALL IT EQUIPEMENT_serialNumber_idx`(`serialNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IN STORE` (
    `id` VARCHAR(191) NOT NULL,
    `rowNo` INTEGER NOT NULL,
    `item` VARCHAR(191) NOT NULL,
    `vendor` VARCHAR(191) NULL,
    `number` INTEGER NOT NULL DEFAULT 1,
    `condition` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IN STORE_rowNo_idx`(`rowNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dispostion KYC` (
    `id` VARCHAR(191) NOT NULL,
    `provisionType` VARCHAR(191) NOT NULL,
    `item` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NULL,
    `total` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Other Assets` (
    `id` VARCHAR(191) NOT NULL,
    `section` VARCHAR(191) NULL,
    `rowNo` INTEGER NULL,
    `brand` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `vinOrSerial` VARCHAR(191) NULL,
    `licensePlate` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `condition` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Other Assets_rowNo_idx`(`rowNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PURCHASE & DELIVERED` (
    `id` VARCHAR(191) NOT NULL,
    `block` VARCHAR(191) NOT NULL,
    `rowNo` INTEGER NULL,
    `item` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `blockDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MATERIAL ACCOUNTS` (
    `id` VARCHAR(191) NOT NULL,
    `zone` VARCHAR(191) NOT NULL,
    `rowNo` INTEGER NOT NULL,
    `item` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `goodCondition` INTEGER NOT NULL DEFAULT 0,
    `badCondition` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MATERIAL ACCOUNTS_zone_idx`(`zone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Equipment Condition` (
    `id` VARCHAR(191) NOT NULL,
    `equipmentType` VARCHAR(191) NOT NULL,
    `management` VARCHAR(191) NULL,
    `count` INTEGER NULL,
    `working` INTEGER NULL,
    `notWorking` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workstations` (
    `id` VARCHAR(191) NOT NULL,
    `side` VARCHAR(191) NOT NULL,
    `rank` VARCHAR(191) NULL,
    `workStation` VARCHAR(191) NOT NULL,
    `serialNumber` VARCHAR(191) NULL,
    `materiels` VARCHAR(191) NULL,
    `user` VARCHAR(191) NULL,
    `process` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Workstations_workStation_idx`(`workStation`),
    INDEX `Workstations_serialNumber_idx`(`serialNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feuil1` (
    `id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `materiels` VARCHAR(191) NULL,
    `user` VARCHAR(191) NULL,
    `process` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

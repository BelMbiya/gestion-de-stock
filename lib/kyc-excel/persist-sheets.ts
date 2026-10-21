import type { PrismaClient } from "../generated/prisma/client";
import type { KycSheetParseResults } from "./sheet-parsers";

export async function persistKycSheetsToDatabase(
  prisma: PrismaClient,
  parsed: KycSheetParseResults,
) {
  await prisma.sheetFeuil1.deleteMany();
  await prisma.sheetWorkstations.deleteMany();
  await prisma.sheetEquipmentCondition.deleteMany();
  await prisma.sheetMaterialAccounts.deleteMany();
  await prisma.sheetPurchaseDelivered.deleteMany();
  await prisma.sheetOtherAssets.deleteMany();
  await prisma.sheetDispostionKyc.deleteMany();
  await prisma.sheetInStore.deleteMany();
  await prisma.sheetProcoKycCallItEquipement.deleteMany();

  await prisma.sheetProcoKycCallItEquipement.createMany({
    data: parsed["PROCO KYC & CALL IT EQUIPEMENT"].map((row) => ({
      section: row.section,
      rowNo: row.rowNo,
      description: row.description,
      model: row.model,
      serialNumber: row.serialNumber,
      systemLabel: row.systemLabel,
      hddRam: row.hddRam,
      location: row.location,
      owner: row.owner,
      designatedCustodian: row.designatedCustodian,
      relativeValue: row.relativeValue,
      lossImplication: row.lossImplication,
      riskSecurity: row.riskSecurity,
      conditionLabel: row.conditionLabel,
      purchaseDate: row.purchaseDate,
      acquisitionDate: row.acquisitionDate,
      statusLabel: row.statusLabel,
    })),
  });

  await prisma.sheetInStore.createMany({
    data: parsed["IN STORE"].map((row) => ({
      rowNo: row.rowNo,
      item: row.item,
      vendor: row.vendor,
      number: row.number,
      condition: row.condition,
    })),
  });

  await prisma.sheetDispostionKyc.createMany({
    data: parsed["Dispostion KYC"].map((row) => ({
      provisionType: row.provisionType,
      item: row.item,
      department: row.department,
      total: row.total,
    })),
  });

  await prisma.sheetOtherAssets.createMany({
    data: parsed["Other Assets"].map((row) => ({
      section: row.section,
      rowNo: row.rowNo,
      brand: row.brand,
      model: row.model,
      vinOrSerial: row.vinOrSerial,
      licensePlate: row.licensePlate,
      location: row.location,
      quantity: row.quantity,
      condition: row.condition,
    })),
  });

  await prisma.sheetPurchaseDelivered.createMany({
    data: parsed["PURCHASE & DELIVERED"].map((row) => ({
      block: row.block,
      rowNo: row.rowNo,
      item: row.item,
      quantity: row.quantity,
      blockDate: row.blockDate,
    })),
  });

  await prisma.sheetMaterialAccounts.createMany({
    data: parsed["MATERIAL ACCOUNTS"].map((row) => ({
      zone: row.zone,
      rowNo: row.rowNo,
      item: row.item,
      quantity: row.quantity,
      goodCondition: row.goodCondition,
      badCondition: row.badCondition,
    })),
  });

  await prisma.sheetEquipmentCondition.createMany({
    data: parsed["Equipment Condition"].map((row) => ({
      equipmentType: row.equipmentType,
      management: row.management,
      count: row.count,
      working: row.working,
      notWorking: row.notWorking,
    })),
  });

  await prisma.sheetWorkstations.createMany({
    data: parsed.Workstations.map((row) => ({
      side: row.side,
      rank: row.rank,
      workStation: row.workStation,
      serialNumber: row.serialNumber,
      materiels: row.materiels,
      user: row.user,
      process: row.process,
      status: row.status,
    })),
  });

  await prisma.sheetFeuil1.createMany({
    data: parsed.Feuil1.map((row) => ({
      status: row.status,
      materiels: row.materiels,
      user: row.user,
      process: row.process,
    })),
  });

  return {
    proco: parsed["PROCO KYC & CALL IT EQUIPEMENT"].length,
    inStore: parsed["IN STORE"].length,
    disposition: parsed["Dispostion KYC"].length,
    otherAssets: parsed["Other Assets"].length,
    purchaseDelivered: parsed["PURCHASE & DELIVERED"].length,
    materialAccounts: parsed["MATERIAL ACCOUNTS"].length,
    equipmentCondition: parsed["Equipment Condition"].length,
    workstations: parsed.Workstations.length,
    feuil1: parsed.Feuil1.length,
  };
}

/** Noms exacts des feuilles du fichier KYC  CALL IT Inventory.xlsx */
export const KYC_EXCEL_SHEET_NAMES = [
  "PROCO KYC & CALL IT EQUIPEMENT",
  "IN STORE",
  "Dispostion KYC",
  "Other Assets",
  "PURCHASE & DELIVERED",
  "MATERIAL ACCOUNTS",
  "Equipment Condition",
  "Workstations",
  "Feuil1",
] as const;

export type KycExcelSheetName = (typeof KYC_EXCEL_SHEET_NAMES)[number];

export const KYC_EXCEL_FILE = "KYC  CALL IT Inventory.xlsx";

/** Feuilles importees comme actifs unitaires / stock */
export const KYC_ASSET_SOURCE_SHEETS = [
  "PROCO KYC & CALL IT EQUIPEMENT",
  "IN STORE",
  "Other Assets",
  "Workstations",
] as const satisfies readonly KycExcelSheetName[];

/** Feuilles de synthese / comptabilite materiel */
export const KYC_SUMMARY_SHEETS = [
  "Dispostion KYC",
  "PURCHASE & DELIVERED",
  "MATERIAL ACCOUNTS",
  "Equipment Condition",
  "Feuil1",
] as const satisfies readonly KycExcelSheetName[];

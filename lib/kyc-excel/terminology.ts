/**
 * Terminologie exacte du fichier KYC  CALL IT Inventory.xlsx
 * (en-tetes de colonnes, feuilles et libelles reutilises dans les vues).
 */
export const KYC_SHEET_LABELS = {
  PROCO_KYC_CALL_IT_EQUIPEMENT: "PROCO KYC & CALL IT EQUIPEMENT",
  IN_STORE: "IN STORE",
  DISPOSTION_KYC: "Dispostion KYC",
  OTHER_ASSETS: "Other Assets",
  PURCHASE_DELIVERED: "PURCHASE & DELIVERED",
  MATERIAL_ACCOUNTS: "MATERIAL ACCOUNTS",
  EQUIPMENT_CONDITION: "Equipment Condition",
  WORKSTATIONS: "Workstations",
  FEUIL1: "Feuil1",
} as const;

export const KYC_SHEET_SECTIONS = {
  IT_EQUIPMENT: "IT EQUIPMENT",
  OTHERS: "OTHERS",
} as const;

/** Colonnes — feuille PROCO KYC & CALL IT EQUIPEMENT */
export const KYC_PROCO_COLUMNS = {
  NO: "No",
  DESCRIPTION: "DESCRIPTION",
  MODEL: "MODEL",
  SERIAL_NUMBER: "SERIAL NUMBER",
  SYSTEM: "SYSTEM",
  HDD_RAM: "HDD/RAM",
  LOCATION: "LOCATION",
  OWNER: "OWNER",
  DESIGNATED_CUSTODIAN: "DESIGNATED CUSTODIAN",
  RELATIVE_VALUE: "RELATIVE VALUE",
  LOSS_IMPLICATION: "LOSS IMPLICAYION & RECOVERY VALUE",
  RISK_SECURITY: "RISK/SECURITY ON ASSET",
  CONDITION: "CONDITION",
  PURCHASE_DATE: "Purchase Date",
  ACQUISITION_DATE: "Date of acquisition",
  STATUS: "Status",
} as const;

/** Colonnes — feuille IN STORE */
export const KYC_IN_STORE_COLUMNS = {
  ITEM: "item",
  VENDOR: "vendor",
  NUMBER: "Number",
  CONDITION: "condition",
} as const;

/** Colonnes — feuille Workstations */
export const KYC_WORKSTATION_COLUMNS = {
  RANK: "RANK",
  WORK_STATION: "WORK STATION",
  SERIAL_NUMBER: "SERIAL NUMBER",
  MATERIELS: "MATERIELS",
  USER: "USER",
  PROCESS: "PROCESS",
  STATUS: "Status",
  CALL_CENTER: "CALL CENTER",
} as const;

/** Colonnes — feuille Other Assets */
export const KYC_OTHER_ASSETS_COLUMNS = {
  INDEX: "Index",
  BRAND: "Brand",
  MODEL: "Model",
  VIN: "VIN",
  LICENSE_PLATE: "License Plate",
  LOCATION: "Location",
} as const;

/** Colonnes — feuille MATERIAL ACCOUNTS */
export const KYC_MATERIAL_ACCOUNTS_COLUMNS = {
  ZONE: "zone",
  ITEM: "item",
  QUANTITY: "quantity",
  GOOD_CONDITION: "good condition",
  BAD_CONDITION: "bad condition",
} as const;

/** Colonnes — feuille Dispostion KYC */
export const KYC_DISPOSITION_COLUMNS = {
  PROVISION_TYPE: "provision type",
  ITEM: "item",
  DEPARTMENT: "department",
  TOTAL: "total",
} as const;

/** Colonnes — feuille PURCHASE & DELIVERED */
export const KYC_PURCHASE_DELIVERED_COLUMNS = {
  BLOCK: "block",
  ITEM: "item",
  QUANTITY: "quantity",
  DATE: "date",
} as const;

/** Colonnes — feuille Equipment Condition */
export const KYC_EQUIPMENT_CONDITION_COLUMNS = {
  EQUIPMENT_TYPE: "equipment type",
  MANAGEMENT: "management",
  COUNT: "count",
  WORKING: "working",
  NOT_WORKING: "not working",
} as const;

/** Colonnes — feuille Feuil1 */
export const KYC_FEUIL1_COLUMNS = {
  STATUS: "Status",
  MATERIELS: "MATERIELS",
  USER: "USER",
  PROCESS: "PROCESS",
} as const;

/** Navigation — libelles alignes sur les feuilles Excel */
export const KYC_NAV = {
  DASHBOARD: "Tableau de bord",
  INVENTORY: KYC_SHEET_LABELS.PROCO_KYC_CALL_IT_EQUIPEMENT,
  STOCK: KYC_SHEET_LABELS.IN_STORE,
  ASSIGNMENTS: KYC_SHEET_LABELS.WORKSTATIONS,
  TECHNICIANS: "Techniciens",
  SUPPORT: "Assistance IT",
  INCIDENTS: "Pannes",
  HISTORY: "Historique",
  REPORTS: "Rapports",
  SETTINGS: "Parametres",
  MOVEMENTS: "Mouvements",
  TRANSFERS: "Transferts",
} as const;

/** Libelles communs des vues (colonnes Excel + champs operationnels) */
export const KYC_VIEW = {
  PHOTO: "Photo",
  CATEGORY: "Categorie",
  DEPARTMENT: "Departement",
  SUPPLIER: "Fournisseur",
  BARCODE: "Code-barres",
  NOTES: "Notes",
  ACTIONS: "Actions",
  DATE: "Date",
  TYPE: "Type",
  REASON: "Motif",
  FROM: "Depuis",
  TO: "Vers",
  QTY: "Qte",
  REFERENCE: "Reference",
  SEVERITY: "Criticite",
  TECHNICIAN: "Technicien",
  INCIDENT: "Panne",
  REMISE: "Remise",
  EXPECTED_RETURN: "Retour prevu",
  ACTUAL_RETURN: "Retour effectif",
  STATE: "Etat",
  PROGRESS: "Progression",
  INDICATOR: "Indicateur",
  VALUE: "Valeur",
  DETAIL: "Detail",
  ALL_DESCRIPTIONS: `Tous — ${KYC_PROCO_COLUMNS.DESCRIPTION}`,
  OPEN_INCIDENT: "Panne ouverte",
  ASSET_VALUE: "Valeur estimee",
  PURCHASE_PRICE: "Prix d'achat (USD)",
  CODE: "Code",
  NAME: "Nom",
  LINKED_ITEMS: "Items lies",
  EXPECTED_LOCATION: "LOCATION attendue",
  GROUP: "Groupe",
  WARRANTY_UNTIL: "Fin garantie",
  CREATED_AT: "Cree le",
  UPDATED_AT: "Modifie le",
  TRACKED_ITEMS: "Items suivis",
  INVENTORY_BASE: "Base inventaire",
  OPEN_EXCLUDING_CLOSED: "Hors resolues/cloturees",
  LOGGED_CHECKS: "Checks historises",
  PRIORITY_RISKS: "Risques prioritaires",
  STATUS_BREAKDOWN: "Repartition par Status",
  EXPORT_PREVIEW: "Apercu inventaire exporte",
  IT_ASSETS: "Actifs IT",
  OPEN_INCIDENTS: "Pannes ouvertes",
  INVENTORY_CHECKS: "Controles inventaire",
  ESTIMATED_VALUE: "Valeur estimee",
} as const;

/** Libelles communs reutilises dans les vues (alignes Excel) */
export const KYC_UI = {
  ...KYC_PROCO_COLUMNS,
  ...KYC_IN_STORE_COLUMNS,
  ...KYC_WORKSTATION_COLUMNS,
  ...KYC_NAV,
  ...KYC_VIEW,
  ALL: "Tous",
  ALL_ITEMS: "Tous les items",
  OPTIONAL: "(optionnel)",
  SEARCH_PLACEHOLDER: "Rechercher No, DESCRIPTION, SERIAL NUMBER, MODEL…",
  NO_RESULTS: "Aucun item trouve",
} as const;

export type KycAssetOption = {
  id: string;
  sku?: string;
  name: string;
  serialNumber?: string | null;
  model?: string | null;
  assignable?: boolean;
};

export function formatKycAssetLabel(asset: KycAssetOption) {
  const parts = [asset.sku ?? asset.id, asset.name].filter(Boolean);
  if (asset.serialNumber) {
    parts.push(asset.serialNumber);
  }
  return parts.join(" — ");
}

export function filterKycAssets(assets: KycAssetOption[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return assets;
  }

  return assets.filter((asset) =>
    [asset.sku, asset.name, asset.serialNumber, asset.model]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

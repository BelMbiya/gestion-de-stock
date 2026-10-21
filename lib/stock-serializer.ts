import type { TrackingMode } from "@/lib/generated/prisma/enums";
import { assetStatusLabels } from "@/lib/stock/asset-state";
import { getTrackingPolicy, stockLevelLabels, trackingModeLabels } from "@/lib/stock/tracking-policy";

import { conditionLabels } from "@/lib/stock-management";

type AssetWithRelations = {
  /** Affectation active uniquement (filtre status = ACTIVE dans la requete). */
  assignments: Array<{
    id: string;
    kind: string;
    expectedReturnAt: Date | null;
    holder: { id: string; fullName: string };
  }>;
  category: { id: string; name: string };
  incidents: Array<{ reference: string }>;
  location: { id: string; name: string } | null;
  supplier: { id: string; name: string; code: string } | null;
  barcode: string | null;
  brand: string | null;
  imageUrl: string | null;
  condition: string;
  createdAt: Date;
  description: string | null;
  id: string;
  minQuantity: number;
  model: string | null;
  name: string;
  purchaseDate: Date | null;
  purchaseValue: { toString(): string } | null;
  quantityOnHand: number;
  serialNumber: string | null;
  sku: string;
  status: string;
  trackingMode: TrackingMode;
  unit: string;
  systemOs: string | null;
  storageRam: string | null;
  ownerLabel: string | null;
  custodianName: string | null;
  workstationCode: string | null;
  processLabel: string | null;
  assetGroup: string | null;
  updatedAt: Date;
  warrantyUntil: Date | null;
};

/** Include Prisma correspondant a serializeAsset : detenteur actuel, panne ouverte, referentiels. */
export const serializableAssetInclude = {
  category: true,
  location: true,
  supplier: true,
  assignments: {
    where: { status: "ACTIVE" as const },
    include: { holder: { select: { id: true, fullName: true } } },
    take: 1,
  },
  incidents: {
    where: { status: { notIn: ["RESOLVED" as const, "CLOSED" as const] } },
    orderBy: { updatedAt: "desc" as const },
    take: 1,
  },
};

export function serializeAsset(asset: AssetWithRelations) {
  const currentAssignment = asset.assignments[0];
  const openIncident = asset.incidents[0];
  const stockStatus = getTrackingPolicy(asset.trackingMode).stockLevel(asset);

  return {
    id: asset.id,
    sku: asset.sku,
    barcode: asset.barcode,
    serialNumber: asset.serialNumber,
    name: asset.name,
    description: asset.description,
    brand: asset.brand,
    model: asset.model,
    imageUrl: asset.imageUrl,
    systemOs: asset.systemOs,
    storageRam: asset.storageRam,
    ownerLabel: asset.ownerLabel,
    /** Libelle brut de l'Excel (trace d'import) ; le detenteur reel est `assignedTo`. */
    custodianName: asset.custodianName,
    workstationCode: asset.workstationCode,
    processLabel: asset.processLabel,
    assetGroup: asset.assetGroup,
    trackingMode: asset.trackingMode,
    trackingModeLabel: trackingModeLabels[asset.trackingMode],
    category: asset.category.name,
    categoryId: asset.category.id,
    location: asset.location?.name ?? "Non localise",
    locationId: asset.location?.id ?? "",
    supplier: asset.supplier?.name ?? "-",
    supplierId: asset.supplier?.id ?? "",
    status: assetStatusLabels[asset.status as keyof typeof assetStatusLabels] ?? asset.status,
    statusCode: asset.status,
    condition: conditionLabels[asset.condition as keyof typeof conditionLabels] ?? asset.condition,
    conditionCode: asset.condition,
    unit: asset.unit,
    quantityOnHand: asset.quantityOnHand,
    minQuantity: asset.minQuantity,
    stockStatus,
    stockStatusLabel: stockLevelLabels[stockStatus],
    /** Detenteur actuel (affectation active), sinon « En stock ». */
    assignedTo: currentAssignment?.holder.fullName ?? "En stock",
    holderId: currentAssignment?.holder.id ?? null,
    activeAssignmentId: currentAssignment?.id ?? null,
    openIncident: openIncident?.reference ?? null,
    value: asset.purchaseValue ? `$${asset.purchaseValue.toString()}` : "-",
    purchaseValue: asset.purchaseValue?.toString() ?? "",
    purchaseDate: asset.purchaseDate ? asset.purchaseDate.toISOString().slice(0, 10) : "",
    warrantyUntil: asset.warrantyUntil ? asset.warrantyUntil.toISOString().slice(0, 10) : "",
    updatedAt: asset.updatedAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
    createdAt: asset.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
  };
}

export type SerializedAsset = ReturnType<typeof serializeAsset>;

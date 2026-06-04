import {
  assetStatusLabels,
  conditionLabels,
  getStockLevelLabel,
  getStockLevelStatus,
} from "@/lib/stock-management";

type AssetWithRelations = {
  assignments: Array<{
    assignedTo: { name: string | null } | null;
    department: { name: string } | null;
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
  maxQuantity: number | null;
  minQuantity: number;
  model: string | null;
  name: string;
  purchaseDate: Date | null;
  purchaseValue: { toString(): string } | null;
  quantityOnHand: number;
  reorderPoint: number;
  serialNumber: string | null;
  sku: string;
  status: string;
  unit: string;
  updatedAt: Date;
  warrantyUntil: Date | null;
};

export function serializeAsset(asset: AssetWithRelations) {
  const currentAssignment = asset.assignments[0];
  const openIncident = asset.incidents[0];
  const stockStatus = getStockLevelStatus(
    asset.quantityOnHand,
    asset.reorderPoint,
    asset.minQuantity,
    asset.maxQuantity,
  );

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
    category: asset.category.name,
    categoryId: asset.category.id,
    location: asset.location?.name ?? "Non localise",
    locationId: asset.location?.id ?? "",
    supplier: asset.supplier?.name ?? "-",
    supplierId: asset.supplier?.id ?? "",
    status: assetStatusLabels[asset.status] ?? asset.status,
    statusCode: asset.status,
    condition: conditionLabels[asset.condition] ?? asset.condition,
    conditionCode: asset.condition,
    unit: asset.unit,
    quantityOnHand: asset.quantityOnHand,
    minQuantity: asset.minQuantity,
    reorderPoint: asset.reorderPoint,
    maxQuantity: asset.maxQuantity,
    stockStatus,
    stockStatusLabel: getStockLevelLabel(stockStatus),
    assignedTo:
      currentAssignment?.assignedTo?.name ??
      currentAssignment?.department?.name ??
      "Stock IT",
    openIncident: openIncident?.reference ?? null,
    value: asset.purchaseValue ? `$${asset.purchaseValue.toString()}` : "-",
    purchaseValue: asset.purchaseValue?.toString() ?? "",
    purchaseDate: asset.purchaseDate
      ? asset.purchaseDate.toISOString().slice(0, 10)
      : "",
    warrantyUntil: asset.warrantyUntil
      ? asset.warrantyUntil.toISOString().slice(0, 10)
      : "",
    updatedAt: asset.updatedAt.toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }),
    createdAt: asset.createdAt.toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }),
  };
}

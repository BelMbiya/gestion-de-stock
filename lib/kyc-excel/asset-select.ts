/** Champs Asset pour les listes de recherche (terminologie KYC). */
export const kycAssetListSelect = {
  id: true,
  name: true,
  sku: true,
  serialNumber: true,
  model: true,
} as const;

export type KycAssetListRecord = {
  id: string;
  name: string;
  sku: string;
  serialNumber: string | null;
  model: string | null;
};

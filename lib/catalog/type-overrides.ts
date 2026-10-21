/**
 * Types fixes a la main pour les materiels de l'Excel que le classement ne reconnait pas
 * (reference d'import -> prefixe du catalogue). A garder identique a la section
 * « Types fixes a la main » de la migration 20261022100000_asset_types_codes.
 * Decision du 21/10.
 */
export const KYC_TYPE_OVERRIDES: Record<string, string> = {
  "KYC-ARCHIV-0336": "PRN", // CANON 2425i (copieur multifonction)
  "KYC-ARCHIV-0354": "SW", // MVR CALL CENTER (24 ports)
  "KYC-MVRKYC-0355": "SW", // DMS
};

import {
  ASSET_FAMILIES,
  ASSET_TYPE_CATALOG,
  classifyAssetName,
  findAssetTypeDefinition,
} from "@/lib/catalog/asset-type-catalog";
import { formatAssetCode } from "@/lib/catalog/asset-code";

export type CodesMigrationSnapshot = {
  assets: Array<{
    id: string;
    sku: string;
    importRef: string | null;
    name: string;
    trackingMode: string;
    status: string;
    serialNumber: string | null;
    /** Prefixe du type deja attribue (base migree) ; null avant migration. */
    typePrefix: string | null;
    hasActiveAssignment: boolean;
    categoryName: string;
  }>;
  categories: Array<{ id: string; name: string }>;
  types: Array<{ prefix: string; nextNumber: number }>;
};

/** Types fixes a la main pour les materiels que le classement ne reconnait pas : reference d'import -> prefixe. */
export type TypeOverrides = Record<string, string>;

export type PlannedCode = {
  key: string;
  sourceAssetId: string;
  isCopy: boolean;
  importRef: string;
  name: string;
  prefix: string;
  code: string;
  family: string;
};

/** « 7 Switch » -> 7 x « Switch » ; un nom sans nombre en tete compte pour 1. */
export function splitMultiUnitName(name: string) {
  const value = name.trim();
  const match = /^(\d+)\s+(.+)$/.exec(value);
  if (!match || Number(match[1]) < 1) {
    return { count: 1, baseName: value };
  }
  return { count: Number(match[1]), baseName: match[2].trim() };
}

/** Comparaison insensible a la casse et aux accents (« Reseau » = « Réseau »), comme MySQL. */
const sameName = (a: string, b: string) =>
  a.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase() ===
  b.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Ordre de numerotation : reference d'import, puis rang de la copie (#2, #3…). */
function compareImportRefs(a: string, b: string) {
  const [baseA, indexA = "1"] = a.split("#");
  const [baseB, indexB = "1"] = b.split("#");
  if (baseA !== baseB) return baseA < baseB ? -1 : 1;
  return Number(indexA) - Number(indexB);
}

/**
 * Plan pur (aucune ecriture) de la migration des codes : classement par type, decoupage des lignes
 * multiples, numerotation par type et familles. Bloquant tant qu'un materiel n'a pas de type.
 */
export function planAssetCodesMigration(snapshot: CodesMigrationSnapshot, overrides: TypeOverrides = {}) {
  for (const [ref, prefix] of Object.entries(overrides)) {
    if (!findAssetTypeDefinition(prefix)) {
      throw new Error(`Type fixe inconnu pour ${ref} : ${prefix} (absent du catalogue).`);
    }
  }

  const entries: Omit<PlannedCode, "code" | "family">[] = [];
  const splits: Array<{ assetId: string; sku: string; count: number; baseName: string }> = [];
  const unclassified: Array<{ assetId: string; sku: string; name: string }> = [];
  const anomalies: Array<{ type: "SPLIT_BLOCKED"; assetId: string; sku: string; detail: string }> = [];

  for (const asset of snapshot.assets) {
    if (asset.typePrefix !== null) continue; // deja migre

    const { count, baseName } = splitMultiUnitName(asset.name);
    const prefix = overrides[asset.sku] ?? classifyAssetName(baseName);
    if (!prefix) {
      unclassified.push({ assetId: asset.id, sku: asset.sku, name: asset.name });
      continue;
    }

    const isSerializedMulti = asset.trackingMode === "SERIALIZED" && count > 1;
    const blocked = isSerializedMulti && (asset.serialNumber !== null || asset.hasActiveAssignment);
    if (blocked) {
      anomalies.push({
        type: "SPLIT_BLOCKED",
        assetId: asset.id,
        sku: asset.sku,
        detail: `« ${asset.name} » a un numero de serie ou un detenteur : a decouper a la main.`,
      });
    }

    const units = isSerializedMulti && !blocked ? count : 1;
    if (units > 1) splits.push({ assetId: asset.id, sku: asset.sku, count, baseName });
    const name = asset.trackingMode === "SERIALIZED" && !blocked ? baseName : asset.name;

    for (let index = 1; index <= units; index += 1) {
      entries.push({
        key: index === 1 ? asset.id : `${asset.id}#${index}`,
        sourceAssetId: asset.id,
        isCopy: index > 1,
        importRef: index === 1 ? asset.sku : `${asset.sku}#${index}`,
        name,
        prefix,
      });
    }
  }

  entries.sort((a, b) => compareImportRefs(a.importRef, b.importRef));

  const typeCounters: Record<string, number> = Object.fromEntries(
    snapshot.types.map((type) => [type.prefix, type.nextNumber]),
  );
  const codes: PlannedCode[] = entries.map((entry) => {
    const next = typeCounters[entry.prefix] ?? 1;
    typeCounters[entry.prefix] = next + 1;
    return {
      ...entry,
      code: formatAssetCode(entry.prefix, next),
      family: findAssetTypeDefinition(entry.prefix)!.family,
    };
  });

  const familyNames = ASSET_FAMILIES.map((family) => family.name);
  const familiesToCreate = familyNames.filter(
    (family) => !snapshot.categories.some((category) => sameName(category.name, family)),
  );
  const categoriesToRename = snapshot.categories.flatMap((category) => {
    const family = familyNames.find((name) => sameName(name, category.name));
    return family && family !== category.name ? [{ from: category.name, to: family }] : [];
  });
  const categoriesToRemove = snapshot.categories
    .filter((category) => !familyNames.some((family) => sameName(family, category.name)))
    .map((category) => category.name);

  const newAssets = splits.reduce((sum, split) => sum + split.count - 1, 0);

  return {
    codes,
    splits,
    unclassified,
    anomalies,
    blocking: unclassified.length > 0,
    familiesToCreate,
    categoriesToRename,
    categoriesToRemove,
    typeCounters,
    summary: {
      assetsBefore: snapshot.assets.length,
      assetsAfter: snapshot.assets.length + newAssets,
      coded: codes.length,
      splits: splits.length,
      newAssets,
      unclassified: unclassified.length,
      types: ASSET_TYPE_CATALOG.length,
      changes: codes.length + familiesToCreate.length + categoriesToRename.length + categoriesToRemove.length,
    },
  };
}

export type AssetCodesPlan = ReturnType<typeof planAssetCodesMigration>;

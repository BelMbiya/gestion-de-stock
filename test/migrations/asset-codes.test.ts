// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hasKycWorkbook, loadKycInventoryFromExcel } from "@/lib/import-kyc-inventory";
import {
  type CodesMigrationSnapshot,
  planAssetCodesMigration,
  splitMultiUnitName,
} from "@/lib/migrations/asset-codes";
import { holderKeyFor, trackingModeForGroup } from "@/lib/migrations/tracking-and-holders";

type SnapshotAsset = CodesMigrationSnapshot["assets"][number];

const asset = (sku: string, name: string, overrides: Partial<SnapshotAsset> = {}): SnapshotAsset => ({
  id: `id-${sku}`,
  sku,
  importRef: null,
  name,
  trackingMode: "SERIALIZED",
  status: "AVAILABLE",
  serialNumber: null,
  typePrefix: null,
  hasActiveAssignment: false,
  categoryName: "Autre",
  ...overrides,
});

const snapshot = (assets: SnapshotAsset[], categories = ["Autre", "Desktop", "Mobilier", "Power"]): CodesMigrationSnapshot => ({
  assets,
  categories: categories.map((name) => ({ id: `cat-${name}`, name })),
  types: [],
});

describe("Migration codes — nom d'une ligne multiple", () => {
  it.each([
    ["7 Switch", 7, "Switch"],
    ["2 Switch Cisco", 2, "Switch Cisco"],
    ["6 Rack 42U", 6, "Rack 42U"],
    ["1 switch", 1, "switch"],
    ["Switch", 1, "Switch"],
    ["HP LAPTOP I5", 1, "HP LAPTOP I5"],
  ])("%s -> %i x %s", (name, count, baseName) => {
    expect(splitMultiUnitName(name)).toEqual({ count, baseName });
  });
});

describe("Migration codes — decoupage et attribution", () => {
  it("decoupe « 7 Switch » en 7 materiels codes, la reference d'import garde le lien", () => {
    const plan = planAssetCodesMigration(snapshot([asset("KYC-MVRKYC-0356", "7 Switch")]));

    const switches = plan.codes.filter((code) => code.prefix === "SW");
    expect(switches.map((code) => code.code)).toEqual(["SW-0001", "SW-0002", "SW-0003", "SW-0004", "SW-0005", "SW-0006", "SW-0007"]);
    expect(switches.map((code) => code.importRef)).toEqual([
      "KYC-MVRKYC-0356",
      "KYC-MVRKYC-0356#2",
      "KYC-MVRKYC-0356#3",
      "KYC-MVRKYC-0356#4",
      "KYC-MVRKYC-0356#5",
      "KYC-MVRKYC-0356#6",
      "KYC-MVRKYC-0356#7",
    ]);
    expect(switches.every((code) => code.name === "Switch")).toBe(true);
    expect(switches.filter((code) => code.isCopy)).toHaveLength(6);
    expect(plan.summary).toMatchObject({ assetsBefore: 1, assetsAfter: 7, splits: 1, newAssets: 6 });
  });

  it("« 1 switch » n'est pas decoupe mais son nom est nettoye", () => {
    const plan = planAssetCodesMigration(snapshot([asset("KYC-ARCHIV-0350", "1 switch")]));

    expect(plan.splits).toHaveLength(0);
    expect(plan.codes).toEqual([expect.objectContaining({ code: "SW-0001", name: "switch", isCopy: false })]);
  });

  it("PRUDENCE : ne decoupe pas une ligne qui a un numero de serie ou un detenteur", () => {
    const plan = planAssetCodesMigration(
      snapshot([
        asset("A-1", "3 Blowers", { serialNumber: "SN-1" }),
        asset("A-2", "2 TV", { hasActiveAssignment: true }),
      ]),
    );

    expect(plan.splits).toHaveLength(0);
    expect(plan.codes).toHaveLength(2);
    expect(plan.anomalies.map((anomaly) => anomaly.sku).sort()).toEqual(["A-1", "A-2"]);
    expect(plan.anomalies.every((anomaly) => anomaly.type === "SPLIT_BLOCKED")).toBe(true);
  });

  it("ne decoupe jamais une ligne en vrac", () => {
    const plan = planAssetCodesMigration(snapshot([asset("STO-0013", "Mouse vodacom", { trackingMode: "BULK" })]));

    expect(plan.codes).toEqual([expect.objectContaining({ code: "MS-0001", isCopy: false })]);
  });

  it("numerote dans l'ordre des references d'import", () => {
    const plan = planAssetCodesMigration(
      snapshot([asset("KYC-ITEQUI-0002", "HP LAPTOP I5"), asset("KYC-ITEQUI-0001", "HP LAPTOP I7")]),
    );

    expect(plan.codes.map((code) => [code.importRef, code.code])).toEqual([
      ["KYC-ITEQUI-0001", "LAP-0001"],
      ["KYC-ITEQUI-0002", "LAP-0002"],
    ]);
    expect(plan.typeCounters.LAP).toBe(3);
  });
});

describe("Migration codes — materiels non classes", () => {
  const unknown = [asset("KYC-ARCHIV-0336", "CANON"), asset("KYC-ITEQUI-0001", "HP LAPTOP I5")];

  it("BLOQUE la migration tant qu'un materiel n'a pas de type", () => {
    const plan = planAssetCodesMigration(snapshot(unknown));

    expect(plan.blocking).toBe(true);
    expect(plan.unclassified).toEqual([expect.objectContaining({ sku: "KYC-ARCHIV-0336", name: "CANON" })]);
    expect(plan.codes.some((code) => code.importRef === "KYC-ARCHIV-0336")).toBe(false);
  });

  it("un type fixe explicitement debloque la migration", () => {
    const plan = planAssetCodesMigration(snapshot(unknown), { "KYC-ARCHIV-0336": "PRN" });

    expect(plan.blocking).toBe(false);
    expect(plan.codes).toEqual(expect.arrayContaining([expect.objectContaining({ importRef: "KYC-ARCHIV-0336", code: "PRN-0001" })]));
  });

  it("refuse un type fixe qui n'existe pas dans le catalogue", () => {
    expect(() => planAssetCodesMigration(snapshot(unknown), { "KYC-ARCHIV-0336": "ZZZ" })).toThrow(/ZZZ/);
  });
});

describe("Migration codes — familles", () => {
  it("cree les familles manquantes et retire les anciennes categories", () => {
    const plan = planAssetCodesMigration(snapshot([asset("A-1", "HP DESKTOP I3", { categoryName: "Desktop" })]));

    expect(plan.familiesToCreate).toEqual(["Informatique", "Périphériques", "Réseau", "Énergie", "Équipements", "Véhicules"]);
    expect(plan.categoriesToRemove.sort()).toEqual(["Autre", "Desktop", "Power"]);
    expect(plan.codes[0]).toMatchObject({ code: "DSK-0001", family: "Informatique" });
  });

  it("IDEMPOTENT : rejouee sur une base deja migree, elle ne change rien", () => {
    const migrated = snapshot(
      [
        asset("DSK-0001", "HP DESKTOP I3", { importRef: "KYC-ARCHIV-0331", typePrefix: "DSK", categoryName: "Informatique" }),
        asset("SW-0001", "Switch", { importRef: "KYC-MVRKYC-0356", typePrefix: "SW", categoryName: "Réseau" }),
      ],
      ["Informatique", "Périphériques", "Réseau", "Énergie", "Mobilier", "Équipements", "Véhicules"],
    );
    migrated.types = [{ prefix: "DSK", nextNumber: 2 }, { prefix: "SW", nextNumber: 2 }];

    const replay = planAssetCodesMigration(migrated);

    expect(replay.codes).toEqual([]);
    expect(replay.splits).toEqual([]);
    expect(replay.familiesToCreate).toEqual([]);
    expect(replay.categoriesToRemove).toEqual([]);
    expect(replay.summary.changes).toBe(0);
  });
});

// Donnees reelles : tourne en local quand le classeur est present, ignore en CI.
describe.skipIf(!hasKycWorkbook())("Migration codes — sur le classeur KYC reel", () => {
  const assets = loadKycInventoryFromExcel().map((item) =>
    asset(item.sku, item.name, {
      id: item.sku,
      trackingMode: trackingModeForGroup(item.assetGroup),
      status: item.status,
      serialNumber: item.serialNumber,
      hasActiveAssignment: holderKeyFor(item.custodianName) !== null,
    }),
  );

  it("422 lignes -> 454 materiels, 11 lignes decoupees, 3 non classes qui bloquent", () => {
    const plan = planAssetCodesMigration(snapshot(assets));

    expect(plan.summary).toMatchObject({ assetsBefore: 422, assetsAfter: 454, splits: 11, newAssets: 32 });
    expect(plan.unclassified.map((item) => item.name).sort()).toEqual(["CANON", "DMS", "MVR CALL CENTER"]);
    expect(plan.blocking).toBe(true);
  });

  it("avec un type pour ces 3 materiels : 454 codes uniques", () => {
    const plan = planAssetCodesMigration(snapshot(assets), {
      "KYC-ARCHIV-0336": "PRN",
      "KYC-ARCHIV-0354": "OUT",
      "KYC-MVRKYC-0355": "OUT",
    });

    expect(plan.blocking).toBe(false);
    expect(plan.codes).toHaveLength(454);
    expect(new Set(plan.codes.map((code) => code.code)).size).toBe(454);
  });
});

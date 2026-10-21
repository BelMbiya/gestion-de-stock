// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ASSET_FAMILIES, ASSET_TYPE_CATALOG, classifyAssetName } from "@/lib/catalog/asset-type-catalog";

describe("Catalogue des types de materiel", () => {
  it("contient les 27 types valides, chacun dans une famille connue", () => {
    expect(ASSET_TYPE_CATALOG).toHaveLength(27);
    const families = new Set(ASSET_FAMILIES.map((family) => family.name));
    for (const type of ASSET_TYPE_CATALOG) {
      expect(families.has(type.family), `${type.prefix} -> ${type.family}`).toBe(true);
    }
  });

  it("utilise les 7 familles validees", () => {
    expect(ASSET_FAMILIES.map((family) => family.name)).toEqual([
      "Informatique",
      "Périphériques",
      "Réseau",
      "Énergie",
      "Mobilier",
      "Équipements",
      "Véhicules",
    ]);
  });

  it("a des prefixes uniques de 2 a 4 majuscules", () => {
    const prefixes = ASSET_TYPE_CATALOG.map((type) => type.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    for (const prefix of prefixes) {
      expect(prefix).toMatch(/^[A-Z]{2,4}$/);
    }
  });

  it.each([
    ["LAP", "SERIALIZED"],
    ["DSK", "SERIALIZED"],
    ["SW", "SERIALIZED"],
    ["VEH", "SERIALIZED"],
    ["MS", "BULK"],
    ["CBL", "BULK"],
    ["CHR", "BULK"],
  ])("le type %s est suivi par defaut en %s", (prefix, mode) => {
    expect(ASSET_TYPE_CATALOG.find((type) => type.prefix === prefix)?.defaultTrackingMode).toBe(mode);
  });
});

describe("Classement d'un nom de materiel", () => {
  it.each([
    ["HP DESKTOP I3", "DSK"],
    ["DESKTOP", "DSK"],
    ["Computers Vodacom", "DSK"],
    ["LENOVO I5", "LAP"],
    ["DELL I7", "LAP"],
    ["ASUS LAPTOP", "LAP"],
    ["Laptop", "LAP"],
    ["Monitor vodacom", "MON"],
    ["Mouse vodacom", "MS"],
    ["keyboard", "KB"],
    ["Beien headset", "HS"],
    ["Power cable vodacom", "CBL"],
    ["HDMI cable", "CBL"],
    ["2 Switch Cisco", "SW"],
    ["FORTINET", "FW"],
    ["Huawei Modem", "MDM"],
    ["HP LASER JET PRO", "PRN"],
    ["5 TV", "TV"],
    ["6 Rack 42U", "SRV"],
    ["Stabiliser CC", "ENR"],
    ["UPS", "ENR"],
    ["CHAIR", "CHR"],
    ["CUPBOARD", "ARM"],
    ["air conditioner", "CLM"],
    ["KETTLE", "ELM"],
    ["Toyota", "VEH"],
    ["2 Lecteurs de présence", "POI"],
    ["8 Safety goggles", "OUT"],
  ])("%s -> %s", (name, prefix) => {
    expect(classifyAssetName(name)).toBe(prefix);
  });

  it.each([
    // Le plus specifique l'emporte : ces cas etaient mal classes dans l'apercu.
    ["lenovo battery", "BAT"],
    ["hp battery", "BAT"],
    ["Electrical modul server", "ENR"],
    ["Stabiliser Server", "ENR"],
  ])("REGRESSION : %s -> %s (et non le type plus general)", (name, prefix) => {
    expect(classifyAssetName(name)).toBe(prefix);
  });

  it.each(["CANON", "MVR CALL CENTER", "DMS", ""])("ne devine pas un type inconnu (%s)", (name) => {
    expect(classifyAssetName(name)).toBeNull();
  });
});

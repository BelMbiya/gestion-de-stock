// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildFullReportPdfSections, buildFullReportSheets, type FullReportData } from "@/lib/reports/full-report";

function assignment(index: number, active: boolean) {
  return {
    active,
    asset: "HP LAPTOP I5",
    assetCode: `LAP-${String(index).padStart(4, "0")}`,
    assignedAt: "01/06/2026",
    department: "INBOUND",
    holder: `Agent ${index}`,
    kind: "Dotation",
    notes: "",
    returnedAt: active ? "" : "02/06/2026",
    status: active ? "En cours" : "Retourne",
  };
}

const data: FullReportData = {
  generatedAt: "23/10/2026 10:00",
  summary: [
    { label: "Actifs IT", value: "2", hint: "Articles suivis" },
    { label: "Statut — Disponible", value: "1", hint: "" },
  ],
  assets: [
    {
      category: "Informatique",
      code: "LAP-0001",
      holders: "Agent 1",
      location: "Mandala Square",
      name: "HP LAPTOP I5",
      quantity: "1",
      status: "Affecte",
      type: "Laptop",
      updatedAt: "22/10/2026",
      value: "0",
    },
    {
      category: "Accessoires",
      code: "MS-0001",
      holders: "",
      location: "Mandala Square",
      name: "Mouse vodacom",
      quantity: "129",
      status: "Disponible",
      type: "Souris",
      updatedAt: "22/10/2026",
      value: "0",
    },
  ],
  incidents: [
    {
      asset: "HP LAPTOP I5",
      assetCode: "LAP-0001",
      assignee: "Technicien",
      identifiedAt: "20/10/2026",
      lastUpdate: "Diagnostic",
      open: true,
      reference: "INC-0001",
      severity: "Haute",
      status: "Diagnostic",
      title: "Ecran noir",
    },
    {
      asset: "HP LAPTOP I5",
      assetCode: "LAP-0001",
      assignee: "Technicien",
      identifiedAt: "01/10/2026",
      lastUpdate: "Repare",
      open: false,
      reference: "INC-0000",
      severity: "Basse",
      status: "Cloture",
      title: "Clavier",
    },
  ],
  movements: [
    {
      asset: "Mouse vodacom",
      assetCode: "MS-0001",
      date: "21/10/2026",
      from: "",
      performedBy: "Manager IT",
      quantity: "-3",
      reason: "Sortie",
      to: "",
      type: "Sortie stock",
    },
  ],
  assignments: Array.from({ length: 300 }, (_, index) => assignment(index + 1, index % 3 !== 0)),
};

describe("S3 — rapport complet (Excel)", () => {
  it("produit 5 feuilles dans l'ordre : Synthese, Stock, Pannes, Mouvements, Affectations", () => {
    expect(buildFullReportSheets(data).map((sheet) => sheet.name)).toEqual([
      "Synthese",
      "Stock",
      "Pannes",
      "Mouvements",
      "Affectations",
    ]);
  });

  it("n'omet aucune ligne (300 affectations -> 300 lignes)", () => {
    const sheets = buildFullReportSheets(data);
    const byName = Object.fromEntries(sheets.map((sheet) => [sheet.name, sheet]));

    expect(byName.Stock.rows).toHaveLength(2);
    expect(byName.Pannes.rows).toHaveLength(2);
    expect(byName.Mouvements.rows).toHaveLength(1);
    expect(byName.Affectations.rows).toHaveLength(300);
  });

  it("chaque feuille commence par le code materiel quand elle concerne un materiel", () => {
    const sheets = buildFullReportSheets(data);

    for (const name of ["Stock", "Pannes", "Mouvements", "Affectations"]) {
      const sheet = sheets.find((item) => item.name === name)!;
      expect(sheet.columns).toContain("Code");
      const codeIndex = sheet.columns.indexOf("Code");
      expect(sheet.rows[0][codeIndex]).toMatch(/^[A-Z]+-\d{4}$/);
    }
  });

  it("les colonnes et les lignes ont la meme largeur, en texte", () => {
    for (const sheet of buildFullReportSheets(data)) {
      for (const row of sheet.rows) {
        expect(row).toHaveLength(sheet.columns.length);
        expect(row.every((cell) => typeof cell === "string")).toBe(true);
      }
    }
  });
});

describe("S3 — rapport complet (PDF) : lisible, centre sur ce qui est a traiter", () => {
  it("contient la synthese, tout le stock, les pannes ouvertes et les affectations en cours", () => {
    const sections = buildFullReportPdfSections(data);

    expect(sections.map((section) => section.title)).toEqual([
      "Synthese",
      "Stock",
      "Pannes ouvertes",
      "Affectations en cours",
    ]);
    expect(sections[1].rows).toHaveLength(2);
    expect(sections[2].rows.map((row) => row[0])).toEqual(["INC-0001"]);
    expect(sections[3].rows).toHaveLength(200);
  });
});

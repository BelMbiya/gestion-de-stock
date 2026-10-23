import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardContent } from "@/components/dashboard-content";

const mocks = vi.hoisted(() => ({
  aoaToSheet: vi.fn((rows: unknown[][]) => ({ rows })),
  bookAppendSheet: vi.fn(),
  bookNew: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
  exportTablePdf: vi.fn(async () => undefined),
  writeFile: vi.fn(),
}));

vi.mock("xlsx", () => ({
  utils: {
    aoa_to_sheet: mocks.aoaToSheet,
    book_append_sheet: mocks.bookAppendSheet,
    book_new: mocks.bookNew,
  },
  writeFile: mocks.writeFile,
}));

vi.mock("@/lib/pdf-export", () => ({
  exportTablePdf: mocks.exportTablePdf,
  fileStamp: () => "2026-10-23",
}));

const dashboardPayload = {
  stats: [{ label: "Actifs IT", value: "454", hint: "Depuis la base", icon: "HardDrive" }],
  inventoryItems: [],
  incidents: [],
};

const reportPayload = {
  generatedAt: "23/10/2026 10:00",
  summary: [{ label: "Actifs IT", value: "454", hint: "Articles suivis" }],
  assets: [
    {
      category: "Informatique",
      code: "LAP-0001",
      holders: "",
      location: "Mandala Square",
      name: "HP LAPTOP I5",
      quantity: "1",
      status: "Disponible",
      type: "Laptop",
      updatedAt: "22/10/2026",
      value: "0",
    },
  ],
  incidents: [],
  movements: [],
  assignments: [],
};

describe("S3 — le Tableau de bord porte l'export du rapport complet", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => (url === "/api/reports" ? reportPayload : dashboardPayload),
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("propose « Rapport PDF » et « Rapport Excel » sans charger le rapport a l'ouverture", async () => {
    render(<DashboardContent />);

    expect(await screen.findByRole("button", { name: "Rapport PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rapport Excel" })).toBeInTheDocument();
    // L'ancien export partiel du tableau de bord fait doublon : il disparait.
    expect(screen.queryByRole("button", { name: "Exporter PDF" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/reports", expect.anything());
  });

  it("Rapport Excel : charge /api/reports a la demande et ecrit le classeur complet", async () => {
    render(<DashboardContent />);

    fireEvent.click(await screen.findByRole("button", { name: "Rapport Excel" }));

    await waitFor(() => {
      expect(mocks.writeFile).toHaveBeenCalledWith(expect.anything(), "rapport-complet-2026-10-23.xlsx");
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/reports", { cache: "no-store" });
    expect(mocks.bookAppendSheet.mock.calls.map((call) => call[2])).toEqual([
      "Synthese",
      "Stock",
      "Pannes",
      "Mouvements",
      "Affectations",
    ]);
  });

  it("Rapport PDF : exporte les sections du rapport complet", async () => {
    render(<DashboardContent />);

    fireEvent.click(await screen.findByRole("button", { name: "Rapport PDF" }));

    await waitFor(() => {
      expect(mocks.exportTablePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "rapport-complet",
          title: "Rapport complet IT Inventory",
        }),
      );
    });
  });

  it("affiche l'erreur si le rapport ne peut pas etre genere", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/reports"
        ? { ok: false, status: 500, json: async () => ({ error: "Erreur serveur" }) }
        : { ok: true, status: 200, json: async () => dashboardPayload },
    );
    render(<DashboardContent />);

    fireEvent.click(await screen.findByRole("button", { name: "Rapport Excel" }));

    expect(await screen.findByText("Impossible de generer le rapport complet.")).toBeInTheDocument();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
});

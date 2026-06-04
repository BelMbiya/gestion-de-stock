import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportsContent } from "@/components/reports-content";

const exportMocks = vi.hoisted(() => {
  const bookAppendSheet = vi.fn();
  const bookNew = vi.fn(() => ({ SheetNames: [], Sheets: {} }));
  const jsonToSheet = vi.fn((rows: unknown[]) => ({ rows }));
  const pdfSave = vi.fn();
  const writeFile = vi.fn();

  const pdfDocument = {
    internal: {
      pageSize: {
        getWidth: vi.fn(() => 297),
      },
    },
    addImage: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    save: pdfSave,
    setFillColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setPage: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
  };

  return {
    autoTable: vi.fn(),
    bookAppendSheet,
    bookNew,
    jsonToSheet,
    jsPDF: vi.fn(function MockJsPdf() {
      return pdfDocument;
    }),
    pdfDocument,
    pdfSave,
    writeFile,
  };
});

vi.mock("@/lib/pdf-export", () => ({
  drawPdfPageNumbers: vi.fn(),
  drawPdfTitleSection: vi.fn(() => 42),
  loadProcoLogoDataUrl: vi.fn(async () => "data:image/png;base64,logo"),
}));

vi.mock("jspdf", () => ({
  jsPDF: exportMocks.jsPDF,
}));

vi.mock("jspdf-autotable", () => ({
  default: exportMocks.autoTable,
}));

vi.mock("xlsx", () => ({
  utils: {
    book_append_sheet: exportMocks.bookAppendSheet,
    book_new: exportMocks.bookNew,
    json_to_sheet: exportMocks.jsonToSheet,
  },
  writeFile: exportMocks.writeFile,
}));

const reportsPayload = {
  assignments: [
    {
      agent: "Berami Mbaya",
      asset: "Cisco ISR 4331",
      department: "Departement IT",
      notes: "Remis avec chargeur",
      remiseAt: "2 juin 2026",
      returnedAt: "-",
      status: "Alloue",
    },
  ],
  assets: [
    {
      assignedTo: "Departement IT",
      category: "Network",
      location: "Site Mining A",
      name: "Cisco ISR 4331",
      sku: "IT-RTR-015",
      status: "Critique",
      updatedAt: "02/06/2026 13:00",
      value: "3820",
    },
  ],
  breakdowns: {
    byCategory: [{ label: "Network", value: 1 }],
    byLocation: [{ label: "Site Mining A", value: 1 }],
    bySeverity: [{ label: "Haute", value: 1 }],
    byStatus: [{ label: "Critique", value: 1 }],
  },
  generatedAt: "mardi 2 juin 2026 a 15:30",
  incidents: [
    {
      asset: "Cisco ISR 4331",
      assignee: "Equipe reseau",
      identifiedAt: "02/06/2026 13:00",
      lastUpdate: "Diagnostic en cours",
      reference: "INC-2406-018",
      severity: "Haute",
      status: "Diagnostic",
      title: "Perte intermittente de liaison WAN",
    },
  ],
  movements: [
    {
      asset: "Cisco ISR 4331",
      from: "Site Mining A",
      movedAt: "02/06/2026 13:00",
      performedBy: "System",
      reason: "Transfert maintenance",
      to: "Datacenter Kinshasa",
      type: "Transfert",
    },
  ],
  risks: [
    {
      asset: "Cisco ISR 4331",
      location: "Site Mining A",
      status: "Critique",
    },
  ],
  summary: [
    { hint: "Materiels suivis", label: "Actifs IT", value: 1 },
    { hint: "Base inventaire", label: "Valeur estimee", value: "$3,820" },
  ],
};

describe("ReportsContent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => reportsPayload,
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    exportMocks.autoTable.mockClear();
    exportMocks.bookAppendSheet.mockClear();
    exportMocks.bookNew.mockClear();
    exportMocks.jsonToSheet.mockClear();
    exportMocks.jsPDF.mockClear();
    exportMocks.pdfSave.mockClear();
    exportMocks.writeFile.mockClear();
    vi.unstubAllGlobals();
  });

  it("affiche le rapport consolide et active les exports PDF et Excel", async () => {
    render(<ReportsContent />);

    expect((await screen.findAllByText("Cisco ISR 4331")).length).toBeGreaterThan(0);
    expect(screen.getByText("Rapports IT Inventory")).toBeInTheDocument();
    expect(screen.getByText("Risques prioritaires")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exporter PDF/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Excel/i })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledWith("/api/reports", {
      cache: "no-store",
    });
  });

  it("genere le PDF et le fichier Excel avec les bons formats", async () => {
    render(<ReportsContent />);

    await screen.findAllByText("Cisco ISR 4331");
    fireEvent.click(screen.getByRole("button", { name: /Exporter PDF/i }));
    fireEvent.click(screen.getByRole("button", { name: /Excel/i }));

    await waitFor(() => {
      expect(exportMocks.jsPDF).toHaveBeenCalledWith({
        format: "a4",
        orientation: "landscape",
        unit: "mm",
      });
      expect(exportMocks.autoTable).toHaveBeenCalledTimes(2);
      expect(exportMocks.pdfSave).toHaveBeenCalledWith(
        expect.stringMatching(/^rapport-it-inventory-\d{4}-\d{2}-\d{2}\.pdf$/),
      );
      expect(exportMocks.writeFile).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringMatching(/^rapport-it-inventory-\d{4}-\d{2}-\d{2}\.xlsx$/),
      );
    });

    expect(exportMocks.bookAppendSheet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ rows: reportsPayload.assets }),
      "Inventaire",
    );
    expect(exportMocks.bookAppendSheet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ rows: reportsPayload.incidents }),
      "Pannes",
    );
    expect(exportMocks.bookAppendSheet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ rows: reportsPayload.assignments }),
      "Affectations",
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => {
  const save = vi.fn();
  const doc = {
    addImage: vi.fn(),
    addPage: vi.fn(),
    internal: { pageSize: { getWidth: () => 297 } },
    getNumberOfPages: () => 1,
    rect: vi.fn(),
    save,
    setFillColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setPage: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
  };

  return {
    autoTable: vi.fn((_target: unknown, options?: { startY?: number }) => {
      Object.assign(doc, { lastAutoTable: { finalY: (options?.startY ?? 42) + 20 } });
    }),
    doc,
    jsPDF: vi.fn(function MockJsPdf() {
      return doc;
    }),
    save,
  };
});

vi.mock("jspdf", () => ({
  jsPDF: pdfMocks.jsPDF,
}));

vi.mock("jspdf-autotable", () => ({
  default: pdfMocks.autoTable,
}));

import {
  drawPdfTitleSection,
  exportTablePdf,
  loadProcoLogoDataUrl,
} from "@/lib/pdf-export";

describe("pdf-export", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("charge le logo PROCO pour les en-tetes PDF", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["logo"], { type: "image/png" }),
    });

    const readAsDataURL = vi.fn(function mockRead(this: FileReader) {
      Object.defineProperty(this, "result", {
        value: "data:image/png;base64,logo",
      });
      this.onload?.({} as ProgressEvent<FileReader>);
    });

    class MockFileReader {
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;
      readAsDataURL = readAsDataURL;
    }

    vi.stubGlobal("FileReader", MockFileReader);

    const dataUrl = await loadProcoLogoDataUrl();

    expect(dataUrl).toBe("data:image/png;base64,logo");
    expect(fetchMock).toHaveBeenCalledWith("/assets/proco-logo.png");
  });

  it("exporte un tableau PDF avec logo et pagination", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["logo"], { type: "image/png" }),
    });

    class MockFileReader {
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;
      readAsDataURL = vi.fn(function mockRead(this: FileReader) {
        Object.defineProperty(this, "result", {
          value: "data:image/png;base64,logo",
        });
        this.onload?.({} as ProgressEvent<FileReader>);
      });
    }

    vi.stubGlobal("FileReader", MockFileReader);

    await exportTablePdf({
      filename: "test-export",
      sections: [
        {
          columns: ["Colonne"],
          rows: [["Valeur"]],
        },
      ],
      subtitle: "Sous-titre",
      title: "Titre test",
    });

    expect(pdfMocks.save).toHaveBeenCalledWith(
      expect.stringMatching(/^test-export-\d{4}-\d{2}-\d{2}\.pdf$/),
    );
    expect(pdfMocks.autoTable).toHaveBeenCalled();
  });

  it("dessine le logo a gauche du titre", () => {
    const doc = {
      addImage: vi.fn(),
      internal: { pageSize: { getWidth: () => 297 } },
      rect: vi.fn(),
      setFillColor: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      text: vi.fn(),
    };

    const startY = drawPdfTitleSection(
      doc as never,
      { title: "Test", subtitle: "Sous-titre" },
      "data:image/png;base64,logo",
    );

    expect(doc.addImage).toHaveBeenCalled();
    expect(doc.text).toHaveBeenCalledWith("Test", 48, 16);
    expect(startY).toBeGreaterThan(34);
  });
});

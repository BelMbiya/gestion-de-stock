import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { jsPDF as JsPDFType } from "jspdf";

const LOGO_PATH = "/assets/proco-logo.png";

let cachedLogoDataUrl: string | null = null;

export async function loadProcoLogoDataUrl() {
  if (cachedLogoDataUrl) {
    return cachedLogoDataUrl;
  }

  const response = await fetch(LOGO_PATH);

  if (!response.ok) {
    return null;
  }

  const blob = await response.blob();
  cachedLogoDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  return cachedLogoDataUrl;
}

export type PdfTitleSection = {
  subtitle: string;
  title: string;
};

const HEADER_HEIGHT = 34;
const LOGO_X = 10;
const LOGO_Y = 5;
const LOGO_WIDTH = 32;
const LOGO_HEIGHT = 24;
const TEXT_START_X_WITH_LOGO = 48;
const TEXT_START_X_WITHOUT_LOGO = 14;

export type PdfTableSection = {
  columns: string[];
  rows: string[][];
  title?: string;
};

export function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}

function getLastTableY(doc: JsPDFType) {
  const lastTable = (doc as JsPDFType & { lastAutoTable?: { finalY: number } })
    .lastAutoTable;
  return lastTable?.finalY ?? 42;
}

export async function exportTablePdf(options: {
  filename: string;
  sections: PdfTableSection[];
  subtitle: string;
  title: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logoDataUrl = await loadProcoLogoDataUrl();
  let startY = drawPdfTitleSection(
    doc,
    { title: options.title, subtitle: options.subtitle },
    logoDataUrl,
  );

  for (const section of options.sections) {
    if (!section.rows.length) {
      continue;
    }

    if (startY > 175) {
      doc.addPage();
      startY = 20;
    }

    if (section.title) {
      doc.setTextColor(22, 28, 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(section.title, 14, startY);
      startY += 7;
    }

    autoTable(doc, {
      body: section.rows,
      head: [section.columns],
      margin: { left: 14, right: 14 },
      startY,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [255, 47, 69], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 247, 255] },
    });

    startY = getLastTableY(doc) + 12;
  }

  drawPdfPageNumbers(doc);
  doc.save(`${options.filename}-${fileStamp()}.pdf`);
}

export function drawPdfTitleSection(
  doc: JsPDFType,
  section: PdfTitleSection,
  logoDataUrl: string | null,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const textStartX = logoDataUrl ? TEXT_START_X_WITH_LOGO : TEXT_START_X_WITHOUT_LOGO;

  doc.setFillColor(10, 16, 48);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, "F");

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", LOGO_X, LOGO_Y, LOGO_WIDTH, LOGO_HEIGHT);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(section.title, textStartX, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(section.subtitle, textStartX, 24);

  return HEADER_HEIGHT + 8;
}

export function drawPdfPageNumbers(doc: JsPDFType) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setTextColor(120, 127, 150);
    doc.setFontSize(8);
    doc.text(`Page ${page}/${pageCount}`, pageWidth - 28, 202);
  }
}

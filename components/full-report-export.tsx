"use client";

import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import * as XLSX from "xlsx";

import { ErrorNotice } from "@/components/error-notice";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { exportTablePdf, fileStamp } from "@/lib/pdf-export";
import { buildFullReportPdfSections, buildFullReportSheets, type FullReportData } from "@/lib/reports/full-report";
import { ui } from "@/lib/ui-styles";

type Format = "pdf" | "excel";

const FILENAME = "rapport-complet";

function writeWorkbook(data: FullReportData) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of buildFullReportSheets(data)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([sheet.columns, ...sheet.rows]), sheet.name);
  }
  XLSX.writeFile(workbook, `${FILENAME}-${fileStamp()}.xlsx`);
}

/** Rapport complet (ex-onglet Rapports) : charge a la demande, pour ne pas alourdir le Tableau de bord. */
export function FullReportExport() {
  const [pending, setPending] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportReport(format: Format) {
    setPending(format);
    setError(null);
    try {
      const response = await apiFetch("/api/reports", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: FullReportData = await response.json();
      if (format === "excel") {
        writeWorkbook(data);
      } else {
        await exportTablePdf({
          filename: FILENAME,
          sections: buildFullReportPdfSections(data),
          subtitle: `PROCO & Cie - Genere le ${data.generatedAt}`,
          title: "Rapport complet IT Inventory",
        });
      }
    } catch {
      setError("Impossible de generer le rapport complet.");
    } finally {
      setPending(null);
    }
  }

  const icon = (format: Format, Icon: typeof FileDown) =>
    pending === format ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />;

  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      <div className="flex flex-wrap gap-2">
        <Button className={ui.btnPrimary} disabled={pending !== null} onClick={() => void exportReport("pdf")} type="button">
          {icon("pdf", FileDown)}
          Rapport PDF
        </Button>
        <Button className={ui.btnSecondary} disabled={pending !== null} onClick={() => void exportReport("excel")} type="button">
          {icon("excel", FileSpreadsheet)}
          Rapport Excel
        </Button>
      </div>
      <ErrorNotice message={error} />
    </div>
  );
}

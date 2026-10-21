"use client";

import { Download, FileSpreadsheet, FileText, PieChart } from "lucide-react";
import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import {
  drawPdfPageNumbers,
  drawPdfTitleSection,
  loadProcoLogoDataUrl,
} from "@/lib/pdf-export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ui } from "@/lib/ui-styles";
import { KYC_IN_STORE_COLUMNS, KYC_PROCO_COLUMNS, KYC_UI, KYC_WORKSTATION_COLUMNS } from "@/lib/kyc-excel/terminology";

type SummaryItem = {
  hint: string;
  label: string;
  value: number | string;
};

type BreakdownItem = {
  label: string;
  value: number;
};

type ReportAsset = {
  assignedTo: string;
  category: string;
  location: string;
  name: string;
  sku: string;
  status: string;
  updatedAt: string;
  value: string;
};

type ReportIncident = {
  asset: string;
  assignee: string;
  identifiedAt: string;
  lastUpdate: string;
  reference: string;
  severity: string;
  status: string;
  title: string;
};

type ReportMovement = {
  asset: string;
  from: string;
  movedAt: string;
  performedBy: string;
  reason: string;
  to: string;
  type: string;
};

type ReportAssignment = {
  agent: string;
  asset: string;
  department: string;
  notes: string;
  remiseAt: string;
  returnedAt: string;
  status: string;
};

type ReportRisk = {
  asset: string;
  location: string;
  status: string;
};

type ReportsData = {
  assignments: ReportAssignment[];
  assets: ReportAsset[];
  breakdowns: {
    byCategory: BreakdownItem[];
    byLocation: BreakdownItem[];
    bySeverity: BreakdownItem[];
    byStatus: BreakdownItem[];
  };
  generatedAt: string;
  incidents: ReportIncident[];
  movements: ReportMovement[];
  risks: ReportRisk[];
  summary: SummaryItem[];
};

function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function exportPdf(data: ReportsData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logoDataUrl = await loadProcoLogoDataUrl();
  const contentStartY = drawPdfTitleSection(
    doc,
    {
      title: "Rapport IT Inventory",
      subtitle: `PROCO & Cie - Genere le ${data.generatedAt}`,
    },
    logoDataUrl,
  );

  data.summary.forEach((item, index) => {
    const x = 14 + index * 68;
    doc.setFillColor(245, 247, 255);
    doc.roundedRect(x, contentStartY, 58, 24, 3, 3, "F");
    doc.setTextColor(255, 47, 69);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(String(item.value), x + 5, contentStartY + 11);
    doc.setTextColor(22, 28, 60);
    doc.setFontSize(8);
    doc.text(item.label, x + 5, contentStartY + 18);
  });

  autoTable(doc, {
    body: data.assets.slice(0, 18).map((asset) => [
      asset.sku,
      asset.name,
      asset.category,
      asset.location,
      asset.assignedTo,
      asset.status,
      asset.value,
    ]),
    head: [[KYC_PROCO_COLUMNS.NO, KYC_PROCO_COLUMNS.DESCRIPTION, "Categorie", KYC_PROCO_COLUMNS.LOCATION, KYC_PROCO_COLUMNS.DESIGNATED_CUSTODIAN, KYC_PROCO_COLUMNS.STATUS, KYC_PROCO_COLUMNS.RELATIVE_VALUE]],
    margin: { left: 14, right: 14 },
    startY: contentStartY + 34,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [255, 47, 69], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 247, 255] },
  });

  autoTable(doc, {
    body: data.incidents.slice(0, 12).map((incident) => [
      incident.reference,
      incident.asset,
      incident.title,
      incident.severity,
      incident.status,
      incident.assignee,
    ]),
    head: [["Reference", KYC_PROCO_COLUMNS.DESCRIPTION, "Panne", "Criticite", KYC_PROCO_COLUMNS.STATUS, KYC_WORKSTATION_COLUMNS.USER]],
    margin: { left: 14, right: 14 },
    startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
      : 140,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [18, 28, 72], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [246, 248, 255] },
  });

  drawPdfPageNumbers(doc);
  doc.save(`rapport-it-inventory-${fileStamp()}.pdf`);
}

function exportExcel(data: ReportsData) {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(data.summary),
    "Synthese",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(data.assets),
    "Inventaire",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(data.incidents),
    "Pannes",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(data.movements),
    "Mouvements",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(data.assignments),
    "Affectations",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(data.breakdowns.byStatus),
    "Statuts",
  );

  XLSX.writeFile(workbook, `rapport-it-inventory-${fileStamp()}.xlsx`);
}

export function ReportsContent() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const response = await fetch("/api/reports", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Reports API failed");
        }

        setData(await response.json());
      } catch {
        setError("Impossible de charger les rapports depuis la base.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadReports();
  }, []);

  return (
    <section className={ui.page}>
      <header className={`${ui.header} xl:flex xl:items-center xl:justify-between`}>
        <div>
          <p className={ui.eyebrow}>Rapports</p>
          <h1 className={ui.title}>Rapports IT Inventory</h1>
          <p className={`${ui.subtitle} mt-1 max-w-3xl`}>
            Synthese executable pour inventaire, pannes, mouvements, risques et
            repartitions. Export disponible en PDF soigne et en Excel.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 xl:mt-0">
          <Button
            className={ui.btnPrimary}
            disabled={!data}
            onClick={() => data && void exportPdf(data)}
            type="button"
          >
            <FileText className="size-4" />
            Exporter PDF
          </Button>
          <Button
            className={ui.btnSecondary}
            disabled={!data}
            onClick={() => data && exportExcel(data)}
            type="button"
          >
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
        </div>
      </header>

      {error ? (
        <Card className={`${ui.panel} border-red-900/40 ring-0`}>
          <CardContent className={`${ui.panelBody} text-sm text-red-200`}>{error}</CardContent>
        </Card>
      ) : null}

      {!error && isLoading ? (
        <Card className={`${ui.panel} ring-0`}>
          <CardContent className={`${ui.panelBody} text-sm text-slate-400`}>Chargement des rapports...</CardContent>
        </Card>
      ) : null}

      {!error && data ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {data.summary.map((item) => (
              <Card className={`${ui.panel} ring-0`} key={item.label}>
                <CardHeader className={ui.panelHeader}>
                  <CardDescription className={ui.subtitle}>
                    {item.label}
                  </CardDescription>
                  <CardTitle className="text-2xl font-semibold text-white">
                    {item.value}
                  </CardTitle>
                </CardHeader>
                <CardContent className={`${ui.panelBody} pt-0 text-sm text-slate-400`}>
                  {item.hint}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid min-h-0 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className={`${ui.panel} ${ui.tablePanel}`}>
              <CardHeader className={ui.panelHeader}>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Download className="size-4 text-slate-400" />
                  Apercu {KYC_UI.EXPORT_PREVIEW}
                </CardTitle>
                <CardDescription className={ui.subtitle}>
                  {data.assets.length} {KYC_IN_STORE_COLUMNS.ITEM}(s), donnees identiques aux exports.
                </CardDescription>
              </CardHeader>
              <CardContent className={ui.tablePanelBody}>
                <div className={ui.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      {[
                        KYC_PROCO_COLUMNS.NO,
                        KYC_PROCO_COLUMNS.DESCRIPTION,
                        KYC_PROCO_COLUMNS.LOCATION,
                        KYC_PROCO_COLUMNS.STATUS,
                        KYC_PROCO_COLUMNS.RELATIVE_VALUE,
                      ].map(
                        (head) => (
                          <TableHead className="text-xs text-slate-500" key={head}>
                            {head}
                          </TableHead>
                        ),
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.assets.slice(0, 8).map((asset) => (
                      <TableRow className="border-white/6" key={asset.sku}>
                        <TableCell className="font-mono text-xs text-slate-400">
                          {asset.sku}
                        </TableCell>
                        <TableCell className="font-medium">{asset.name}</TableCell>
                        <TableCell className="text-slate-300">
                          {asset.location}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-slate-800 text-slate-300">
                            {asset.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{asset.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3">
              <Card className={`${ui.panel} ring-0`}>
                <CardHeader className={ui.panelHeader}>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <PieChart className="size-4 text-slate-400" />
                    Repartition par {KYC_UI.STATUS}
                  </CardTitle>
                </CardHeader>
                <CardContent className={`${ui.panelBody} space-y-2`}>
                  {data.breakdowns.byStatus.map((item) => (
                    <div
                      className="flex items-center justify-between rounded-md border border-white/10 bg-slate-900/50 px-3 py-2"
                      key={item.label}
                    >
                      <span>{item.label}</span>
                      <Badge className="bg-red-900/40 text-red-200">
                        {item.value}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className={`${ui.panel} ring-0`}>
                <CardHeader className={ui.panelHeader}>
                  <CardTitle className="text-base font-semibold">{KYC_UI.PRIORITY_RISKS}</CardTitle>
                  <CardDescription className={ui.subtitle}>
                    {KYC_IN_STORE_COLUMNS.ITEM} critiques, perdus ou en {KYC_UI.STATUS} Maintenance.
                  </CardDescription>
                </CardHeader>
                <CardContent className={`${ui.panelBody} space-y-2`}>
                  {data.risks.length ? (
                    data.risks.map((risk) => (
                      <div className="rounded-md border border-white/10 bg-slate-900/50 p-3" key={`${risk.asset}-${risk.status}`}>
                        <p className="font-medium">{risk.asset}</p>
                        <p className="text-sm text-slate-400">{risk.location}</p>
                        <Badge className="mt-2 bg-red-900/40 text-red-200">
                          {risk.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      Aucun risque critique identifie.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

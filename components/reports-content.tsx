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
    head: [["SKU", "Materiel", "Categorie", "Localisation", "Affectation", "Statut", "Valeur"]],
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
    head: [["Reference", "Materiel", "Panne", "Criticite", "Statut", "Technicien"]],
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
    <section className="flex h-full min-h-0 flex-col gap-5 text-white">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#6fb6ff]">
            Rapports
          </p>
          <h1 className="mt-2 text-3xl font-black">Rapports IT Inventory</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Synthese executable pour inventaire, pannes, mouvements, risques et
            repartitions. Export disponible en PDF soigne et en Excel.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            className="h-11 bg-[#ff2f45] text-white hover:bg-[#ff2f45]/90"
            disabled={!data}
            onClick={() => data && void exportPdf(data)}
            type="button"
          >
            <FileText className="size-4" />
            Exporter PDF
          </Button>
          <Button
            className="bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
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
        <Card className="border-[#ff2f45]/30 bg-[#ff2f45]/10 text-white ring-0">
          <CardContent className="p-6">{error}</CardContent>
        </Card>
      ) : null}

      {!error && isLoading ? (
        <Card className="border-white/10 bg-white/7 text-white ring-0">
          <CardContent className="p-6">Chargement des rapports...</CardContent>
        </Card>
      ) : null}

      {!error && data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.summary.map((item) => (
              <Card
                className="border-white/10 bg-[#11183b]/95 text-white ring-0"
                key={item.label}
              >
                <CardHeader>
                  <CardDescription className="text-slate-400">
                    {item.label}
                  </CardDescription>
                  <CardTitle className="text-3xl font-black text-white">
                    {item.value}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-[#8cc6ff]">
                  {item.hint}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid min-h-0 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="min-h-0 border-white/10 bg-[#11183b]/95 text-white ring-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="size-5 text-[#6fb6ff]" />
                  Apercu inventaire exporte
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {data.assets.length} materiel(s), donnees identiques aux exports.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      {["SKU", "Materiel", "Localisation", "Statut", "Valeur"].map(
                        (head) => (
                          <TableHead className="text-slate-400" key={head}>
                            {head}
                          </TableHead>
                        ),
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.assets.slice(0, 8).map((asset) => (
                      <TableRow className="border-white/6 hover:bg-white/5" key={asset.sku}>
                        <TableCell className="font-mono text-xs text-slate-400">
                          {asset.sku}
                        </TableCell>
                        <TableCell className="font-bold">{asset.name}</TableCell>
                        <TableCell className="text-[#8cc6ff]">
                          {asset.location}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-white/10 text-white">
                            {asset.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{asset.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="size-5 text-[#6fb6ff]" />
                    Repartition par statut
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.breakdowns.byStatus.map((item) => (
                    <div
                      className="flex items-center justify-between rounded-xl bg-white/6 px-3 py-2"
                      key={item.label}
                    >
                      <span>{item.label}</span>
                      <Badge className="bg-[#ff2f45]/20 text-[#ff7a88]">
                        {item.value}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
                <CardHeader>
                  <CardTitle>Risques prioritaires</CardTitle>
                  <CardDescription className="text-slate-400">
                    Materiels critiques, perdus ou en maintenance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.risks.length ? (
                    data.risks.map((risk) => (
                      <div className="rounded-xl border border-white/10 bg-white/6 p-3" key={`${risk.asset}-${risk.status}`}>
                        <p className="font-bold">{risk.asset}</p>
                        <p className="text-sm text-slate-400">{risk.location}</p>
                        <Badge className="mt-2 bg-[#ff2f45]/20 text-[#ff7a88]">
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

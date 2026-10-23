"use client";

import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Clock,
  HardDrive,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  getResolutionStepState,
  RESOLUTION_STEPS,
} from "@/lib/incident-resolution";

import { CopyReferenceButton } from "@/components/copy-reference-button";
import { FullReportExport } from "@/components/full-report-export";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ui } from "@/lib/ui-styles";
import { KYC_NAV, KYC_SHEET_LABELS, KYC_UI } from "@/lib/kyc-excel/terminology";
import { apiFetch } from "@/lib/api-client";

type DashboardStat = {
  label: string;
  value: string;
  hint: string;
  icon: keyof typeof statIcons;
};

type InventoryItem = {
  sku: string;
  title: string;
  category: string;
  qty: string;
  location: string;
  value: string;
  updated: string;
  status: string;
};

type IncidentItem = {
  id: string;
  asset: string;
  issue: string;
  owner: string;
  severity: string;
  status: string;
  statusCode: string;
  progress: number;
};

type DashboardData = {
  stats: DashboardStat[];
  inventoryItems: InventoryItem[];
  incidents: IncidentItem[];
};

const statIcons = {
  HardDrive,
  Package,
  Wrench,
  AlertTriangle,
  ShieldCheck,
  Clock,
};

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "En panne" || status === "Perdu"
      ? "bg-red-900/40 text-red-200"
      : status === "Maintenance" || status === "Affecte"
        ? "bg-slate-700 text-slate-200"
        : "bg-slate-800 text-slate-300";

  return <Badge className={tone}>{status}</Badge>;
}

function DashboardLoading() {
  return (
    <section className={ui.page}>
      <Card className={`${ui.panel} ring-0`}>
        <CardContent className={`${ui.panelBody} text-sm text-slate-300`}>
          Chargement des donnees depuis la base...
        </CardContent>
      </Card>
    </section>
  );
}

export function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await apiFetch("/api/dashboard", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Dashboard API failed");
        }

        const payload: DashboardData = await response.json();
        setData(payload);
        setSelectedIncidentId(payload.incidents[0]?.id ?? null);
      } catch {
        setError("Impossible de charger les donnees de la base.");
      }
    }

    loadDashboard();
  }, []);

  const selectedIncident = useMemo(() => {
    if (!data) {
      return null;
    }

    return (
      data.incidents.find((incident) => incident.id === selectedIncidentId) ??
      data.incidents[0] ??
      null
    );
  }, [data, selectedIncidentId]);

  if (error) {
    return (
      <section className={ui.page}>
        <Card className={`${ui.panel} border-red-900/40 ring-0`}>
          <CardContent className={`${ui.panelBody} text-sm text-red-200`}>{error}</CardContent>
        </Card>
      </section>
    );
  }

  if (!data) {
    return <DashboardLoading />;
  }

  const filteredInventoryItems = data.inventoryItems.filter((item) => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      return true;
    }

    return [item.category, item.location, item.sku, item.status, item.title]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return (
    <div className="grid h-full min-h-0 gap-4 overflow-hidden lg:grid-cols-[1fr_24rem]">
      <section className={`${ui.page} overflow-hidden`}>
        <header className={`${ui.header} shrink-0 lg:flex lg:items-end lg:justify-between`}>
          <div>
            <p className={ui.eyebrow}>{KYC_UI.DASHBOARD}</p>
            <h2 className={ui.title}>
              {KYC_NAV.STOCK}, {KYC_UI.INCIDENT} & {KYC_UI.STATUS}
            </h2>
          </div>
          <FullReportExport />
        </header>

        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {data.stats.map((stat) => {
            const Icon = statIcons[stat.icon];

            return (
              <Card className={`${ui.panel} py-4 ring-0`} key={stat.label}>
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-400">{stat.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                    <p className="mt-1 text-xs text-slate-500">{stat.hint}</p>
                  </div>
                  <div className="rounded-md bg-slate-800 p-3 text-slate-300">
                    <Icon className="size-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className={`${ui.panel} ${ui.tablePanel}`}>
          <CardHeader className={`${ui.panelHeader} shrink-0 gap-4 md:grid md:grid-cols-[1fr_18rem] md:items-center`}>
            <div>
              <CardTitle className="text-base font-semibold">
                {KYC_SHEET_LABELS.PROCO_KYC_CALL_IT_EQUIPEMENT}
              </CardTitle>
              <CardDescription className={ui.subtitle}>
                {KYC_NAV.STOCK} — {KYC_UI.LOCATION} & {KYC_UI.STATUS}.
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                className={`${ui.input} pl-9 text-white placeholder:text-slate-500`}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={KYC_UI.SEARCH_PLACEHOLDER}
                value={searchQuery}
              />
            </div>
          </CardHeader>
          <CardContent className={ui.tablePanelBody}>
            <div className={ui.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  {[
                    KYC_UI.NO,
                    KYC_UI.DESCRIPTION,
                    KYC_UI.CATEGORY,
                    KYC_UI.NUMBER,
                    KYC_UI.LOCATION,
                    KYC_UI.RELATIVE_VALUE,
                    KYC_UI.STATUS,
                  ].map((head) => (
                    <TableHead className="text-xs text-slate-500" key={head}>
                      {head}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventoryItems.map((item) => (
                  <TableRow className="border-white/6" key={item.sku}>
                    <TableCell className="font-mono text-xs text-slate-400">
                      {item.sku}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-md bg-slate-800" />
                        <div>
                          <p className="font-medium text-white">{item.title}</p>
                          <p className="text-xs text-slate-500">
                            Update {item.updated}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {item.category}
                    </TableCell>
                    <TableCell className="text-slate-300">{item.qty}</TableCell>
                    <TableCell className="text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {item.location}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-200">{item.value}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <aside className={`${ui.page} overflow-hidden`}>
        <Card className={`${ui.panel} ring-0`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="size-4 text-red-400" />
              Suivi {KYC_UI.INCIDENT}
            </CardTitle>
            <CardDescription className={ui.subtitle}>
              {KYC_UI.REFERENCE} → {KYC_UI.STATUS}.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
          {data.incidents.map((incident) => {
            const isSelected = selectedIncident?.id === incident.id;

            return (
            <Card
              className={`cursor-pointer border py-4 ring-0 transition-colors ${
                isSelected
                  ? "border-white/20 bg-slate-800/80"
                  : `${ui.panel} hover:border-white/15`
              }`}
              key={incident.id}
              onClick={() => setSelectedIncidentId(incident.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedIncidentId(incident.id);
                }
              }}
              aria-label={`Panne ${incident.id} - ${incident.asset}`}
              role="button"
              tabIndex={0}
            >
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5">
                      <p className="font-mono text-xs text-slate-400">
                        {incident.id}
                      </p>
                      <CopyReferenceButton value={incident.id} />
                    </span>
                    <h3 className="mt-1 font-semibold">{incident.asset}</h3>
                  </div>
                  <Badge
                    className={
                      incident.severity === "Haute" ||
                      incident.severity === "Critique"
                        ? "bg-red-900/40 text-red-200"
                        : "bg-slate-800 text-slate-300"
                    }
                  >
                    {incident.severity}
                  </Badge>
                </div>

                <p className="text-sm leading-6 text-slate-400">
                  {incident.issue}
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <span>{incident.owner}</span>
                  <span className="text-right">{incident.status}</span>
                </div>

                <Progress
                  className="[&_[data-slot=progress-indicator]]:bg-red-600 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-white/10"
                  value={incident.progress}
                />
              </CardContent>
            </Card>
            );
          })}
        </div>

        <Card
          className={`${ui.panel} shrink-0 ring-0`}
          data-testid="resolution-cycle-panel"
        >
          <CardContent className={ui.panelBody}>
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="size-4 text-slate-400" />
              <h3 className="font-semibold">Cycle de resolution</h3>
            </div>
            {selectedIncident ? (
              <p className="mb-3 text-xs text-slate-400">
                Panne <span className="font-mono text-slate-300">{selectedIncident.id}</span>{" "}
                · {selectedIncident.status}
              </p>
            ) : (
              <p className="mb-3 text-xs text-slate-500">
                Selectionnez une panne pour afficher son etape.
              </p>
            )}
            <div className="space-y-3">
              {RESOLUTION_STEPS.map((step, index) => {
                const stepState = selectedIncident
                  ? getResolutionStepState(index, selectedIncident.statusCode)
                  : "pending";

                return (
                  <div className="flex items-center gap-3" key={step}>
                    <span
                      className={`flex size-7 items-center justify-center rounded-md text-xs font-medium ${
                        stepState === "completed"
                          ? "bg-slate-600 text-white"
                          : stepState === "current"
                            ? "bg-red-600 text-white"
                            : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={`text-sm ${
                        stepState === "pending" ? "text-slate-500" : "text-slate-300"
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
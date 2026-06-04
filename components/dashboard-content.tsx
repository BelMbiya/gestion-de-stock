"use client";

import {
  Activity,
  AlertTriangle,
  ClipboardList,
  HardDrive,
  MapPin,
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
import { ExportPdfButton } from "@/components/export-pdf-button";
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

type DashboardStat = {
  label: string;
  value: string;
  hint: string;
  icon: "HardDrive" | "Wrench" | "AlertTriangle" | "ShieldCheck";
};

type InventoryItem = {
  sku: string;
  title: string;
  category: string;
  qty: number;
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
  Wrench,
  AlertTriangle,
  ShieldCheck,
};

function StatusBadge({ status }: { status: string }) {
  if (status === "Critique") {
    return (
      <Badge className="bg-[#ff2f45]/20 text-[#ff7a88] hover:bg-[#ff2f45]/20">
        {status}
      </Badge>
    );
  }

  if (status === "Maintenance") {
    return (
      <Badge className="bg-[#6fb6ff]/20 text-[#9fd0ff] hover:bg-[#6fb6ff]/20">
        {status}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="bg-white/10 text-white">
      {status}
    </Badge>
  );
}

function DashboardLoading() {
  return (
    <section className="flex h-full w-full items-center justify-center">
      <Card className="border-white/10 bg-white/7 text-white ring-0">
        <CardContent className="p-6 text-sm font-semibold">
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
        const response = await fetch("/api/dashboard", {
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
      <section className="flex h-full w-full items-center justify-center">
        <Card className="border-[#ff2f45]/30 bg-[#ff2f45]/10 text-white ring-0">
          <CardContent className="p-6">{error}</CardContent>
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
      <section className="flex min-h-0 flex-col gap-4 overflow-hidden">
        <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#6fb6ff]">
              Dashboard
            </p>
            <h2 className="mt-1 text-3xl font-black tracking-tight">
              Stock, suivi materiel et pannes
            </h2>
          </div>
          <ExportPdfButton
            filename="dashboard-it"
            sections={[
              {
                title: "Indicateurs",
                columns: ["Indicateur", "Valeur", "Detail"],
                rows: data.stats.map((stat) => [stat.label, stat.value, stat.hint]),
              },
              {
                title: "Inventaire",
                columns: [
                  "SKU",
                  "Materiel",
                  "Categorie",
                  "QTY",
                  "Localisation",
                  "Valeur",
                  "Statut",
                ],
                rows: filteredInventoryItems.map((item) => [
                  item.sku,
                  item.title,
                  item.category,
                  String(item.qty),
                  item.location,
                  item.value,
                  item.status,
                ]),
              },
              {
                title: "Pannes",
                columns: [
                  "Reference",
                  "Materiel",
                  "Panne",
                  "Technicien",
                  "Criticite",
                  "Statut",
                  "Progression",
                ],
                rows: data.incidents.map((incident) => [
                  incident.id,
                  incident.asset,
                  incident.issue,
                  incident.owner,
                  incident.severity,
                  incident.status,
                  `${incident.progress}%`,
                ]),
              },
            ]}
            subtitle={`PROCO & Cie - Genere le ${new Date().toLocaleString("fr-FR")}`}
            title="Tableau de bord IT Inventory"
          />
        </div>

        <div className="grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.stats.map((stat) => {
            const Icon = statIcons[stat.icon];

            return (
              <Card
                className="border-white/10 bg-white/7 py-4 text-white ring-0"
                key={stat.label}
              >
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-300">{stat.label}</p>
                    <p className="mt-2 text-3xl font-black">{stat.value}</p>
                    <p className="mt-1 text-xs text-[#6fb6ff]">{stat.hint}</p>
                  </div>
                  <div className="rounded-2xl bg-[#6fb6ff]/15 p-3 text-[#9fd0ff]">
                    <Icon className="size-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="min-h-0 flex-1 border-white/10 bg-[#11183b]/92 text-white ring-0">
          <CardHeader className="shrink-0 gap-4 md:grid-cols-[1fr_18rem] md:items-center">
            <div>
              <CardTitle className="text-xl font-black">
                Inventaire materiel
              </CardTitle>
              <CardDescription className="text-slate-400">
                Stock IT, localisation et statut operationnel.
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-10 border-white/10 bg-white/6 pl-9 text-white placeholder:text-slate-400"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search assets..."
                value={searchQuery}
              />
            </div>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-[#11183b]">
                <TableRow className="border-white/10 hover:bg-transparent">
                  {[
                    "SKU",
                    "Materiel",
                    "Categorie",
                    "QTY",
                    "Localisation",
                    "Valeur",
                    "Statut",
                  ].map((head) => (
                    <TableHead
                      className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-slate-400"
                      key={head}
                    >
                      {head}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventoryItems.map((item) => (
                  <TableRow
                    className="border-white/6 hover:bg-white/5"
                    key={item.sku}
                  >
                    <TableCell className="font-mono text-xs text-slate-400">
                      {item.sku}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-[#6fb6ff] to-[#ff2f45]" />
                        <div>
                          <p className="font-bold text-white">{item.title}</p>
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
                    <TableCell className="text-[#8cc6ff]">
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
          </CardContent>
        </Card>
      </section>

      <aside className="flex min-h-0 flex-col gap-4 overflow-hidden">
        <Card className="border-white/10 bg-[#11183b]/92 text-white ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <Activity className="size-5 text-[#ff2f45]" />
              Suivi des pannes
            </CardTitle>
            <CardDescription className="text-slate-400">
              De l&apos;identification a la resolution.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
          {data.incidents.map((incident) => {
            const isSelected = selectedIncident?.id === incident.id;

            return (
            <Card
              className={`cursor-pointer border py-4 text-white ring-0 transition-all ${
                isSelected
                  ? "border-[#6fb6ff]/60 bg-[#6fb6ff]/10 shadow-lg shadow-[#6fb6ff]/10"
                  : "border-white/10 bg-white/7 hover:border-white/20 hover:bg-white/10"
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
                      <p className="font-mono text-xs text-[#6fb6ff]">
                        {incident.id}
                      </p>
                      <CopyReferenceButton value={incident.id} />
                    </span>
                    <h3 className="mt-1 font-black">{incident.asset}</h3>
                  </div>
                  <Badge
                    className={
                      incident.severity === "Haute" ||
                      incident.severity === "Critique"
                        ? "bg-[#ff2f45]/20 text-[#ff7b88]"
                        : "bg-white/10 text-slate-200"
                    }
                  >
                    {incident.severity}
                  </Badge>
                </div>

                <p className="text-sm leading-6 text-slate-300">
                  {incident.issue}
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                  <span>{incident.owner}</span>
                  <span className="text-right">{incident.status}</span>
                </div>

                <Progress
                  className={
                    incident.progress >= 100
                      ? "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-emerald-400 [&_[data-slot=progress-indicator]]:to-green-500 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-white/10"
                      : "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-[#6fb6ff] [&_[data-slot=progress-indicator]]:to-[#ff2f45] [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-white/10"
                  }
                  value={incident.progress}
                />
              </CardContent>
            </Card>
            );
          })}
        </div>

        <Card
          className="shrink-0 border-white/10 bg-[#ff2f45]/12 py-4 text-white ring-0"
          data-testid="resolution-cycle-panel"
        >
          <CardContent>
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="size-5 text-[#ff7b88]" />
              <h3 className="font-black">Cycle de resolution</h3>
            </div>
            {selectedIncident ? (
              <p className="mb-3 text-xs text-slate-300">
                Panne <span className="font-mono text-[#6fb6ff]">{selectedIncident.id}</span>{" "}
                · {selectedIncident.status}
              </p>
            ) : (
              <p className="mb-3 text-xs text-slate-400">
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
                      className={`flex size-7 items-center justify-center rounded-full text-xs font-black ${
                        stepState === "completed"
                          ? "bg-[#6fb6ff] text-[#141044]"
                          : stepState === "current"
                            ? "bg-[#ff2f45] text-white"
                            : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={`text-sm ${
                        stepState === "pending" ? "text-slate-400" : "text-slate-200"
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
"use client";

import { Activity, Clock, MapPin, Search, Trash2, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { CopyReferenceButton } from "@/components/copy-reference-button";
import { ExportPdfButton } from "@/components/export-pdf-button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  getSeverityLabel,
  getStatusLabel,
  incidentSeverityOptions,
  incidentStatusOptions,
} from "@/lib/incident-serializer";

type IncidentUpdate = {
  id: string;
  author: string;
  comment: string;
  statusTo: string | null;
  createdAt: string;
};

type Incident = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  asset: string;
  location: string;
  reporter: string;
  assignee: string;
  severity: string;
  status: string;
  progress: number;
  identifiedAt: string;
  updates: IncidentUpdate[];
};

type ReferenceItem = {
  id: string;
  email?: string;
  name: string;
  sku?: string;
};

const periodOptions = [
  { label: "Toute periode", value: "" },
  { label: "Aujourd'hui", value: "day" },
  { label: "7 derniers jours", value: "week" },
  { label: "30 derniers jours", value: "month" },
  { label: "12 derniers mois", value: "year" },
] as const;

function buildIncidentsQuery(params: {
  assetId: string;
  assigneeId: string;
  endDate: string;
  period: string;
  severity: string;
  specificDate: string;
  startDate: string;
  status: string;
}) {
  const search = new URLSearchParams();

  if (params.assetId) {
    search.set("assetId", params.assetId);
  }
  if (params.assigneeId) {
    search.set("assigneeId", params.assigneeId);
  }
  if (params.severity) {
    search.set("severity", params.severity);
  }
  if (params.status) {
    search.set("status", params.status);
  }
  if (params.specificDate) {
    search.set("date", params.specificDate);
  } else {
    if (params.period) {
      search.set("period", params.period);
    }
    if (params.startDate) {
      search.set("startDate", params.startDate);
    }
    if (params.endDate) {
      search.set("endDate", params.endDate);
    }
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

type IncidentForm = {
  assetId: string;
  assigneeId: string;
  comment: string;
  description: string;
  reference: string;
  severity: string;
  status: string;
  title: string;
};

const emptyForm: IncidentForm = {
  assetId: "",
  assigneeId: "",
  comment: "",
  description: "",
  reference: "",
  severity: "MEDIUM",
  status: "IDENTIFIED",
  title: "",
};

function SeverityBadge({ severity }: { severity: string }) {
  const isHigh = severity === "Haute" || severity === "Critique";

  return (
    <Badge
      className={
        isHigh
          ? "bg-[#ff2f45]/20 text-[#ff7b88]"
          : "bg-white/10 text-slate-200"
      }
    >
      {severity}
    </Badge>
  );
}

export function IncidentsContent() {
  const [assets, setAssets] = useState<ReferenceItem[]>([]);
  const [editingIncidentId, setEditingIncidentId] = useState<string | null>(null);
  const [form, setForm] = useState<IncidentForm>(emptyForm);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [specificDate, setSpecificDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [users, setUsers] = useState<ReferenceItem[]>([]);

  const incidentsQuery = useMemo(
    () =>
      buildIncidentsQuery({
        assetId: selectedAssetId,
        assigneeId: selectedAssigneeId,
        endDate,
        period,
        severity: selectedSeverity,
        specificDate,
        startDate,
        status: selectedStatus,
      }),
    [
      endDate,
      period,
      selectedAssetId,
      selectedAssigneeId,
      selectedSeverity,
      selectedStatus,
      specificDate,
      startDate,
    ],
  );

  const filteredIncidents = incidents.filter((incident) => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      return true;
    }

    return [
      incident.asset,
      incident.assignee,
      incident.location,
      incident.reference,
      incident.severity,
      incident.status,
      incident.title,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  async function loadIncidents() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/incidents${incidentsQuery}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Incidents API failed");
      }

      const data = await response.json();
      setAssets(data.assets);
      setIncidents(data.incidents);
      setUsers(data.users);
    } catch {
      setError("Impossible de charger les pannes depuis la base.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentsQuery]);

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const selectedAssignee = users.find((user) => user.id === selectedAssigneeId);

  const exportSubtitle = useMemo(() => {
    const parts = [
      `Genere le ${new Date().toLocaleString("fr-FR")}`,
      `${filteredIncidents.length} panne(s)`,
      selectedAsset ? `Materiel: ${selectedAsset.name}` : "Materiel: tous",
      selectedAssignee
        ? `Technicien: ${selectedAssignee.name}`
        : "Technicien: tous",
      selectedSeverity
        ? `Criticite: ${getSeverityLabel(selectedSeverity)}`
        : "Criticite: toutes",
      selectedStatus
        ? `Statut: ${getStatusLabel(selectedStatus)}`
        : "Statut: tous",
    ];

    if (specificDate) {
      parts.push(`Date: ${specificDate}`);
    } else if (period) {
      const label = periodOptions.find((option) => option.value === period)?.label;
      parts.push(`Periode: ${label ?? period}`);
    } else if (startDate || endDate) {
      parts.push(`Intervalle: ${startDate || "..."} -> ${endDate || "..."}`);
    } else {
      parts.push("Periode: complete");
    }

    return parts.join(" · ");
  }, [
    endDate,
    filteredIncidents.length,
    period,
    selectedAsset,
    selectedAssignee,
    selectedSeverity,
    selectedStatus,
    specificDate,
    startDate,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = editingIncidentId
      ? `/api/incidents/${editingIncidentId}`
      : "/api/incidents";
    const method = editingIncidentId ? "PATCH" : "POST";

    await fetch(url, {
      method,
      body: JSON.stringify({
        ...form,
        history: form.comment,
      }),
    });

    setEditingIncidentId(null);
    setForm(emptyForm);
    setIsFormOpen(false);
    await loadIncidents();
    window.dispatchEvent(new Event("stock-it:notifications-changed"));
  }

  function handleEdit(incident: Incident) {
    const asset = assets.find((item) => item.name === incident.asset);
    const assignee = users.find((item) => item.name === incident.assignee);

    setEditingIncidentId(incident.id);
    setIsFormOpen(true);
    setForm({
      assetId: asset?.id ?? "",
      assigneeId: assignee?.id ?? "",
      comment: "",
      description: incident.description ?? "",
      reference: incident.reference,
      severity:
        incident.severity === "Haute"
          ? "HIGH"
          : incident.severity === "Critique"
            ? "CRITICAL"
            : incident.severity === "Basse"
              ? "LOW"
              : "MEDIUM",
      status:
        incident.status === "Diagnostic"
          ? "DIAGNOSING"
          : incident.status === "Intervention"
            ? "IN_PROGRESS"
            : incident.status === "Piece commandee"
              ? "WAITING_PART"
              : incident.status === "Resolution validee"
                ? "RESOLVED"
                : incident.status === "Cloture"
                  ? "CLOSED"
                  : "IDENTIFIED",
      title: incident.title,
    });
  }

  async function handleDelete(id: string) {
    await fetch(`/api/incidents/${id}`, {
      method: "DELETE",
    });
    await loadIncidents();
    window.dispatchEvent(new Event("stock-it:notifications-changed"));
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 text-white">
        <header className="flex shrink-0 flex-col gap-3 rounded-[2rem] border border-white/10 bg-white/6 p-4 shadow-2xl shadow-black/30 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#6fb6ff]">
              Pannes
            </p>
            <h1 className="mt-1 text-2xl font-black">
              Suivi de resolution materiel
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Suivez chaque panne depuis son identification jusqu&apos;a sa
              resolution, avec technicien, criticite, progression et historique.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ExportPdfButton
              disabled={isLoading}
              filename="suivi-pannes"
              sections={[
                {
                  columns: [
                    "Reference",
                    "Titre",
                    "Materiel",
                    "Technicien",
                    "Criticite",
                    "Statut",
                    "Progression",
                  ],
                  rows: filteredIncidents.map((incident) => [
                    incident.reference,
                    incident.title,
                    incident.asset,
                    incident.assignee,
                    incident.severity,
                    incident.status,
                    `${incident.progress}%`,
                  ]),
                },
              ]}
              subtitle={`PROCO & Cie - ${exportSubtitle}`}
              title="Suivi des pannes IT"
            />
            <Button
              className="w-fit bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
              onClick={() => {
                setEditingIncidentId(null);
                setForm(emptyForm);
                setIsFormOpen(true);
              }}
              type="button"
            >
              Declarer une panne
            </Button>
          </div>
        </header>

        <Card className="shrink-0 border-white/10 bg-[#11183b]/95 text-white ring-0">
          <CardHeader className="gap-1 px-4 py-3">
            <CardTitle className="text-sm font-bold">Filtres d&apos;exportation</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Liste et export PDF
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 px-4 pb-4 pt-0 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Materiel
              <select
                aria-label="Materiel"
                className="h-9 rounded-lg border border-white/10 bg-[#0d1433] px-2.5 text-sm text-white"
                onChange={(event) => setSelectedAssetId(event.target.value)}
                value={selectedAssetId}
              >
                <option value="">Tous les materiels</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.sku ? `${asset.sku} - ` : ""}
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Technicien
              <select
                aria-label="Technicien filtre"
                className="h-9 rounded-lg border border-white/10 bg-[#0d1433] px-2.5 text-sm text-white"
                onChange={(event) => setSelectedAssigneeId(event.target.value)}
                value={selectedAssigneeId}
              >
                <option value="">Tous les techniciens</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Criticite
              <select
                aria-label="Criticite"
                className="h-9 rounded-lg border border-white/10 bg-[#0d1433] px-2.5 text-sm text-white"
                onChange={(event) => setSelectedSeverity(event.target.value)}
                value={selectedSeverity}
              >
                {incidentSeverityOptions.map((option) => (
                  <option key={option.value || "all-severity"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Statut
              <select
                aria-label="Statut filtre"
                className="h-9 rounded-lg border border-white/10 bg-[#0d1433] px-2.5 text-sm text-white"
                onChange={(event) => setSelectedStatus(event.target.value)}
                value={selectedStatus}
              >
                {incidentStatusOptions.map((option) => (
                  <option key={option.value || "all-status"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Periode
              <select
                aria-label="Periode"
                className="h-9 rounded-lg border border-white/10 bg-[#0d1433] px-2.5 text-sm text-white"
                onChange={(event) => {
                  setPeriod(event.target.value);
                  if (event.target.value) {
                    setSpecificDate("");
                  }
                }}
                value={period}
              >
                {periodOptions.map((option) => (
                  <option key={option.value || "all-period"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Date precise
              <Input
                aria-label="Date precise"
                className="h-9 border-white/10 bg-[#0d1433] text-sm text-white"
                onChange={(event) => {
                  setSpecificDate(event.target.value);
                  if (event.target.value) {
                    setPeriod("");
                    setStartDate("");
                    setEndDate("");
                  }
                }}
                type="date"
                value={specificDate}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Debut intervalle
              <Input
                aria-label="Debut intervalle"
                className="h-9 border-white/10 bg-[#0d1433] text-sm text-white"
                disabled={Boolean(specificDate)}
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                value={startDate}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Fin intervalle
              <Input
                aria-label="Fin intervalle"
                className="h-9 border-white/10 bg-[#0d1433] text-sm text-white"
                disabled={Boolean(specificDate)}
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                value={endDate}
              />
            </label>
          </CardContent>
        </Card>

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-9 border-white/10 bg-white/6 pl-10 text-sm text-white"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Rechercher par reference, materiel, technicien, statut..."
            value={searchQuery}
          />
        </div>

        <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
          <DialogContent className="w-[min(calc(100vw-2rem),58rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
            <DialogHeader>
              <DialogTitle>
                {editingIncidentId ? "Modifier la panne" : "Declarer une panne"}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Creation, affectation et suivi du statut de resolution.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4 md:grid-cols-2 [&_input]:h-11 [&_select]:h-11"
              onSubmit={handleSubmit}
            >
              <Input
                className="border-white/10 bg-white/6 text-white md:col-span-2"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    reference: event.target.value,
                  }))
                }
                placeholder="Reference"
                required
                value={form.reference}
              />
              <Input
                className="border-white/10 bg-white/6 text-white"
                onChange={(event) =>
                  setForm((value) => ({ ...value, title: event.target.value }))
                }
                placeholder="Titre de la panne"
                required
                value={form.title}
              />
              <select
                className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm text-white"
                onChange={(event) =>
                  setForm((value) => ({ ...value, assetId: event.target.value }))
                }
                required
                value={form.assetId}
              >
                <option value="">Materiel</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm text-white"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    assigneeId: event.target.value,
                  }))
                }
                value={form.assigneeId}
              >
                <option value="">Technicien</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name ?? user.email}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm text-white"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    severity: event.target.value,
                  }))
                }
                value={form.severity}
              >
                <option value="LOW">Basse</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="HIGH">Haute</option>
                <option value="CRITICAL">Critique</option>
              </select>
              <select
                className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm text-white"
                onChange={(event) =>
                  setForm((value) => ({ ...value, status: event.target.value }))
                }
                value={form.status}
              >
                <option value="IDENTIFIED">Identification</option>
                <option value="DIAGNOSING">Diagnostic</option>
                <option value="IN_PROGRESS">Intervention</option>
                <option value="WAITING_PART">Piece commandee</option>
                <option value="RESOLVED">Resolution validee</option>
                <option value="CLOSED">Cloture</option>
              </select>
              <Input
                aria-label="Historique de panne"
                className="border-white/10 bg-white/6 text-white"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    comment: event.target.value,
                  }))
                }
                placeholder="Historique de panne"
                value={form.comment}
              />
              <div className="flex gap-2 md:col-span-2">
                <Button
                  className="flex-1 bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
                  type="submit"
                >
                  {editingIncidentId ? "Enregistrer" : "Declarer"}
                </Button>
                {editingIncidentId ? (
                  <Button
                    className="border border-[#ff2f45]/40 bg-[#ff2f45]/20 text-[#ff9aa5] hover:bg-[#ff2f45]/30"
                    onClick={async () => {
                      await handleDelete(editingIncidentId);
                      setEditingIncidentId(null);
                      setForm(emptyForm);
                      setIsFormOpen(false);
                    }}
                    type="button"
                  >
                    <Trash2 className="size-4" />
                    Supprimer la panne
                  </Button>
                ) : null}
                {editingIncidentId ? (
                  <Button
                    className="bg-white/10 text-white hover:bg-white/15"
                    onClick={() => {
                      setEditingIncidentId(null);
                      setForm(emptyForm);
                      setIsFormOpen(false);
                    }}
                    type="button"
                  >
                    Annuler
                  </Button>
                ) : null}
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="flex min-h-0 flex-1 flex-col">
          {error ? (
            <Card className="mb-3 shrink-0 border-[#ff2f45]/30 bg-[#ff2f45]/10 text-white ring-0">
              <CardContent className="p-4 text-sm">{error}</CardContent>
            </Card>
          ) : null}

          <Card className="flex min-h-0 flex-1 flex-col border-white/10 bg-[#11183b]/95 text-white ring-0">
            <CardContent className="min-h-0 flex-1 overflow-x-auto overflow-y-auto p-3 [scrollbar-gutter:stable]">
              {isLoading ? (
                <p className="rounded-xl bg-white/6 p-4 text-sm text-slate-300">
                  Chargement des pannes...
                </p>
              ) : filteredIncidents.length === 0 ? (
                <p className="rounded-xl bg-white/6 p-4 text-sm text-slate-300">
                  Aucune panne pour les filtres selectionnes.
                </p>
              ) : (
              <Table className="table-fixed">
                <TableHeader className="sticky top-0 z-10 bg-[#11183b]">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="w-[24%] text-slate-400">Panne</TableHead>
                    <TableHead className="w-[18%] text-slate-400">Materiel</TableHead>
                    <TableHead className="w-[16%] text-slate-400">Technicien</TableHead>
                    <TableHead className="w-[10%] text-slate-400">Criticite</TableHead>
                    <TableHead className="w-[16%] text-slate-400">Progression</TableHead>
                    <TableHead className="w-[8%] text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => (
                    <TableRow className="border-white/6 hover:bg-white/5" key={incident.id}>
                      <TableCell className="whitespace-normal break-words align-top">
                        <span className="inline-flex items-center gap-1.5">
                          <p className="font-mono text-xs text-[#6fb6ff]">
                            {incident.reference}
                          </p>
                          <CopyReferenceButton value={incident.reference} />
                        </span>
                        <p className="mt-1 font-black text-white">{incident.title}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-300">
                          {incident.description ?? "Aucune description."}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-normal break-words align-top text-slate-300">
                        <span className="flex items-start gap-2">
                          <Activity className="size-4 text-[#ff2f45]" />
                          <span>{incident.asset}</span>
                        </span>
                        <span className="mt-2 flex items-start gap-2 text-[#8cc6ff]">
                          <MapPin className="size-4 text-[#6fb6ff]" />
                          <span>{incident.location}</span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal break-words align-top text-slate-300">
                        <span className="flex items-start gap-2">
                          <UserRound className="size-4 text-[#6fb6ff]" />
                          <span>{incident.assignee}</span>
                        </span>
                        <span className="mt-2 flex items-start gap-2 text-xs">
                          <Clock className="size-4 text-[#6fb6ff]" />
                          <span>{incident.identifiedAt}</span>
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <SeverityBadge severity={incident.severity} />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="mb-2 flex items-start justify-between gap-2 text-[0.65rem] text-slate-400">
                          <span className="break-words leading-4">{incident.status}</span>
                          <span>{incident.progress}%</span>
                        </div>
                        <Progress
                          className={
                            incident.progress >= 100
                              ? "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-emerald-400 [&_[data-slot=progress-indicator]]:to-green-500 [&_[data-slot=progress-indicator]]:transition-all [&_[data-slot=progress-indicator]]:duration-700 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-white/10"
                              : "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-[#6fb6ff] [&_[data-slot=progress-indicator]]:to-[#ff2f45] [&_[data-slot=progress-indicator]]:transition-all [&_[data-slot=progress-indicator]]:duration-700 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-white/10"
                          }
                          value={incident.progress}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-2">
                          <Button
                            className="h-8 px-2 text-xs bg-white/10 text-white hover:bg-white/15"
                            onClick={() => handleEdit(incident)}
                            type="button"
                          >
                            Modifier
                          </Button>
                          <Button
                            className="h-8 px-2 text-xs border border-[#ff2f45]/40 bg-[#ff2f45]/20 text-[#ff9aa5] hover:bg-[#ff2f45]/30"
                            onClick={() => handleDelete(incident.id)}
                            type="button"
                            title="Supprimer la panne"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
  );
}

"use client";

import { Activity, Clock, MapPin, Search, Trash2, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { CopyReferenceButton } from "@/components/copy-reference-button";
import { AssetSearchSelect } from "@/components/asset-search-select";
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
import { KYC_UI } from "@/lib/kyc-excel/terminology";
import { ui } from "@/lib/ui-styles";
import { apiFetch } from "@/lib/api-client";

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
  serialNumber?: string | null;
  model?: string | null;
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
        isHigh ? "bg-red-900/40 text-red-200" : "bg-slate-800 text-slate-300"
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
      const response = await apiFetch(`/api/incidents${incidentsQuery}`, {
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
      selectedAsset ? `${KYC_UI.DESCRIPTION}: ${selectedAsset.name}` : `${KYC_UI.DESCRIPTION}: ${KYC_UI.ALL}`,
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

    await apiFetch(url, {
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
    await apiFetch(`/api/incidents/${id}`, {
      method: "DELETE",
    });
    await loadIncidents();
    window.dispatchEvent(new Event("stock-it:notifications-changed"));
  }

  return (
    <section className={ui.page}>
        <header className={`${ui.header} shrink-0 xl:flex xl:items-center xl:justify-between`}>
          <div>
            <p className={ui.eyebrow}>{KYC_UI.INCIDENT}</p>
            <h1 className={ui.title}>{KYC_UI.INCIDENT} — {KYC_UI.STATUS}</h1>
            <p className={`${ui.subtitle} mt-1 max-w-2xl`}>
              {KYC_UI.REFERENCE}, {KYC_UI.DESCRIPTION}, {KYC_UI.TECHNICIAN}, {KYC_UI.SEVERITY}{" "}
              & {KYC_UI.PROGRESS}.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 xl:mt-0">
            <ExportPdfButton
              disabled={isLoading}
              filename="suivi-pannes"
              sections={[
                {
                  columns: [
                    KYC_UI.REFERENCE,
                    "Titre",
                    KYC_UI.DESCRIPTION,
                    KYC_UI.TECHNICIAN,
                    KYC_UI.SEVERITY,
                    KYC_UI.STATUS,
                    KYC_UI.PROGRESS,
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
              className={ui.btnPrimary}
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

        <Card className={`${ui.panel} shrink-0 ring-0`}>
          <CardHeader className={`${ui.panelHeader} gap-1`}>
            <CardTitle className="text-sm font-semibold">Filtres d&apos;exportation</CardTitle>
            <CardDescription className={ui.subtitle}>
              Liste et export PDF
            </CardDescription>
          </CardHeader>
          <CardContent className={`${ui.panelBody} grid gap-2 pt-0 md:grid-cols-2 xl:grid-cols-4`}>
            <AssetSearchSelect
              assets={assets}
              emptyLabel={`${KYC_UI.ALL} — ${KYC_UI.DESCRIPTION}`}
              label={KYC_UI.DESCRIPTION}
              onValueChange={setSelectedAssetId}
              value={selectedAssetId}
            />
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Technicien
              <select
                aria-label="Technicien filtre"
                className={`${ui.input} px-2.5 text-sm text-white`}
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
                className={`${ui.input} px-2.5 text-sm text-white`}
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
                className={`${ui.input} px-2.5 text-sm text-white`}
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
                className={`${ui.input} px-2.5 text-sm text-white`}
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
                className={`${ui.input} text-sm text-white`}
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
                className={`${ui.input} text-sm text-white`}
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
                className={`${ui.input} text-sm text-white`}
                disabled={Boolean(specificDate)}
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                value={endDate}
              />
            </label>
          </CardContent>
        </Card>

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            className={`${ui.input} pl-9 text-sm text-white`}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={`${KYC_UI.REFERENCE}, ${KYC_UI.DESCRIPTION}, ${KYC_UI.TECHNICIAN}, ${KYC_UI.STATUS}…`}
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
              <AssetSearchSelect
                assets={assets}
                label={KYC_UI.DESCRIPTION}
                onValueChange={(assetId) =>
                  setForm((value) => ({ ...value, assetId }))
                }
                required
                value={form.assetId}
              />
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
                  className={`flex-1 ${ui.btnPrimary}`}
                  type="submit"
                >
                  {editingIncidentId ? "Enregistrer" : "Declarer"}
                </Button>
                {editingIncidentId ? (
                  <Button
                    className="bg-red-900/30 text-red-200 hover:bg-red-900/50"
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
                    className={ui.btnSecondary}
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
            <Card className={`${ui.panel} mb-3 shrink-0 border-red-900/40 ring-0`}>
              <CardContent className={`${ui.panelBody} text-sm text-red-200`}>{error}</CardContent>
            </Card>
          ) : null}

          <Card className={`${ui.panel} ${ui.tablePanel} ring-0`}>
            <CardContent className={ui.tablePanelBody}>
              {isLoading ? (
                <p className="rounded-md bg-slate-800/50 p-4 text-sm text-slate-400">
                  Chargement des pannes...
                </p>
              ) : filteredIncidents.length === 0 ? (
                <p className="rounded-md bg-slate-800/50 p-4 text-sm text-slate-400">
                  Aucune panne pour les filtres selectionnes.
                </p>
              ) : (
              <div className={ui.tableWrap}>
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="w-[24%] text-xs text-slate-500">Panne</TableHead>
                    <TableHead className="w-[18%] text-xs text-slate-500">{KYC_UI.DESCRIPTION}</TableHead>
                    <TableHead className="w-[16%] text-xs text-slate-500">Technicien</TableHead>
                    <TableHead className="w-[10%] text-xs text-slate-500">Criticite</TableHead>
                    <TableHead className="w-[16%] text-xs text-slate-500">Progression</TableHead>
                    <TableHead className="w-[8%] text-xs text-slate-500">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => (
                    <TableRow className="border-white/6" key={incident.id}>
                      <TableCell className="whitespace-normal break-words align-top">
                        <span className="inline-flex items-center gap-1.5">
                          <p className="font-mono text-xs text-slate-400">
                            {incident.reference}
                          </p>
                          <CopyReferenceButton value={incident.reference} />
                        </span>
                        <p className="mt-1 font-medium text-white">{incident.title}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-400">
                          {incident.description ?? "Aucune description."}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-normal break-words align-top text-slate-300">
                        <span className="flex items-start gap-2">
                          <Activity className="size-4 text-slate-500" />
                          <span>{incident.asset}</span>
                        </span>
                        <span className="mt-2 flex items-start gap-2 text-slate-400">
                          <MapPin className="size-4 text-slate-500" />
                          <span>{incident.location}</span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal break-words align-top text-slate-300">
                        <span className="flex items-start gap-2">
                          <UserRound className="size-4 text-slate-500" />
                          <span>{incident.assignee}</span>
                        </span>
                        <span className="mt-2 flex items-start gap-2 text-xs text-slate-400">
                          <Clock className="size-4 text-slate-500" />
                          <span>{incident.identifiedAt}</span>
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <SeverityBadge severity={incident.severity} />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="mb-2 flex items-start justify-between gap-2 text-[0.65rem] text-slate-500">
                          <span className="break-words leading-4">{incident.status}</span>
                          <span>{incident.progress}%</span>
                        </div>
                        <Progress
                          className="[&_[data-slot=progress-indicator]]:bg-red-600 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-white/10"
                          value={incident.progress}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-2">
                          <Button
                            className={`h-8 px-2 text-xs ${ui.btnSecondary}`}
                            onClick={() => handleEdit(incident)}
                            type="button"
                          >
                            Modifier
                          </Button>
                          <Button
                            className="h-8 bg-red-900/30 px-2 text-xs text-red-200 hover:bg-red-900/50"
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
              </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
  );
}

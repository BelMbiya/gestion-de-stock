"use client";

import { AlertTriangle, ArrowLeftRight, CalendarClock, ClipboardCheck, PackageCheck, Search, Undo2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AssetSearchSelect } from "@/components/asset-search-select";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { HolderSearchSelect, type HolderOption } from "@/components/holder-search-select";
import { HoldersPanel } from "@/components/holders-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";
import { KYC_IN_STORE_COLUMNS, KYC_SHEET_LABELS, KYC_UI } from "@/lib/kyc-excel/terminology";
import { ui } from "@/lib/ui-styles";

type AssetOption = {
  id: string;
  name: string;
  sku: string;
  model: string | null;
  serialNumber: string | null;
  assignable: boolean;
};

type Assignment = {
  id: string;
  assetId: string;
  asset: string;
  sku: string;
  serialNumber: string | null;
  category: string;
  location: string;
  holderId: string;
  holder: string;
  holderType: "PERSON" | "COLLECTIVE";
  holderDetail: string;
  kind: "DOTATION" | "LOAN";
  kindLabel: string;
  notes: string;
  remiseAt: string;
  expectedReturnAt: string;
  expectedReturnAtInput: string;
  returnedAt: string;
  daysUntilReturn: number | null;
  returnAlert: "DUE_SOON" | "OVERDUE" | null;
  returnAlertLabel: string | null;
  returnOutcome: string | null;
  issuedBy: string;
  status: string;
  statusCode: "ACTIVE" | "RETURNED" | "TRANSFERRED";
};

type AssignmentsData = {
  assets: AssetOption[];
  holders: HolderOption[];
  assignments: Assignment[];
};

type Target = { holderId: string; kind: "DOTATION" | "LOAN"; expectedReturnAt: string; notes: string };
const emptyTarget: Target = { holderId: "", kind: "DOTATION", expectedReturnAt: "", notes: "" };

const OUTCOMES = [
  { value: "GOOD", label: "Bon etat", hint: "Remis en stock, disponible" },
  { value: "TO_REPAIR", label: "A reparer", hint: "Passe en maintenance" },
  { value: "LOST", label: "Perdu", hint: "Declare perdu" },
] as const;

const CONDITIONS = [
  { value: "", label: "Condition inchangee" },
  { value: "NEW", label: "Neuf" },
  { value: "GOOD", label: "Bon etat" },
  { value: "FAIR", label: "Etat moyen" },
  { value: "POOR", label: "Mauvais etat" },
  { value: "DAMAGED", label: "Endommage" },
];

const selectClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm text-white";
const dialogClass =
  "w-[min(calc(100vw-2rem),44rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none";
const today = () => new Date().toISOString().slice(0, 10);

async function readError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200 md:col-span-2" role="alert">
      {message}
    </p>
  );
}

function ReturnAlertBadge({ assignment }: { assignment: Assignment }) {
  if (!assignment.returnAlert || !assignment.returnAlertLabel) return null;
  const days = assignment.daysUntilReturn;
  const detail =
    days === null ? "" : days < 0 ? ` (${Math.abs(days)} j de retard)` : days === 0 ? " (aujourd'hui)" : ` (J-${days})`;
  return (
    <Badge className={assignment.returnAlert === "OVERDUE" ? "bg-red-900/40 text-red-200" : "bg-amber-900/40 text-amber-100"}>
      {assignment.returnAlertLabel}
      {detail}
    </Badge>
  );
}

function KindBadge({ assignment }: { assignment: Assignment }) {
  return (
    <Badge className={assignment.kind === "LOAN" ? "bg-sky-900/40 text-sky-200" : "bg-slate-800 text-slate-300"}>
      {assignment.kindLabel}
    </Badge>
  );
}

function StatusBadge({ assignment }: { assignment: Assignment }) {
  const tone =
    assignment.statusCode === "ACTIVE"
      ? "bg-emerald-900/40 text-emerald-200"
      : assignment.statusCode === "TRANSFERRED"
        ? "bg-slate-700 text-slate-200"
        : "bg-slate-800 text-slate-300";
  return (
    <div className="flex flex-col gap-1">
      <Badge className={tone}>{assignment.status}</Badge>
      {assignment.returnOutcome ? <span className="text-xs text-slate-500">{assignment.returnOutcome}</span> : null}
    </div>
  );
}

/** Type d'affectation + date de retour (obligatoire pour un pret). */
function TargetFields({ target, onChange }: { target: Target; onChange: (target: Target) => void }) {
  return (
    <>
      <div className="space-y-1 text-xs text-slate-300">
        Type d&apos;affectation *
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {(["DOTATION", "LOAN"] as const).map((kind) => (
            <button
              aria-checked={target.kind === kind}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                target.kind === kind ? "border-red-500/70 bg-red-900/20 text-white" : "border-white/10 bg-white/5 text-slate-300"
              }`}
              key={kind}
              onClick={() => onChange({ ...target, kind, expectedReturnAt: kind === "DOTATION" ? "" : target.expectedReturnAt })}
              role="radio"
              type="button"
            >
              <span className="block font-medium">{kind === "DOTATION" ? "Dotation" : "Pret"}</span>
              <span className="text-xs text-slate-400">{kind === "DOTATION" ? "Sans date de retour" : "Retour a date fixe"}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="space-y-1 text-xs text-slate-300">
        Retour prevu {target.kind === "LOAN" ? "*" : "(pret uniquement)"}
        <Input
          className="h-10 border-white/10 bg-white/6 disabled:opacity-40"
          disabled={target.kind !== "LOAN"}
          min={today()}
          onChange={(event) => onChange({ ...target, expectedReturnAt: event.target.value })}
          required={target.kind === "LOAN"}
          type="date"
          value={target.expectedReturnAt}
        />
      </label>
      <label className="space-y-1 text-xs text-slate-300 md:col-span-2">
        Notes
        <Input
          className="h-10 border-white/10 bg-white/6"
          onChange={(event) => onChange({ ...target, notes: event.target.value })}
          placeholder="Accessoires remis, etat physique…"
          value={target.notes}
        />
      </label>
    </>
  );
}

export function AssignmentsContent() {
  const [tab, setTab] = useState<"assignments" | "holders">("assignments");
  const [data, setData] = useState<AssignmentsData>({ assets: [], holders: [], assignments: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assetFilterId, setAssetFilterId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "CLOSED" | "ALL">("ACTIVE");

  const [isAllocating, setIsAllocating] = useState(false);
  const [allocation, setAllocation] = useState<Target & { assetId: string }>({ ...emptyTarget, assetId: "" });
  const [returning, setReturning] = useState<Assignment | null>(null);
  const [returnForm, setReturnForm] = useState({ outcome: "GOOD", condition: "", notes: "" });
  const [reassigning, setReassigning] = useState<Assignment | null>(null);
  const [reassignForm, setReassignForm] = useState<Target>(emptyTarget);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [editForm, setEditForm] = useState({ notes: "", expectedReturnAt: "" });

  async function load() {
    const response = await apiFetch("/api/assignments", { cache: "no-store" });
    if (response.ok) {
      setData((await response.json()) as AssignmentsData);
    } else {
      setError(await readError(response, "Impossible de charger les affectations."));
    }
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const { assignments } = data;
  const assignableAssets = useMemo(() => data.assets.filter((asset) => asset.assignable), [data.assets]);

  const filtered = assignments.filter((assignment) => {
    if (assetFilterId && assignment.assetId !== assetFilterId) return false;
    if (statusFilter === "ACTIVE" && assignment.statusCode !== "ACTIVE") return false;
    if (statusFilter === "CLOSED" && assignment.statusCode === "ACTIVE") return false;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return [assignment.holder, assignment.holderDetail, assignment.asset, assignment.sku, assignment.serialNumber, assignment.category, assignment.location, assignment.notes, assignment.kindLabel, assignment.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const active = assignments.filter((item) => item.statusCode === "ACTIVE");
  const loanAlerts = active.filter((item) => item.returnAlert === "DUE_SOON" || item.returnAlert === "OVERDUE");

  /** Envoie une action ; en cas de refus metier, affiche le message de l'API. */
  async function send(url: string, method: string, body: unknown) {
    setError(null);
    const response = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setError(await readError(response, "Operation impossible."));
      return false;
    }
    await load();
    window.dispatchEvent(new Event("stock-it:notifications-changed"));
    return true;
  }

  async function submitAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await send("/api/assignments", "POST", allocation)) {
      setIsAllocating(false);
      setAllocation({ ...emptyTarget, assetId: "" });
    }
  }

  async function submitReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (returning && (await send(`/api/assignments/${returning.id}/return`, "POST", returnForm))) {
      setReturning(null);
    }
  }

  async function submitReassign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reassigning && (await send(`/api/assignments/${reassigning.id}/reassign`, "POST", reassignForm))) {
      setReassigning(null);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const body = editing.kind === "LOAN" ? editForm : { notes: editForm.notes };
    if (await send(`/api/assignments/${editing.id}`, "PATCH", body)) {
      setEditing(null);
    }
  }

  return (
    <section className={ui.page}>
      <header className={`${ui.header} md:flex md:items-center md:justify-between`}>
        <div>
          <p className={ui.eyebrow}>Affectations</p>
          <h1 className={ui.title}>{KYC_SHEET_LABELS.WORKSTATIONS}</h1>
          <p className={`${ui.subtitle} mt-1 max-w-3xl`}>
            <strong className="text-white">Dotation</strong> : materiel remis sans date de retour.{" "}
            <strong className="text-white">Pret</strong> : retour a date fixe, alerte 5 jours avant. Un materiel se{" "}
            <strong className="text-white">rend</strong> (bon etat, a reparer, perdu) ou se{" "}
            <strong className="text-white">reaffecte</strong> : l&apos;historique est toujours conserve.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0">
          <ExportPdfButton
            disabled={isLoading}
            filename="affectations-materiel"
            sections={[
              {
                columns: ["Materiel", "Detenteur", "Type", KYC_UI.REMISE, KYC_UI.EXPECTED_RETURN, KYC_UI.ACTUAL_RETURN, KYC_UI.STATE, KYC_UI.NOTES],
                rows: filtered.map((assignment) => [
                  `${assignment.asset} (${assignment.sku})`,
                  assignment.holder,
                  assignment.kindLabel,
                  assignment.remiseAt,
                  assignment.expectedReturnAt,
                  assignment.returnedAt,
                  assignment.status,
                  assignment.notes,
                ]),
              },
            ]}
            subtitle={`PROCO & Cie - ${filtered.length} affectation(s)`}
            title={KYC_SHEET_LABELS.WORKSTATIONS}
          />
          <Button
            className={ui.btnPrimary}
            onClick={() => {
              setError(null);
              setAllocation({ ...emptyTarget, assetId: "" });
              setIsAllocating(true);
            }}
            type="button"
          >
            Allouer {KYC_IN_STORE_COLUMNS.ITEM}
          </Button>
        </div>
      </header>

      <div className="flex gap-1 border-b border-white/10" role="tablist">
        {([
          ["assignments", "Affectations"],
          ["holders", "Detenteurs"],
        ] as const).map(([value, label]) => (
          <button
            aria-selected={tab === value}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === value ? "border-red-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
            key={value}
            onClick={() => setTab(value)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {!isAllocating && !returning && !reassigning && !editing ? <ErrorNotice message={error} /> : null}

      {tab === "holders" ? (
        <HoldersPanel onChanged={() => void load()} />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: PackageCheck, value: active.length, label: "Affectations en cours" },
              { icon: CalendarClock, value: active.filter((item) => item.kind === "LOAN").length, label: "Prets en cours" },
              { icon: AlertTriangle, value: loanAlerts.length, label: "Retours a surveiller (J-5 ou retard)" },
              { icon: ClipboardCheck, value: assignments.length - active.length, label: "Affectations cloturees" },
            ].map(({ icon: Icon, value, label }) => (
              <Card className={`${ui.panel} ring-0`} key={label}>
                <CardHeader className={ui.panelHeader}>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Icon className="size-4 text-slate-400" />
                    {value}
                  </CardTitle>
                  <CardDescription className="text-slate-400">{label}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {loanAlerts.length > 0 ? (
            <Card className={`${ui.panel} border-amber-700/40 ring-0`}>
              <CardContent className={`${ui.panelBody} space-y-2`}>
                {loanAlerts.map((item) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-900/50 px-3 py-2 text-sm"
                    key={item.id}
                  >
                    <span>
                      <strong>{item.asset}</strong> — {item.holder} — retour prevu {item.expectedReturnAt}
                    </span>
                    <ReturnAlertBadge assignment={item} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-3 md:grid-cols-[1fr_1fr_12rem]">
            <AssetSearchSelect
              assets={data.assets}
              emptyLabel={`${KYC_UI.ALL} — materiel`}
              label="Materiel (optionnel)"
              onValueChange={setAssetFilterId}
              placeholder={`${KYC_UI.SEARCH_PLACEHOLDER} (materiel)`}
              value={assetFilterId}
            />
            <label className="space-y-1 text-xs text-slate-300">
              Recherche
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  className={`${ui.input} h-10 pl-9 text-white`}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Detenteur, materiel, process, notes…"
                  value={searchQuery}
                />
              </div>
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              Affichage
              <select className={selectClass} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} value={statusFilter}>
                <option value="ACTIVE">En cours</option>
                <option value="CLOSED">Cloturees</option>
                <option value="ALL">Toutes</option>
              </select>
            </label>
          </div>

          <Card className={`${ui.panel} ${ui.tablePanel}`}>
            <CardContent className={ui.tablePanelBody}>
              {isLoading ? (
                <p className="rounded-md bg-slate-800/50 p-4 text-sm text-slate-400">Chargement des affectations...</p>
              ) : (
                <div className={ui.tableWrap}>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        {["Materiel", "Detenteur", "Type", KYC_UI.REMISE, KYC_UI.EXPECTED_RETURN, KYC_UI.STATE, "Remis par", KYC_UI.ACTIONS].map((head) => (
                          <TableHead className="text-xs text-slate-500" key={head}>
                            {head}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((assignment) => (
                        <TableRow className="border-white/6" key={assignment.id}>
                          <TableCell>
                            <p className="font-medium">{assignment.asset}</p>
                            <p className="font-mono text-xs text-slate-500">
                              {assignment.sku}
                              {assignment.serialNumber ? ` · ${assignment.serialNumber}` : ""}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{assignment.holder}</p>
                            <p className="text-xs text-slate-500">{assignment.holderDetail}</p>
                          </TableCell>
                          <TableCell>
                            <KindBadge assignment={assignment} />
                          </TableCell>
                          <TableCell>{assignment.remiseAt}</TableCell>
                          <TableCell>
                            {assignment.kind === "LOAN" ? (
                              <div className="flex flex-col gap-1">
                                <span>{assignment.expectedReturnAt}</span>
                                <ReturnAlertBadge assignment={assignment} />
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge assignment={assignment} />
                          </TableCell>
                          <TableCell className="text-slate-300">{assignment.issuedBy}</TableCell>
                          <TableCell>
                            {assignment.statusCode === "ACTIVE" ? (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  className={ui.btnSecondary}
                                  onClick={() => {
                                    setError(null);
                                    setReturnForm({ outcome: "GOOD", condition: "", notes: "" });
                                    setReturning(assignment);
                                  }}
                                  size="sm"
                                  type="button"
                                >
                                  <Undo2 className="size-3" />
                                  Retour
                                </Button>
                                <Button
                                  className={ui.btnSecondary}
                                  onClick={() => {
                                    setError(null);
                                    setReassignForm(emptyTarget);
                                    setReassigning(assignment);
                                  }}
                                  size="sm"
                                  type="button"
                                >
                                  <ArrowLeftRight className="size-3" />
                                  Reaffecter
                                </Button>
                                <Button
                                  className={ui.btnSecondary}
                                  onClick={() => {
                                    setError(null);
                                    setEditForm({
                                      notes: assignment.notes === "-" ? "" : assignment.notes,
                                      expectedReturnAt: assignment.expectedReturnAtInput,
                                    });
                                    setEditing(assignment);
                                  }}
                                  size="sm"
                                  type="button"
                                >
                                  Modifier
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Rendu le {assignment.returnedAt}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell className="py-8 text-center text-sm text-slate-500" colSpan={8}>
                            Aucune affectation ne correspond aux filtres.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog onOpenChange={setIsAllocating} open={isAllocating}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle>Allouer {KYC_IN_STORE_COLUMNS.ITEM}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Seul le materiel unitaire disponible s&apos;affecte. Un article en vrac se distribue par une sortie de stock.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitAllocation}>
            <ErrorNotice message={error} />
            <AssetSearchSelect
              assets={assignableAssets}
              label="Materiel *"
              onValueChange={(assetId) => setAllocation((value) => ({ ...value, assetId }))}
              placeholder={`${KYC_UI.SEARCH_PLACEHOLDER} (materiel disponible)`}
              required
              value={allocation.assetId}
            />
            <HolderSearchSelect
              holders={data.holders}
              label="Detenteur *"
              onValueChange={(holderId) => setAllocation((value) => ({ ...value, holderId }))}
              required
              value={allocation.holderId}
            />
            <TargetFields onChange={(target) => setAllocation((value) => ({ ...value, ...target }))} target={allocation} />
            <div className="flex gap-2 md:col-span-2">
              <Button className={`flex-1 ${ui.btnPrimary}`} disabled={!allocation.assetId || !allocation.holderId} type="submit">
                Allouer
              </Button>
              <Button className={ui.btnSecondary} onClick={() => setIsAllocating(false)} type="button">
                Annuler
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => (open ? null : setReturning(null))} open={returning !== null}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle>Retour : {returning?.asset}</DialogTitle>
            <DialogDescription className="text-slate-400">Detenu par {returning?.holder}. Dans quel etat revient-il ?</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitReturn}>
            <ErrorNotice message={error} />
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
              {OUTCOMES.map((outcome) => (
                <button
                  aria-checked={returnForm.outcome === outcome.value}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    returnForm.outcome === outcome.value ? "border-red-500/70 bg-red-900/20 text-white" : "border-white/10 bg-white/5 text-slate-300"
                  }`}
                  key={outcome.value}
                  onClick={() => setReturnForm((value) => ({ ...value, outcome: outcome.value }))}
                  role="radio"
                  type="button"
                >
                  <span className="block font-medium">{outcome.label}</span>
                  <span className="text-xs text-slate-400">{outcome.hint}</span>
                </button>
              ))}
            </div>
            <label className="space-y-1 text-xs text-slate-300">
              Condition constatee
              <select className={selectClass} onChange={(event) => setReturnForm((value) => ({ ...value, condition: event.target.value }))} value={returnForm.condition}>
                {CONDITIONS.map((condition) => (
                  <option key={condition.value} value={condition.value}>
                    {condition.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              Notes
              <Input
                className="h-10 border-white/10 bg-white/6"
                onChange={(event) => setReturnForm((value) => ({ ...value, notes: event.target.value }))}
                placeholder="Accessoires rendus, observations…"
                value={returnForm.notes}
              />
            </label>
            <div className="flex gap-2">
              <Button className={`flex-1 ${ui.btnPrimary}`} type="submit">
                Enregistrer le retour
              </Button>
              <Button className={ui.btnSecondary} onClick={() => setReturning(null)} type="button">
                Annuler
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => (open ? null : setReassigning(null))} open={reassigning !== null}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle>Reaffecter : {reassigning?.asset}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Le materiel passe directement de {reassigning?.holder} au nouveau detenteur.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitReassign}>
            <ErrorNotice message={error} />
            <div className="md:col-span-2">
              <HolderSearchSelect
                holders={data.holders.filter((holder) => holder.id !== reassigning?.holderId)}
                label="Nouveau detenteur *"
                onValueChange={(holderId) => setReassignForm((value) => ({ ...value, holderId }))}
                required
                value={reassignForm.holderId}
              />
            </div>
            <TargetFields onChange={setReassignForm} target={reassignForm} />
            <div className="flex gap-2 md:col-span-2">
              <Button className={`flex-1 ${ui.btnPrimary}`} disabled={!reassignForm.holderId} type="submit">
                Reaffecter
              </Button>
              <Button className={ui.btnSecondary} onClick={() => setReassigning(null)} type="button">
                Annuler
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => (open ? null : setEditing(null))} open={editing !== null}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle>Modifier : {editing?.asset}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Detenteur et materiel ne se modifient pas : utilisez « Reaffecter » ou « Retour ».
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitEdit}>
            <ErrorNotice message={error} />
            {editing?.kind === "LOAN" ? (
              <label className="space-y-1 text-xs text-slate-300">
                Retour prevu *
                <Input
                  className="h-10 border-white/10 bg-white/6"
                  min={today()}
                  onChange={(event) => setEditForm((value) => ({ ...value, expectedReturnAt: event.target.value }))}
                  required
                  type="date"
                  value={editForm.expectedReturnAt}
                />
              </label>
            ) : null}
            <label className="space-y-1 text-xs text-slate-300">
              Notes
              <Input
                className="h-10 border-white/10 bg-white/6"
                onChange={(event) => setEditForm((value) => ({ ...value, notes: event.target.value }))}
                value={editForm.notes}
              />
            </label>
            <div className="flex gap-2">
              <Button className={`flex-1 ${ui.btnPrimary}`} type="submit">
                Enregistrer
              </Button>
              <Button className={ui.btnSecondary} onClick={() => setEditing(null)} type="button">
                Annuler
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

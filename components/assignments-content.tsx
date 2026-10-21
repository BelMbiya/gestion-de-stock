"use client";

import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  PackageCheck,
  Search,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ui } from "@/lib/ui-styles";
import { KYC_IN_STORE_COLUMNS, KYC_SHEET_LABELS, KYC_UI } from "@/lib/kyc-excel/terminology";
import { apiFetch } from "@/lib/api-client";

type ReferenceItem = {
  assignable?: boolean;
  email?: string;
  id: string;
  name: string;
  sku?: string;
  serialNumber?: string | null;
  model?: string | null;
};

type Assignment = {
  agent: string;
  asset: string;
  assetId: string;
  category: string;
  department: string;
  departmentId: string | null;
  id: string;
  location: string;
  notes: string;
  remiseAt: string;
  remiseAtInput: string;
  expectedReturnAt: string;
  expectedReturnAtInput: string;
  returnedAt: string;
  returnedAtInput: string;
  daysUntilReturn: number | null;
  returnAlert: "DUE_SOON" | "OVERDUE" | null;
  returnAlertLabel: string | null;
  status: string;
  statusCode: string;
  userId: string | null;
};

type AssignmentForm = {
  assetId: string;
  assignedAt: string;
  assignedToId: string;
  departmentId: string;
  expectedReturnAt: string;
  notes: string;
  returnedAt: string;
  status: string;
};

const emptyForm: AssignmentForm = {
  assetId: "",
  assignedAt: new Date().toISOString().slice(0, 10),
  assignedToId: "",
  departmentId: "",
  expectedReturnAt: "",
  notes: "",
  returnedAt: "",
  status: "ACTIVE",
};

function ReturnAlertBadge({
  alert,
  label,
  daysUntilReturn,
}: {
  alert: Assignment["returnAlert"];
  label: string | null;
  daysUntilReturn: number | null;
}) {
  if (!alert || !label) {
    return null;
  }

  const detail =
    daysUntilReturn === null
      ? ""
      : daysUntilReturn < 0
        ? ` (${Math.abs(daysUntilReturn)} j de retard)`
        : daysUntilReturn === 0
          ? " (aujourd'hui)"
          : ` (J-${daysUntilReturn})`;

  if (alert === "OVERDUE") {
    return (
      <Badge className="bg-red-900/40 text-red-200">
        {label}
        {detail}
      </Badge>
    );
  }

  return (
    <Badge className="bg-slate-700 text-slate-200">
      {label}
      {detail}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Retourne") {
    return <Badge className="bg-slate-800 text-slate-300">{status}</Badge>;
  }

  if (status === "Transfere") {
    return <Badge className="bg-slate-700 text-slate-200">{status}</Badge>;
  }

  return <Badge className="bg-red-900/40 text-red-200">{status}</Badge>;
}

export function AssignmentsContent() {
  const [assets, setAssets] = useState<ReferenceItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [departments, setDepartments] = useState<ReferenceItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentForm>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [assetFilterId, setAssetFilterId] = useState("");
  const [users, setUsers] = useState<ReferenceItem[]>([]);

  const filteredAssignments = assignments.filter((assignment) => {
    if (assetFilterId && assignment.assetId !== assetFilterId) {
      return false;
    }

    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      return true;
    }

    return [
      assignment.agent,
      assignment.asset,
      assignment.category,
      assignment.department,
      assignment.location,
      assignment.notes,
      assignment.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadAssignments() {
    setLoadError(null);
    try {
      const response = await apiFetch("/api/assignments", { cache: "no-store" });
      const text = await response.text();
      if (!response.ok) {
        setLoadError("Impossible de charger les affectations");
        setIsLoading(false);
        return;
      }
      const data = JSON.parse(text) as {
        assets: ReferenceItem[];
        assignments: Assignment[];
        departments: ReferenceItem[];
        users: ReferenceItem[];
      };
      setAssets(data.assets);
      setAssignments(data.assignments);
      setDepartments(data.departments);
      setUsers(data.users);
    } catch {
      setLoadError("Erreur reseau lors du chargement des affectations");
    }
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAssignments();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = editingId ? `/api/assignments/${editingId}` : "/api/assignments";
    const method = editingId ? "PATCH" : "POST";

    const response = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const text = await response.text();
    if (!response.ok) {
      let message = "Enregistrement de l'affectation impossible";
      try {
        const payload = JSON.parse(text) as { error?: string };
        if (payload.error) {
          message = payload.error;
        }
      } catch {
        if (text.trim()) {
          message = text.trim().slice(0, 200);
        }
      }
      setLoadError(message);
      return;
    }

    setEditingId(null);
    setForm(emptyForm);
    setIsFormOpen(false);
    setLoadError(null);
    await loadAssignments();
    window.dispatchEvent(new Event("stock-it:notifications-changed"));
  }

  function handleEdit(assignment: Assignment) {
    setEditingId(assignment.id);
    setForm({
      assetId: assignment.assetId,
      assignedAt: assignment.remiseAtInput,
      assignedToId: assignment.userId ?? "",
      departmentId: assignment.departmentId ?? "",
      expectedReturnAt: assignment.expectedReturnAtInput,
      notes: assignment.notes === "-" ? "" : assignment.notes,
      returnedAt: assignment.returnedAtInput,
      status: assignment.statusCode,
    });
    setIsFormOpen(true);
  }

  async function handleDelete(id: string) {
    await apiFetch(`/api/assignments/${id}`, { method: "DELETE" });
    await loadAssignments();
    window.dispatchEvent(new Event("stock-it:notifications-changed"));
  }

  return (
    <section className={ui.page}>
      <header className={`${ui.header} md:flex md:items-center md:justify-between`}>
        <div>
          <p className={ui.eyebrow}>Affectations</p>
          <h1 className={ui.title}>{KYC_SHEET_LABELS.WORKSTATIONS}</h1>
          <p className={`${ui.subtitle} mt-1 max-w-3xl`}>
            <strong className="text-white">{KYC_UI.REMISE}</strong> : date ou le{" "}
            {KYC_IN_STORE_COLUMNS.ITEM} est remis au {KYC_UI.USER}.{" "}
            <strong className="text-white">Retour prevu</strong> : echeance de
            restitution (alerte 5 jours avant).{" "}
            <strong className="text-white">Retour effectif</strong> : date reelle du
            retour, renseignee quand le statut passe a Retourne.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0">
          <ExportPdfButton
            disabled={isLoading}
            filename="affectations-materiel"
            sections={[
              {
                columns: [
                  "DESCRIPTION",
                  KYC_UI.USER,
                  KYC_UI.DEPARTMENT,
                  KYC_UI.REMISE,
                  KYC_UI.EXPECTED_RETURN,
                  KYC_UI.ACTUAL_RETURN,
                  KYC_UI.STATE,
                  KYC_UI.NOTES,
                ],
                rows: filteredAssignments.map((assignment) => [
                  assignment.asset,
                  assignment.agent,
                  assignment.department,
                  assignment.remiseAt,
                  assignment.expectedReturnAt,
                  assignment.returnedAt || "-",
                  assignment.status,
                  assignment.notes,
                ]),
              },
            ]}
            subtitle={`PROCO & Cie - ${filteredAssignments.length} affectation(s)`}
            title={KYC_SHEET_LABELS.WORKSTATIONS}
          />
          <Button
            className={ui.btnPrimary}
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setIsFormOpen(true);
            }}
            type="button"
          >
            Allouer {KYC_IN_STORE_COLUMNS.ITEM}
          </Button>
        </div>
      </header>

      {loadError ? (
        <Card className={`${ui.panel} border-red-900/40 ring-0`}>
          <CardContent className={`${ui.panelBody} text-sm text-red-200`}>{loadError}</CardContent>
        </Card>
      ) : null}

      <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
        <DialogContent className="w-[min(calc(100vw-2rem),58rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifier une affectation" : `Allouer ${KYC_IN_STORE_COLUMNS.ITEM}`}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Renseignez {KYC_UI.DESCRIPTION}, {KYC_UI.USER}, les dates et {KYC_UI.STATE}.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 md:grid-cols-2 [&_input]:h-11 [&_select]:h-11"
            onSubmit={handleSubmit}
          >
            <AssetSearchSelect
              assets={assets}
              className="md:col-span-1"
              label={KYC_UI.DESCRIPTION}
              onValueChange={(assetId) =>
                setForm((value) => ({ ...value, assetId }))
              }
              placeholder={`${KYC_UI.SEARCH_PLACEHOLDER} (${KYC_UI.DESCRIPTION})`}
              required
              value={form.assetId}
            />
            <select
              aria-label={KYC_UI.USER}
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  assignedToId: event.target.value,
                }))
              }
              value={form.assignedToId}
            >
              <option value="">{KYC_UI.USER}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select
              aria-label={KYC_UI.DEPARTMENT}
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  departmentId: event.target.value,
                }))
              }
              value={form.departmentId}
            >
              <option value="">{KYC_UI.DEPARTMENT}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Etat affectation"
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({ ...value, status: event.target.value }))
              }
              value={form.status}
            >
              <option value="ACTIVE">Alloue</option>
              <option value="RETURNED">Retourne</option>
              <option value="TRANSFERRED">Transfere</option>
            </select>
            <Input
              aria-label="Date de remise"
              className="border-white/10 bg-white/6"
              onChange={(event) =>
                setForm((value) => ({ ...value, assignedAt: event.target.value }))
              }
              required
              type="date"
              value={form.assignedAt}
            />
            <Input
              aria-label="Retour prevu"
              className="border-white/10 bg-white/6"
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  expectedReturnAt: event.target.value,
                }))
              }
              required={form.status === "ACTIVE" || form.status === "TRANSFERRED"}
              type="date"
              value={form.expectedReturnAt}
            />
            <Input
              aria-label="Retour effectif"
              className="border-white/10 bg-white/6"
              disabled={form.status !== "RETURNED"}
              onChange={(event) =>
                setForm((value) => ({ ...value, returnedAt: event.target.value }))
              }
              type="date"
              value={form.returnedAt}
            />
            <Input
              className="border-white/10 bg-white/6 md:col-span-2"
              onChange={(event) =>
                setForm((value) => ({ ...value, notes: event.target.value }))
              }
              placeholder="Notes, etat physique, accessoires remis..."
              value={form.notes}
            />
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button
                className={`flex-1 ${ui.btnPrimary}`}
                type="submit"
              >
                {editingId ? "Enregistrer" : "Allouer"}
              </Button>
              {editingId ? (
                <Button
                  className="bg-red-900/30 text-red-200 hover:bg-red-900/50"
                  onClick={async () => {
                    await handleDelete(editingId);
                    setEditingId(null);
                    setForm(emptyForm);
                    setIsFormOpen(false);
                  }}
                  type="button"
                >
                  <Trash2 className="size-4" />
                  Supprimer
                </Button>
              ) : null}
              {editingId ? (
                <Button
                  className={ui.btnSecondary}
                  onClick={() => {
                    setEditingId(null);
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className={`${ui.panel} ring-0`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <PackageCheck className="size-4 text-slate-400" />
              {assignments.filter((item) => item.statusCode === "ACTIVE").length}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Affectations actives
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className={`${ui.panel} ring-0`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="size-4 text-slate-400" />
              {
                assignments.filter(
                  (item) => item.returnAlert === "DUE_SOON" || item.returnAlert === "OVERDUE",
                ).length
              }
            </CardTitle>
            <CardDescription className="text-slate-400">
              Alertes retour (J-5 ou retard)
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className={`${ui.panel} ring-0`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ClipboardCheck className="size-4 text-slate-400" />
              {assignments.filter((item) => item.statusCode === "RETURNED").length}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Materiels retournes
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className={`${ui.panel} ring-0`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarDays className="size-4 text-slate-400" />
              {assignments.length}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Historique total
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {assignments.some(
        (item) => item.returnAlert === "DUE_SOON" || item.returnAlert === "OVERDUE",
      ) ? (
        <Card className={`${ui.panel} border-slate-600/40 ring-0`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-200">
              <AlertTriangle className="size-4" />
              Alertes {KYC_UI.EXPECTED_RETURN}
            </CardTitle>
            <CardDescription className={ui.subtitle}>
              Retours prevus dans les 5 prochains jours ou en retard.
            </CardDescription>
          </CardHeader>
          <CardContent className={`${ui.panelBody} space-y-2`}>
            {assignments
              .filter(
                (item) => item.returnAlert === "DUE_SOON" || item.returnAlert === "OVERDUE",
              )
              .map((item) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-900/50 px-3 py-2 text-sm"
                  key={item.id}
                >
                  <span>
                    <strong>{item.asset}</strong> — {item.agent} — retour prevu{" "}
                    {item.expectedReturnAt}
                  </span>
                  <ReturnAlertBadge
                    alert={item.returnAlert}
                    daysUntilReturn={item.daysUntilReturn}
                    label={item.returnAlertLabel}
                  />
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <AssetSearchSelect
          assets={assets}
          emptyLabel={`${KYC_UI.ALL} — ${KYC_UI.DESCRIPTION}`}
          label={`${KYC_UI.DESCRIPTION} ${KYC_UI.OPTIONAL}`}
          onValueChange={setAssetFilterId}
          placeholder={`${KYC_UI.SEARCH_PLACEHOLDER} (${KYC_UI.DESCRIPTION})`}
          value={assetFilterId}
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            className={`${ui.input} pl-9 text-white`}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={`${KYC_UI.USER}, ${KYC_UI.DESCRIPTION}, ${KYC_UI.DEPARTMENT}, ${KYC_UI.STATE}…`}
            value={searchQuery}
          />
        </div>
      </div>

      <Card className={`${ui.panel} ${ui.tablePanel}`}>
        <CardContent className={ui.tablePanelBody}>
          {isLoading ? (
            <p className="rounded-md bg-slate-800/50 p-4 text-sm text-slate-400">
              Chargement des affectations...
            </p>
          ) : (
            <div className={ui.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  {[
                    "DESCRIPTION",
                    KYC_UI.USER,
                    KYC_UI.DEPARTMENT,
                    KYC_UI.REMISE,
                    KYC_UI.EXPECTED_RETURN,
                    KYC_UI.ACTUAL_RETURN,
                    KYC_UI.STATE,
                    KYC_UI.NOTES,
                    KYC_UI.ACTIONS,
                  ].map((head) => (
                    <TableHead className="text-xs text-slate-500" key={head}>
                      {head}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((assignment) => (
                  <TableRow className="border-white/6" key={assignment.id}>
                    <TableCell>
                      <p className="font-medium">{assignment.asset}</p>
                      <p className="text-xs text-slate-500">
                        {assignment.category} · {assignment.location}
                      </p>
                    </TableCell>
                    <TableCell>{assignment.agent}</TableCell>
                    <TableCell>{assignment.department}</TableCell>
                    <TableCell>{assignment.remiseAt}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{assignment.expectedReturnAt}</span>
                        <ReturnAlertBadge
                          alert={assignment.returnAlert}
                          daysUntilReturn={assignment.daysUntilReturn}
                          label={assignment.returnAlertLabel}
                        />
                      </div>
                    </TableCell>
                    <TableCell>{assignment.returnedAt}</TableCell>
                    <TableCell>
                      <StatusBadge status={assignment.status} />
                    </TableCell>
                    <TableCell className="max-w-[18rem] whitespace-normal text-slate-300">
                      {assignment.notes}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          className={ui.btnSecondary}
                          onClick={() => handleEdit(assignment)}
                          size="sm"
                          type="button"
                        >
                          Modifier
                        </Button>
                        <Button
                          className="bg-red-900/30 text-red-200 hover:bg-red-900/50"
                          onClick={() => handleDelete(assignment.id)}
                          size="sm"
                          type="button"
                        >
                          Supprimer
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
    </section>
  );
}

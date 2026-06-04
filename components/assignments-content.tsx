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

type ReferenceItem = {
  assignable?: boolean;
  email?: string;
  id: string;
  name: string;
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
      <Badge className="bg-[#ff2f45]/25 text-[#ff9aa5]">
        {label}
        {detail}
      </Badge>
    );
  }

  return (
    <Badge className="bg-amber-500/20 text-amber-200">
      {label}
      {detail}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Retourne") {
    return <Badge className="bg-white/10 text-slate-200">{status}</Badge>;
  }

  if (status === "Transfere") {
    return (
      <Badge className="bg-[#6fb6ff]/20 text-[#9fd0ff] hover:bg-[#6fb6ff]/20">
        {status}
      </Badge>
    );
  }

  return (
    <Badge className="bg-[#ff2f45]/20 text-[#ff9aa5] hover:bg-[#ff2f45]/20">
      {status}
    </Badge>
  );
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
  const [users, setUsers] = useState<ReferenceItem[]>([]);

  const filteredAssignments = assignments.filter((assignment) => {
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
      const response = await fetch("/api/assignments", { cache: "no-store" });
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

    const response = await fetch(url, {
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
    await fetch(`/api/assignments/${id}`, { method: "DELETE" });
    await loadAssignments();
    window.dispatchEvent(new Event("stock-it:notifications-changed"));
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-5 text-white">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#6fb6ff]">
            Affectations
          </p>
          <h1 className="mt-2 text-3xl font-black">Materiels alloues aux agents</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            <strong className="text-white">Remise</strong> : date ou le materiel est
            remis a l&apos;agent.{" "}
            <strong className="text-white">Retour prevu</strong> : echeance de
            restitution (alerte 5 jours avant).{" "}
            <strong className="text-white">Retour effectif</strong> : date reelle du
            retour, renseignee quand le statut passe a Retourne.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportPdfButton
            disabled={isLoading}
            filename="affectations-materiel"
            sections={[
              {
                columns: [
                  "Materiel",
                  "Agent",
                  "Departement",
                  "Remise",
                  "Retour prevu",
                  "Retour effectif",
                  "Etat",
                  "Notes",
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
            title="Affectations materiel IT"
          />
          <Button
            className="w-fit bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setIsFormOpen(true);
            }}
            type="button"
          >
            Allouer un materiel
          </Button>
        </div>
      </header>

      {loadError ? (
        <Card className="border-[#ff2f45]/30 bg-[#ff2f45]/10 text-white ring-0">
          <CardContent className="p-4 text-sm text-[#ff9aa5]">{loadError}</CardContent>
        </Card>
      ) : null}

      <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
        <DialogContent className="w-[min(calc(100vw-2rem),58rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifier une affectation" : "Allouer un materiel"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Renseignez le materiel remis, l&apos;agent responsable, les dates et
              l&apos;etat de suivi.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 md:grid-cols-2 [&_input]:h-11 [&_select]:h-11"
            onSubmit={handleSubmit}
          >
            <select
              aria-label="Materiel affecte"
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({ ...value, assetId: event.target.value }))
              }
              required
              value={form.assetId}
            >
              <option value="">Materiel</option>
              {assets.map((asset) => (
                <option
                  disabled={asset.assignable === false}
                  key={asset.id}
                  value={asset.id}
                >
                  {asset.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Agent beneficiaire"
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  assignedToId: event.target.value,
                }))
              }
              value={form.assignedToId}
            >
              <option value="">Agent</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Departement beneficiaire"
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  departmentId: event.target.value,
                }))
              }
              value={form.departmentId}
            >
              <option value="">Departement</option>
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
                className="flex-1 bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
                type="submit"
              >
                {editingId ? "Enregistrer" : "Allouer"}
              </Button>
              {editingId ? (
                <Button
                  className="border border-[#ff2f45]/40 bg-[#ff2f45]/20 text-[#ff9aa5] hover:bg-[#ff2f45]/30"
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
                  className="bg-white/10 text-white hover:bg-white/15"
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PackageCheck className="size-5 text-[#6fb6ff]" />
              {assignments.filter((item) => item.statusCode === "ACTIVE").length}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Affectations actives
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="size-5 text-amber-300" />
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
        <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="size-5 text-[#6fb6ff]" />
              {assignments.filter((item) => item.statusCode === "RETURNED").length}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Materiels retournes
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5 text-[#6fb6ff]" />
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
        <Card className="border-amber-500/30 bg-amber-500/10 text-white ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-amber-100">
              <AlertTriangle className="size-5" />
              Alertes de retour materiel
            </CardTitle>
            <CardDescription className="text-amber-100/80">
              Retours prevus dans les 5 prochains jours ou en retard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {assignments
              .filter(
                (item) => item.returnAlert === "DUE_SOON" || item.returnAlert === "OVERDUE",
              )
              .map((item) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm"
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

      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-11 border-white/10 bg-white/6 pl-11 text-white"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Rechercher par agent, materiel, departement, etat..."
          value={searchQuery}
        />
      </div>

      <Card className="min-h-0 flex-1 border-white/10 bg-[#11183b]/95 text-white ring-0">
        <CardContent className="overflow-auto p-4">
          {isLoading ? (
            <p className="rounded-xl bg-white/6 p-4 text-sm text-slate-300">
              Chargement des affectations...
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  {[
                    "Materiel",
                    "Agent",
                    "Departement",
                    "Remise",
                    "Retour prevu",
                    "Retour effectif",
                    "Etat",
                    "Notes",
                    "Actions",
                  ].map((head) => (
                    <TableHead className="text-slate-400" key={head}>
                      {head}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((assignment) => (
                  <TableRow className="border-white/6 hover:bg-white/5" key={assignment.id}>
                    <TableCell>
                      <p className="font-bold">{assignment.asset}</p>
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
                          className="bg-white/10 text-white hover:bg-white/15"
                          onClick={() => handleEdit(assignment)}
                          type="button"
                        >
                          Modifier
                        </Button>
                        <Button
                          className="border border-[#ff2f45]/40 bg-[#ff2f45]/20 text-[#ff9aa5] hover:bg-[#ff2f45]/30"
                          onClick={() => handleDelete(assignment.id)}
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
          )}
        </CardContent>
      </Card>
    </section>
  );
}

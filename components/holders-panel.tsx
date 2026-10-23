"use client";

import { Pencil, Search, UserPlus, UserRound, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { readApiError } from "@/components/error-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";
import { ui } from "@/lib/ui-styles";

type Holder = {
  id: string;
  type: "PERSON" | "COLLECTIVE";
  typeLabel: string;
  fullName: string;
  matricule: string | null;
  process: string | null;
  departmentId: string | null;
  department: string | null;
  active: boolean;
  activeAssignments: number;
  toRecover: boolean;
};

type HolderDetail = {
  holder: Holder;
  assignments: Array<{
    id: string;
    asset: string;
    sku: string;
    serialNumber: string | null;
    kind: string;
    status: string;
    statusCode: string;
    assignedAt: string;
    returnedAt: string;
    returnOutcome: string | null;
  }>;
  stockOuts: Array<{ id: string; asset: string; quantity: number; unit: string; movedAt: string; reason: string }>;
};

type HolderForm = {
  type: "PERSON" | "COLLECTIVE";
  fullName: string;
  matricule: string;
  process: string;
  departmentId: string;
};

const emptyForm: HolderForm = { type: "PERSON", fullName: "", matricule: "", process: "", departmentId: "" };
const selectClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm text-white";

/** Onglet « Detenteurs » : personnes et collectifs qui detiennent du materiel. */
export function HoldersPanel({ onChanged }: { onChanged: () => void }) {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"active" | "inactive" | "all">("active");
  const [form, setForm] = useState<HolderForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [detail, setDetail] = useState<HolderDetail | null>(null);

  async function load() {
    const response = await apiFetch("/api/holders", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { holders: Holder[]; departments: Array<{ id: string; name: string }> };
      setHolders(data.holders);
      setDepartments(data.departments);
    } else {
      setError(await readApiError(response, "Impossible de charger les detenteurs."));
    }
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return holders.filter((holder) => {
      if (scope === "active" && !holder.active) return false;
      if (scope === "inactive" && holder.active) return false;
      if (!normalized) return true;
      return [holder.fullName, holder.matricule, holder.process, holder.department, holder.typeLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [holders, query, scope]);

  const toRecoverCount = holders.filter((holder) => holder.toRecover).length;

  async function mutate(url: string, method: string, body?: unknown) {
    setError(null);
    const response = await apiFetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      setError(await readApiError(response, "Operation impossible."));
      return false;
    }
    await load();
    onChanged();
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await mutate(editingId ? `/api/holders/${editingId}` : "/api/holders", editingId ? "PATCH" : "POST", form);
    if (ok) {
      setIsFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    }
  }

  async function openDetail(id: string) {
    const response = await apiFetch(`/api/holders/${id}`, { cache: "no-store" });
    if (response.ok) {
      setDetail((await response.json()) as HolderDetail);
    } else {
      setError(await readApiError(response, "Fiche indisponible."));
    }
  }

  function openForm(holder?: Holder) {
    setError(null);
    setEditingId(holder?.id ?? null);
    setForm(
      holder
        ? {
            type: holder.type,
            fullName: holder.fullName,
            matricule: holder.matricule ?? "",
            process: holder.process ?? "",
            departmentId: holder.departmentId ?? "",
          }
        : emptyForm,
    );
    setIsFormOpen(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            aria-label="Rechercher un detenteur"
            className={`${ui.input} pl-9 text-white`}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, matricule, process, departement…"
            value={query}
          />
        </div>
        <select
          aria-label="Filtrer les detenteurs"
          className={`${selectClass} h-9 w-auto`}
          onChange={(event) => setScope(event.target.value as typeof scope)}
          value={scope}
        >
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
          <option value="all">Tous</option>
        </select>
        <Button className={ui.btnPrimary} onClick={() => openForm()} type="button">
          <UserPlus className="size-4" />
          Nouveau detenteur
        </Button>
      </div>

      {toRecoverCount > 0 ? (
        <p className="rounded-md border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-sm text-amber-100">
          {toRecoverCount} detenteur(s) inactif(s) detiennent encore du materiel : a recuperer.
        </p>
      ) : null}
      {error && !isFormOpen ? (
        <p className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      <Card className={`${ui.panel} ${ui.tablePanel}`}>
        <CardContent className={ui.tablePanelBody}>
          {isLoading ? (
            <p className="rounded-md bg-slate-800/50 p-4 text-sm text-slate-400">Chargement des detenteurs...</p>
          ) : (
            <div className={ui.tableWrap}>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    {["Detenteur", "Type", "Process / departement", "Matricule", "Materiel detenu", "Actions"].map((head) => (
                      <TableHead className="text-xs text-slate-500" key={head}>
                        {head}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((holder) => (
                    <TableRow className={`border-white/6 ${holder.active ? "" : "opacity-60"}`} key={holder.id}>
                      <TableCell>
                        <button
                          className="text-left font-medium text-white hover:underline"
                          onClick={() => openDetail(holder.id)}
                          type="button"
                        >
                          {holder.fullName}
                        </button>
                        {!holder.active ? <p className="text-xs text-slate-500">Inactif</p> : null}
                      </TableCell>
                      <TableCell>
                        <Badge className={holder.type === "COLLECTIVE" ? "bg-sky-900/40 text-sky-200" : "bg-slate-800 text-slate-300"}>
                          {holder.type === "COLLECTIVE" ? <Users className="size-3" /> : <UserRound className="size-3" />}
                          {holder.typeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {[holder.process, holder.department].filter(Boolean).join(" · ") || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">{holder.matricule ?? "-"}</TableCell>
                      <TableCell>
                        <span className="text-slate-200">{holder.activeAssignments}</span>
                        {holder.toRecover ? (
                          <Badge className="ml-2 bg-amber-900/40 text-amber-100">A recuperer</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button className={ui.btnSecondary} onClick={() => openForm(holder)} size="sm" type="button">
                            <Pencil className="size-3" />
                            Modifier
                          </Button>
                          <Button
                            className={ui.btnSecondary}
                            onClick={() => mutate(`/api/holders/${holder.id}`, "PATCH", { active: !holder.active })}
                            size="sm"
                            type="button"
                          >
                            {holder.active ? "Desactiver" : "Reactiver"}
                          </Button>
                          {holder.activeAssignments === 0 ? (
                            <Button
                              className="bg-red-900/30 text-red-200 hover:bg-red-900/50"
                              onClick={() => mutate(`/api/holders/${holder.id}`, "DELETE")}
                              size="sm"
                              type="button"
                            >
                              Supprimer
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell className="py-8 text-center text-sm text-slate-500" colSpan={6}>
                        Aucun detenteur ne correspond.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
        <DialogContent className="w-[min(calc(100vw-2rem),40rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier le detenteur" : "Nouveau detenteur"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Une personne, ou un collectif pour les postes partages (ex. agents du call center).
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            {error ? (
              <p className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200 md:col-span-2" role="alert">
                {error}
              </p>
            ) : null}
            <label className="space-y-1 text-xs text-slate-300 md:col-span-2">
              Nom *
              <Input
                className="h-10 border-white/10 bg-white/6"
                onChange={(event) => setForm((f) => ({ ...f, fullName: event.target.value }))}
                required
                value={form.fullName}
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              Type *
              <select
                className={selectClass}
                onChange={(event) => setForm((f) => ({ ...f, type: event.target.value as HolderForm["type"] }))}
                value={form.type}
              >
                <option value="PERSON">Personne</option>
                <option value="COLLECTIVE">Collectif (poste partage)</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              Matricule
              <Input
                className="h-10 border-white/10 bg-white/6"
                onChange={(event) => setForm((f) => ({ ...f, matricule: event.target.value }))}
                value={form.matricule}
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              Process
              <Input
                className="h-10 border-white/10 bg-white/6"
                onChange={(event) => setForm((f) => ({ ...f, process: event.target.value }))}
                placeholder="INBOUND, VALIDATION…"
                value={form.process}
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              Departement
              <select
                className={selectClass}
                onChange={(event) => setForm((f) => ({ ...f, departmentId: event.target.value }))}
                value={form.departmentId}
              >
                <option value="">Aucun</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 md:col-span-2">
              <Button className={`flex-1 ${ui.btnPrimary}`} type="submit">
                {editingId ? "Enregistrer" : "Creer"}
              </Button>
              <Button className={ui.btnSecondary} onClick={() => setIsFormOpen(false)} type="button">
                Annuler
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => (open ? null : setDetail(null))} open={detail !== null}>
        <DialogContent className="w-[min(calc(100vw-2rem),52rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>{detail.holder.fullName}</DialogTitle>
                <DialogDescription className="text-slate-400">
                  {detail.holder.typeLabel}
                  {detail.holder.process ? ` · ${detail.holder.process}` : ""}
                  {detail.holder.department ? ` · ${detail.holder.department}` : ""}
                  {detail.holder.active ? "" : " · inactif"}
                </DialogDescription>
              </DialogHeader>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Materiel detenu ({detail.assignments.filter((a) => a.statusCode === "ACTIVE").length})
                </h3>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {detail.assignments
                    .filter((assignment) => assignment.statusCode === "ACTIVE")
                    .map((assignment) => (
                      <div
                        className="flex items-center justify-between rounded-md border border-white/10 bg-slate-900/50 px-3 py-2 text-sm"
                        key={assignment.id}
                      >
                        <span>
                          <strong>{assignment.asset}</strong>
                          <span className="ml-2 font-mono text-xs text-slate-500">
                            {assignment.sku}
                            {assignment.serialNumber ? ` · ${assignment.serialNumber}` : ""}
                          </span>
                        </span>
                        <span className="text-xs text-slate-400">
                          {assignment.kind} depuis le {assignment.assignedAt}
                        </span>
                      </div>
                    ))}
                </div>
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Historique</h3>
                <div className="max-h-56 space-y-1 overflow-y-auto text-sm text-slate-300">
                  {detail.assignments
                    .filter((assignment) => assignment.statusCode !== "ACTIVE")
                    .map((assignment) => (
                      <p key={assignment.id}>
                        {assignment.asset} — {assignment.kind}, {assignment.assignedAt} → {assignment.returnedAt} ·{" "}
                        {assignment.status}
                        {assignment.returnOutcome ? ` (${assignment.returnOutcome})` : ""}
                      </p>
                    ))}
                  {detail.stockOuts.map((movement) => (
                    <p key={movement.id}>
                      Sortie de stock : {movement.quantity} {movement.unit} — {movement.asset}, le {movement.movedAt}
                    </p>
                  ))}
                  {detail.assignments.every((a) => a.statusCode === "ACTIVE") && detail.stockOuts.length === 0 ? (
                    <p className="text-slate-500">Aucun historique.</p>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

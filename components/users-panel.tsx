"use client";

import { Search, UserPlus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ErrorNotice, readApiError } from "@/components/error-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";
import type { UserRole } from "@/lib/generated/prisma/enums";
import { ui } from "@/lib/ui-styles";

type Department = { id: string; name: string };

type AppUser = {
  active: boolean;
  activeAssignments: number;
  activeIncidents: number;
  department: string;
  departmentId: string | null;
  email: string;
  id: string;
  isCurrentUser: boolean;
  name: string;
  role: UserRole;
};

type UserForm = { departmentId: string; email: string; name: string; role: UserRole };

const emptyForm: UserForm = { departmentId: "", email: "", name: "", role: "TECHNICIAN" };

/** Libelles cote client (le service serveur n'est pas importable dans le navigateur). */
const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  IT_MANAGER: "Manager IT",
  TECHNICIAN: "Technicien",
  AUDITOR: "Auditeur",
  EMPLOYEE: "Employe",
};

const roleHints: Record<UserRole, string> = {
  ADMIN: "Administration complete",
  IT_MANAGER: "Gestion du parc et des comptes",
  TECHNICIAN: "Interventions, mouvements, affectations",
  AUDITOR: "Consultation et controle",
  EMPLOYEE: "Acces de base",
};

const fieldClass = `${ui.input} h-10 w-full rounded-md px-3 text-sm text-white`;

/** Comptes autorises a se connecter : ajout, modification, revocation d'acces, suppression. */
export function UsersPanel() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const response = await apiFetch("/api/users", { cache: "no-store" });
    if (!response.ok) {
      setError(await readApiError(response, "Impossible de charger les comptes."));
      setIsLoading(false);
      return;
    }
    const data: { departments: Department[]; users: AppUser[] } = await response.json();
    setDepartments(data.departments);
    setUsers(data.users);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return users;
    return users.filter((user) =>
      [user.name, user.email, user.department, roleLabels[user.role]].join(" ").toLowerCase().includes(query),
    );
  }, [searchQuery, users]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEdit(user: AppUser) {
    setEditingId(user.id);
    setForm({ departmentId: user.departmentId ?? "", email: user.email, name: user.name, role: user.role });
    setFormError(null);
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await apiFetch(editingId ? `/api/users/${editingId}` : "/api/users", {
      method: editingId ? "PATCH" : "POST",
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      setFormError(await readApiError(response, "Enregistrement impossible."));
      return;
    }
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    await loadUsers();
  }

  async function runAction(request: Promise<Response>, fallback: string) {
    setError(null);
    const response = await request;
    if (!response.ok) {
      setError(await readApiError(response, fallback));
      return;
    }
    await loadUsers();
  }

  function setAccess(user: AppUser, active: boolean) {
    void runAction(
      apiFetch(`/api/users/${user.id}/access`, { method: "PATCH", body: JSON.stringify({ active }) }),
      "Changement d'acces impossible.",
    );
  }

  function remove(user: AppUser) {
    if (!confirm(`Supprimer le compte ${user.email} ? Un compte avec historique doit etre desactive.`)) {
      return;
    }
    void runAction(apiFetch(`/api/users/${user.id}`, { method: "DELETE" }), "Suppression impossible.");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-[16rem] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            aria-label="Rechercher un compte"
            className={`${ui.input} h-10 pl-9 text-white`}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Nom, email, role, departement…"
            value={searchQuery}
          />
        </div>
        <Button className={`h-10 ${ui.btnPrimary}`} onClick={openCreate} type="button">
          <UserPlus className="size-4" />
          Ajouter un utilisateur
        </Button>
      </div>

      <p className="shrink-0 text-xs text-slate-400">
        Seuls ces comptes peuvent se connecter (Google ou email verifie). Desactiver un compte coupe son acces sans effacer
        son historique.
      </p>

      <ErrorNotice message={error} />

      <Card className={`${ui.panel} flex min-h-0 flex-1 flex-col overflow-hidden py-0 ring-0`}>
        {isLoading ? (
          <p className="m-4 rounded-md bg-slate-800/50 p-4 text-sm text-slate-400">Chargement des comptes...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="m-4 rounded-md bg-slate-800/50 p-4 text-sm text-slate-400">Aucun compte.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
            <Table className="min-w-[52rem]">
              <TableHeader className="sticky top-0 z-10 bg-[#0d1330] shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="text-xs text-slate-500">Compte</TableHead>
                  <TableHead className="w-[11rem] text-xs text-slate-500">Role</TableHead>
                  <TableHead className="w-[10rem] text-xs text-slate-500">Departement</TableHead>
                  <TableHead className="w-[12rem] text-xs text-slate-500">En cours</TableHead>
                  <TableHead className="w-[7rem] text-xs text-slate-500">Acces</TableHead>
                  <TableHead className="w-[15rem] text-right text-xs text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow className={`border-white/6 ${user.active ? "" : "opacity-60"}`} key={user.id}>
                    <TableCell className="whitespace-normal align-top">
                      <p className="flex items-center gap-2 font-medium text-white">
                        {user.name}
                        {user.isCurrentUser ? <Badge className="bg-slate-700 text-slate-200">Vous</Badge> : null}
                      </p>
                      <p className="break-all text-xs text-slate-400">{user.email}</p>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <p className="text-slate-200">{roleLabels[user.role]}</p>
                      <p className="text-xs text-slate-500">{roleHints[user.role]}</p>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top text-slate-300">{user.department}</TableCell>
                    <TableCell className="align-top text-xs text-slate-400">
                      {`${user.activeAssignments} affectation(s) · ${user.activeIncidents} panne(s)`}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge className={user.active ? "bg-emerald-900/40 text-emerald-200" : "bg-slate-800 text-slate-400"}>
                        {user.active ? "Actif" : "Desactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end gap-1.5">
                        <Button className={`h-8 px-2 text-xs ${ui.btnSecondary}`} onClick={() => openEdit(user)} type="button">
                          Modifier
                        </Button>
                        {user.isCurrentUser ? null : (
                          <>
                            <Button
                              className={`h-8 px-2 text-xs ${ui.btnSecondary}`}
                              onClick={() => setAccess(user, !user.active)}
                              type="button"
                            >
                              {user.active ? "Desactiver" : "Reactiver"}
                            </Button>
                            <Button
                              className="h-8 bg-red-900/30 px-2 text-xs text-red-200 hover:bg-red-900/50"
                              onClick={() => remove(user)}
                              type="button"
                            >
                              Supprimer
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
        <DialogContent className="w-[min(calc(100vw-2rem),40rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier un utilisateur" : "Ajouter un utilisateur"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              La personne se connecte ensuite avec cet email (Google ou email verifie).
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <Input
              className={`${ui.input} h-10 text-white md:col-span-2`}
              onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
              placeholder="Nom complet"
              value={form.name}
            />
            <Input
              className={`${ui.input} h-10 text-white md:col-span-2`}
              onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
              placeholder="Email professionnel"
              required
              type="email"
              value={form.email}
            />
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Role
              <select
                className={fieldClass}
                onChange={(event) => setForm((value) => ({ ...value, role: event.target.value as UserRole }))}
                value={form.role}
              >
                {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Departement
              <select
                className={fieldClass}
                onChange={(event) => setForm((value) => ({ ...value, departmentId: event.target.value }))}
                value={form.departmentId}
              >
                <option value="">Non renseigne</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <ErrorNotice message={formError} />
            <div className="flex gap-2 md:col-span-2">
              <Button className={`flex-1 ${ui.btnPrimary}`} type="submit">
                {editingId ? "Enregistrer" : "Ajouter"}
              </Button>
              <Button className={ui.btnSecondary} onClick={() => setIsFormOpen(false)} type="button">
                Annuler
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

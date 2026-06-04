"use client";

import { FormEvent, useEffect, useState } from "react";
import { Search, Trash2, UserCog } from "lucide-react";

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

type Department = {
  id: string;
  name: string;
};

type Technician = {
  activeAssignments: number;
  activeIncidents: number;
  department: string;
  departmentId: string | null;
  email: string;
  id: string;
  name: string;
  photoUrl: string | null;
  role: string;
};

type TechnicianForm = {
  departmentId: string;
  email: string;
  name: string;
  photoUrl: string;
  role: string;
};

const emptyForm: TechnicianForm = {
  departmentId: "",
  email: "",
  name: "",
  photoUrl: "",
  role: "TECHNICIAN",
};

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  IT_MANAGER: "Manager IT",
  TECHNICIAN: "Technicien",
};

export function TechniciansContent() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TechnicianForm>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  const filteredTechnicians = technicians.filter((technician) => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      return true;
    }

    return [
      technician.department,
      technician.email,
      technician.name,
      roleLabels[technician.role] ?? technician.role,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  async function loadTechnicians() {
    const response = await fetch("/api/technicians", { cache: "no-store" });
    const data = await response.json();
    setDepartments(data.departments);
    setTechnicians(data.technicians);
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTechnicians();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = editingId ? `/api/technicians/${editingId}` : "/api/technicians";
    const method = editingId ? "PATCH" : "POST";

    await fetch(url, {
      method,
      body: JSON.stringify(form),
    });

    setEditingId(null);
    setForm(emptyForm);
    setIsFormOpen(false);
    await loadTechnicians();
  }

  function handleEdit(technician: Technician) {
    setEditingId(technician.id);
    setForm({
      departmentId: technician.departmentId ?? "",
      email: technician.email,
      name: technician.name,
      photoUrl: technician.photoUrl ?? "",
      role: technician.role,
    });
    setIsFormOpen(true);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/technicians/${id}`, { method: "DELETE" });
    await loadTechnicians();
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-5 text-white">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#6fb6ff]">
            Techniciens IT
          </p>
          <h1 className="mt-2 text-3xl font-black">Equipe support et maintenance</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Gere les techniciens, managers IT et administrateurs assignables aux
            pannes, affectations et interventions terrain.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportPdfButton
            disabled={isLoading}
            filename="techniciens-it"
            sections={[
              {
                columns: [
                  "Nom",
                  "Email",
                  "Role",
                  "Departement",
                  "Pannes actives",
                  "Affectations actives",
                ],
                rows: filteredTechnicians.map((technician) => [
                  technician.name,
                  technician.email,
                  roleLabels[technician.role] ?? technician.role,
                  technician.department,
                  String(technician.activeIncidents),
                  String(technician.activeAssignments),
                ]),
              },
            ]}
            subtitle={`PROCO & Cie - ${filteredTechnicians.length} technicien(s)`}
            title="Equipe support et maintenance"
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
            Ajouter un technicien
          </Button>
        </div>
      </header>

      <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
        <DialogContent className="w-[min(calc(100vw-2rem),48rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifier un technicien" : "Ajouter un technicien"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Ces profils alimentent les listes de techniciens dans les pannes.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 md:grid-cols-2 [&_input]:h-11 [&_select]:h-11"
            onSubmit={handleSubmit}
          >
            <Input
              className="border-white/10 bg-white/6"
              onChange={(event) =>
                setForm((value) => ({ ...value, name: event.target.value }))
              }
              placeholder="Nom complet"
              required
              value={form.name}
            />
            <Input
              className="border-white/10 bg-white/6"
              onChange={(event) =>
                setForm((value) => ({ ...value, email: event.target.value }))
              }
              placeholder="Email professionnel"
              required
              type="email"
              value={form.email}
            />
            <select
              aria-label="Role IT"
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({ ...value, role: event.target.value }))
              }
              value={form.role}
            >
              <option value="TECHNICIAN">Technicien</option>
              <option value="IT_MANAGER">Manager IT</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select
              aria-label="Departement IT"
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              onChange={(event) =>
                setForm((value) => ({ ...value, departmentId: event.target.value }))
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
            <Input
              className="border-white/10 bg-white/6 md:col-span-2"
              onChange={(event) =>
                setForm((value) => ({ ...value, photoUrl: event.target.value }))
              }
              placeholder="URL photo de profil (optionnel)"
              value={form.photoUrl}
            />
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button
                className="flex-1 bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
                type="submit"
              >
                {editingId ? "Enregistrer" : "Ajouter"}
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
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCog className="size-5 text-[#6fb6ff]" />
              {technicians.length}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Profils IT assignables
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
          <CardHeader>
            <CardTitle className="text-lg">
              {technicians.reduce((sum, technician) => sum + technician.activeIncidents, 0)}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Pannes actives assignees
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
          <CardHeader>
            <CardTitle className="text-lg">
              {technicians.reduce((sum, technician) => sum + technician.activeAssignments, 0)}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Materiels suivis par agents
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-11 border-white/10 bg-white/6 pl-11"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Rechercher technicien, role, email ou departement..."
          value={searchQuery}
        />
      </div>

      <Card className="min-h-0 flex-1 border-white/10 bg-[#11183b]/95 text-white ring-0">
        <CardContent className="overflow-auto p-4">
          {isLoading ? (
            <p className="rounded-xl bg-white/6 p-4 text-sm text-slate-300">
              Chargement des techniciens...
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  {["Nom", "Email", "Role", "Departement", "Pannes", "Materiels", "Actions"].map(
                    (head) => (
                      <TableHead className="text-slate-400" key={head}>
                        {head}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTechnicians.map((technician) => (
                  <TableRow className="border-white/6 hover:bg-white/5" key={technician.id}>
                    <TableCell className="font-bold">{technician.name}</TableCell>
                    <TableCell className="text-slate-300">{technician.email}</TableCell>
                    <TableCell>
                      <Badge className="bg-[#6fb6ff]/20 text-[#9fd0ff]">
                        {roleLabels[technician.role] ?? technician.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{technician.department}</TableCell>
                    <TableCell>{technician.activeIncidents}</TableCell>
                    <TableCell>{technician.activeAssignments}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          className="bg-white/10 text-white hover:bg-white/15"
                          onClick={() => handleEdit(technician)}
                          type="button"
                        >
                          Modifier
                        </Button>
                        <Button
                          className="border border-[#ff2f45]/40 bg-[#ff2f45]/20 text-[#ff9aa5] hover:bg-[#ff2f45]/30"
                          onClick={() => handleDelete(technician.id)}
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

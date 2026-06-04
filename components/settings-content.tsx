"use client";

import { Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { ExportPdfButton } from "@/components/export-pdf-button";
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

type SettingType = "category" | "department" | "location";

type SettingItem = {
  code?: string;
  description?: string | null;
  id: string;
  name: string;
};

const emptyForm = {
  code: "",
  description: "",
  name: "",
  type: "category" as SettingType,
};

export function SettingsContent() {
  const [categories, setCategories] = useState<SettingItem[]>([]);
  const [departments, setDepartments] = useState<SettingItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [locations, setLocations] = useState<SettingItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  function filterSettings(items: SettingItem[]) {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      return items;
    }

    return items.filter((item) =>
      [item.code ?? "", item.description ?? "", item.name]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }

  async function loadSettings() {
    const response = await fetch("/api/settings", { cache: "no-store" });
    const data = await response.json();
    setCategories(data.categories);
    setDepartments(data.departments);
    setLocations(data.locations);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSettings();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = editingId
      ? `/api/settings/${form.type}/${editingId}`
      : "/api/settings";
    const method = editingId ? "PATCH" : "POST";

    await fetch(url, {
      method,
      body: JSON.stringify(form),
    });

    setEditingId(null);
    setForm(emptyForm);
    setIsFormOpen(false);
    await loadSettings();
  }

  function handleEdit(type: SettingType, item: SettingItem) {
    setEditingId(item.id);
    setIsFormOpen(true);
    setForm({
      code: item.code ?? "",
      description: item.description ?? "",
      name: item.name,
      type,
    });
  }

  async function handleDelete(type: SettingType, id: string) {
    await fetch(`/api/settings/${type}/${id}`, { method: "DELETE" });
    await loadSettings();
  }

  const groups: Array<{
    items: SettingItem[];
    label: string;
    type: SettingType;
  }> = [
    { items: filterSettings(categories), label: "Categories", type: "category" },
    { items: filterSettings(locations), label: "Localisations", type: "location" },
    { items: filterSettings(departments), label: "Departements", type: "department" },
  ];

  return (
    <section className="flex h-[calc(100dvh-11rem)] min-h-0 flex-col gap-5 text-white">
      <header className="shrink-0 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#6fb6ff]">
            Parametres
          </p>
          <h1 className="mt-2 text-3xl font-black">Referentiels</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Gere les categories, localisations et departements utilises par les
            autres modules.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportPdfButton
            filename="referentiels-it"
            sections={groups.map((section) => ({
              title: section.label,
              columns: ["Nom", "Code", "Description"],
              rows: section.items.map((item) => [
                item.name,
                item.code ?? "-",
                item.description ?? "-",
              ]),
            }))}
            subtitle="PROCO & Cie - Categories, localisations et departements"
            title="Referentiels IT"
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
            Ajouter un referentiel
          </Button>
        </div>
      </header>

      <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
        <DialogContent className="w-[min(calc(100vw-2rem),46rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifier un referentiel" : "Ajouter un referentiel"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Ces donnees alimentent les formulaires metier.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 md:grid-cols-2 [&_input]:h-11 [&_select]:h-11"
            onSubmit={handleSubmit}
          >
            <select
              className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm"
              disabled={Boolean(editingId)}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  type: event.target.value as SettingType,
                }))
              }
              value={form.type}
            >
              <option value="category">Categorie</option>
              <option value="location">Localisation</option>
              <option value="department">Departement</option>
            </select>
            <Input
              className="border-white/10 bg-white/6 md:col-span-2"
              onChange={(event) =>
                setForm((value) => ({ ...value, name: event.target.value }))
              }
              placeholder="Nom"
              required
              value={form.name}
            />
            <Input
              className="border-white/10 bg-white/6"
              disabled={form.type !== "location"}
              onChange={(event) =>
                setForm((value) => ({ ...value, code: event.target.value }))
              }
              placeholder="Code localisation"
              required={form.type === "location"}
              value={form.code}
            />
            <Input
              className="border-white/10 bg-white/6"
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  description: event.target.value,
                }))
              }
              placeholder="Description"
              value={form.description}
            />
            <div className="flex gap-2 md:col-span-2">
              <Button
                className="flex-1 bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
                type="submit"
              >
                {editingId ? "Enregistrer" : "Ajouter"}
              </Button>
              {editingId ? (
                <Button
                  className="bg-[#ff2f45]/20 text-[#ff7a88] hover:bg-[#ff2f45]/30"
                  onClick={async () => {
                    await handleDelete(form.type, editingId);
                    setEditingId(null);
                    setForm(emptyForm);
                    setIsFormOpen(false);
                  }}
                  type="button"
                >
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

      <div className="relative shrink-0">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-11 border-white/10 bg-white/6 pl-11"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Rechercher categorie, localisation, departement..."
          value={searchQuery}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-3 xl:items-stretch">
        {groups.map((group) => (
          <Card
            className="flex min-h-0 flex-col border-white/10 bg-[#11183b]/95 text-white ring-0"
            key={group.type}
          >
            <CardHeader className="shrink-0">
              <CardTitle>{group.label}</CardTitle>
              <CardDescription className="text-slate-400">
                {group.items.length} element(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-auto p-0 [scrollbar-gutter:stable]">
              {group.items.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">Aucun element.</p>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-[#11183b]">
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-slate-400">Nom</TableHead>
                      <TableHead className="w-[22%] text-slate-400">Code</TableHead>
                      <TableHead className="text-slate-400">Description</TableHead>
                      <TableHead className="w-[9rem] text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((item) => (
                      <TableRow
                        className="border-white/6 hover:bg-white/5"
                        key={item.id}
                      >
                        <TableCell className="align-top font-medium text-white">
                          {item.name}
                        </TableCell>
                        <TableCell className="align-top font-mono text-xs text-[#6fb6ff]">
                          {item.code ?? "—"}
                        </TableCell>
                        <TableCell className="align-top text-sm text-slate-300">
                          {item.description ?? "Sans description"}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-1.5 sm:flex-row">
                            <Button
                              className="h-8 bg-white/10 px-2 text-xs text-white hover:bg-white/15"
                              onClick={() => handleEdit(group.type, item)}
                              type="button"
                            >
                              Modifier
                            </Button>
                            <Button
                              className="h-8 bg-[#ff2f45]/20 px-2 text-xs text-[#ff7a88] hover:bg-[#ff2f45]/30"
                              onClick={() => handleDelete(group.type, item.id)}
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
        ))}
      </div>
    </section>
  );
}

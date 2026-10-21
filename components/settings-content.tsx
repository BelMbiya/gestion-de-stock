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

import { ui } from "@/lib/ui-styles";
import { KYC_UI } from "@/lib/kyc-excel/terminology";

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
    { items: filterSettings(categories), label: KYC_UI.CATEGORY, type: "category" },
    { items: filterSettings(locations), label: KYC_UI.LOCATION, type: "location" },
    { items: filterSettings(departments), label: KYC_UI.DEPARTMENT, type: "department" },
  ];

  return (
    <section className={`${ui.page} h-[calc(100dvh-11rem)]`}>
      <header className={`${ui.header} shrink-0 md:flex md:items-center md:justify-between`}>
        <div>
          <p className={ui.eyebrow}>{KYC_UI.SETTINGS}</p>
          <h1 className={ui.title}>{KYC_UI.SETTINGS}</h1>
          <p className={`${ui.subtitle} mt-1 max-w-2xl`}>
            {KYC_UI.CATEGORY}, {KYC_UI.LOCATION} & {KYC_UI.DEPARTMENT}.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0">
          <ExportPdfButton
            filename="referentiels-it"
            sections={groups.map((section) => ({
              title: section.label,
              columns: [KYC_UI.NAME, KYC_UI.CODE, "Description"],
              rows: section.items.map((item) => [
                item.name,
                item.code ?? "-",
                item.description ?? "-",
              ]),
            }))}
            subtitle={`PROCO & Cie - ${KYC_UI.CATEGORY}, ${KYC_UI.LOCATION}, ${KYC_UI.DEPARTMENT}`}
            title="Referentiels IT"
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
              <option value="category">{KYC_UI.CATEGORY}</option>
              <option value="location">{KYC_UI.LOCATION}</option>
              <option value="department">{KYC_UI.DEPARTMENT}</option>
            </select>
            <Input
              className="border-white/10 bg-white/6 md:col-span-2"
              onChange={(event) =>
                setForm((value) => ({ ...value, name: event.target.value }))
              }
              placeholder={KYC_UI.NAME}
              required
              value={form.name}
            />
            <Input
              className="border-white/10 bg-white/6"
              disabled={form.type !== "location"}
              onChange={(event) =>
                setForm((value) => ({ ...value, code: event.target.value }))
              }
              placeholder={`Code ${KYC_UI.LOCATION}`}
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
                className={`flex-1 ${ui.btnPrimary}`}
                type="submit"
              >
                {editingId ? "Enregistrer" : "Ajouter"}
              </Button>
              {editingId ? (
                <Button
                  className="bg-red-900/30 text-red-200 hover:bg-red-900/50"
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

      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          className={`${ui.input} pl-9`}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={`${KYC_UI.CATEGORY}, ${KYC_UI.LOCATION}, ${KYC_UI.DEPARTMENT}…`}
          value={searchQuery}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-3 xl:items-stretch">
        {groups.map((group) => (
          <Card
            className={`${ui.panel} flex min-h-0 flex-col ring-0`}
            key={group.type}
          >
            <CardHeader className={`${ui.panelHeader} shrink-0`}>
              <CardTitle className="text-base font-semibold">{group.label}</CardTitle>
              <CardDescription className={ui.subtitle}>
                {group.items.length} element(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-auto p-0 [scrollbar-gutter:stable]">
              {group.items.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">Aucun element.</p>
              ) : (
                <div className={ui.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-xs text-slate-500">Nom</TableHead>
                      <TableHead className="w-[22%] text-xs text-slate-500">Code</TableHead>
                      <TableHead className="text-xs text-slate-500">Description</TableHead>
                      <TableHead className="w-[9rem] text-xs text-slate-500">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((item) => (
                      <TableRow className="border-white/6" key={item.id}>
                        <TableCell className="align-top font-medium text-white">
                          {item.name}
                        </TableCell>
                        <TableCell className="align-top font-mono text-xs text-slate-400">
                          {item.code ?? "—"}
                        </TableCell>
                        <TableCell className="align-top text-sm text-slate-300">
                          {item.description ?? "Sans description"}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-1.5 sm:flex-row">
                            <Button
                              className={`h-8 px-2 text-xs ${ui.btnSecondary}`}
                              onClick={() => handleEdit(group.type, item)}
                              type="button"
                            >
                              Modifier
                            </Button>
                            <Button
                              className="h-8 bg-red-900/30 px-2 text-xs text-red-200 hover:bg-red-900/50"
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
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
